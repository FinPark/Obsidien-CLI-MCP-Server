import { getDb } from './db.js';

export interface SearchParams {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  participants?: string[];
  tags?: string[];
  art?: string[];
  folder?: string;
  limit?: number;
  includeContent?: boolean;
}

export interface NoteResult {
  path: string;
  title: string;
  datum: string | null;
  uhrzeit: string | null;
  ort: string | null;
  organisator: string | null;
  inhalt: string | null;
  vorausgegangen: string | null;
  folder: string | null;
  participants: string[];
  tags: string[];
  art: string[];
  body?: string;
}

export function searchNotes(params: SearchParams): NoteResult[] {
  const db = getDb();
  const conditions: string[] = [];
  const whereBindings: unknown[] = [];
  const joins: string[] = [];
  const joinBindings: unknown[] = [];
  let usesFts = false;

  if (params.query) {
    usesFts = true;
    conditions.push('notes_fts MATCH ?');
    // Escape FTS5 special characters by quoting each term
    const sanitized = params.query
      .split(/\s+/)
      .filter(t => t.length > 0)
      .map(t => `"${t.replace(/"/g, '""')}"`)
      .join(' ');
    whereBindings.push(sanitized);
  }

  if (params.dateFrom) {
    conditions.push('n.datum >= ?');
    whereBindings.push(params.dateFrom);
  }

  if (params.dateTo) {
    conditions.push('n.datum <= ?');
    whereBindings.push(params.dateTo);
  }

  if (params.participants && params.participants.length > 0) {
    for (let i = 0; i < params.participants.length; i++) {
      const alias = `p${i}`;
      joins.push(
        `JOIN note_participants ${alias} ON ${alias}.note_id = n.id AND ${alias}.participant LIKE ?`
      );
      joinBindings.push(`%${params.participants[i]}%`);
    }
  }

  if (params.tags && params.tags.length > 0) {
    const placeholders = params.tags.map(() => '?').join(', ');
    joins.push(
      `JOIN note_tags t ON t.note_id = n.id AND t.tag IN (${placeholders})`
    );
    joinBindings.push(...params.tags);
  }

  if (params.art && params.art.length > 0) {
    const placeholders = params.art.map(() => '?').join(', ');
    joins.push(
      `JOIN note_art a ON a.note_id = n.id AND a.art IN (${placeholders})`
    );
    joinBindings.push(...params.art);
  }

  if (params.folder) {
    conditions.push('n.folder = ?');
    whereBindings.push(params.folder);
  }

  const limit = params.limit ?? 20;

  const select = usesFts
    ? `SELECT DISTINCT n.id, n.path, n.title, n.datum, n.uhrzeit, n.ort, n.organisator, n.inhalt, n.vorausgegangen, n.folder${params.includeContent ? ', n.body' : ''}
       FROM notes_fts
       JOIN notes n ON n.id = notes_fts.rowid
       ${joins.join('\n')}`
    : `SELECT DISTINCT n.id, n.path, n.title, n.datum, n.uhrzeit, n.ort, n.organisator, n.inhalt, n.vorausgegangen, n.folder${params.includeContent ? ', n.body' : ''}
       FROM notes n
       ${joins.join('\n')}`;

  const where = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const orderBy = usesFts ? 'ORDER BY rank' : 'ORDER BY n.datum DESC, n.title ASC';

  const sql = `${select} ${where} ${orderBy} LIMIT ?`;

  // Bindings order: join bindings first (appear in FROM clause), then WHERE bindings, then LIMIT
  const allBindings = [...joinBindings, ...whereBindings, limit];

  const rows = db.prepare(sql).all(...allBindings) as Array<Record<string, unknown>>;

  return rows.map(row => enrichNote(row, params.includeContent));
}

function enrichNote(row: Record<string, unknown>, includeContent?: boolean): NoteResult {
  const db = getDb();
  const noteId = row.id as number;

  const participants = db.prepare(
    'SELECT participant FROM note_participants WHERE note_id = ?'
  ).all(noteId) as Array<{ participant: string }>;

  const tags = db.prepare(
    'SELECT tag FROM note_tags WHERE note_id = ?'
  ).all(noteId) as Array<{ tag: string }>;

  const art = db.prepare(
    'SELECT art FROM note_art WHERE note_id = ?'
  ).all(noteId) as Array<{ art: string }>;

  const result: NoteResult = {
    path: row.path as string,
    title: row.title as string,
    datum: row.datum as string | null,
    uhrzeit: row.uhrzeit as string | null,
    ort: row.ort as string | null,
    organisator: row.organisator as string | null,
    inhalt: row.inhalt as string | null,
    vorausgegangen: row.vorausgegangen as string | null,
    folder: row.folder as string | null,
    participants: participants.map(p => p.participant),
    tags: tags.map(t => t.tag),
    art: art.map(a => a.art),
  };

  if (includeContent) {
    result.body = row.body as string;
  }

  return result;
}

export function readNote(notePath: string): NoteResult | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, path, title, datum, uhrzeit, ort, organisator, inhalt, vorausgegangen, folder, body FROM notes WHERE path = ?'
  ).get(notePath) as Record<string, unknown> | undefined;

  if (!row) return null;
  return enrichNote(row, true);
}

export function listParticipants(query?: string): Array<{ participant: string; count: number }> {
  const db = getDb();
  if (query) {
    return db.prepare(
      `SELECT participant, COUNT(*) as count FROM note_participants
       WHERE participant LIKE ? GROUP BY participant ORDER BY count DESC`
    ).all(`%${query}%`) as Array<{ participant: string; count: number }>;
  }
  return db.prepare(
    'SELECT participant, COUNT(*) as count FROM note_participants GROUP BY participant ORDER BY count DESC'
  ).all() as Array<{ participant: string; count: number }>;
}

export function listTags(query?: string): Array<{ tag: string; count: number }> {
  const db = getDb();
  if (query) {
    return db.prepare(
      `SELECT tag, COUNT(*) as count FROM note_tags
       WHERE tag LIKE ? GROUP BY tag ORDER BY count DESC`
    ).all(`%${query}%`) as Array<{ tag: string; count: number }>;
  }
  return db.prepare(
    'SELECT tag, COUNT(*) as count FROM note_tags GROUP BY tag ORDER BY count DESC'
  ).all() as Array<{ tag: string; count: number }>;
}

export function vaultStats(): {
  totalNotes: number;
  dateRange: { earliest: string | null; latest: string | null };
  topParticipants: Array<{ participant: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  folders: Array<{ folder: string; count: number }>;
} {
  const db = getDb();

  const totalNotes = (db.prepare('SELECT COUNT(*) as c FROM notes').get() as { c: number }).c;

  const dateRange = db.prepare(
    'SELECT MIN(datum) as earliest, MAX(datum) as latest FROM notes WHERE datum IS NOT NULL'
  ).get() as { earliest: string | null; latest: string | null };

  const topParticipants = db.prepare(
    'SELECT participant, COUNT(*) as count FROM note_participants GROUP BY participant ORDER BY count DESC LIMIT 20'
  ).all() as Array<{ participant: string; count: number }>;

  const topTags = db.prepare(
    'SELECT tag, COUNT(*) as count FROM note_tags GROUP BY tag ORDER BY count DESC LIMIT 20'
  ).all() as Array<{ tag: string; count: number }>;

  const folders = db.prepare(
    'SELECT folder, COUNT(*) as count FROM notes WHERE folder IS NOT NULL GROUP BY folder ORDER BY count DESC'
  ).all() as Array<{ folder: string; count: number }>;

  return { totalNotes, dateRange, topParticipants, topTags, folders };
}
