import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../database/db.js';
import { VAULT_PATH } from '../config.js';
import { parseFrontmatter } from './frontmatter.js';
import { scanVault, getFolder, getTitle } from './vault-scanner.js';

export function buildIndex(): { indexed: number; skipped: number; removed: number } {
  const db = getDb();
  const files = scanVault();

  // Get existing entries for delta check
  const existing = new Map<string, number>();
  const rows = db.prepare('SELECT path, mtime FROM notes').all() as Array<{ path: string; mtime: number }>;
  for (const row of rows) {
    existing.set(row.path, row.mtime);
  }

  const currentPaths = new Set<string>();
  let indexed = 0;
  let skipped = 0;

  const insertNote = db.prepare(`
    INSERT OR REPLACE INTO notes (path, title, datum, uhrzeit, ort, organisator, inhalt, vorausgegangen, body, folder, mtime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteParticipants = db.prepare('DELETE FROM note_participants WHERE note_id = ?');
  const insertParticipant = db.prepare('INSERT OR IGNORE INTO note_participants (note_id, participant) VALUES (?, ?)');
  const deleteTags = db.prepare('DELETE FROM note_tags WHERE note_id = ?');
  const insertTag = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)');
  const deleteArt = db.prepare('DELETE FROM note_art WHERE note_id = ?');
  const insertArt = db.prepare('INSERT OR IGNORE INTO note_art (note_id, art) VALUES (?, ?)');
  const deleteFts = db.prepare('DELETE FROM notes_fts WHERE rowid = ?');
  const insertFts = db.prepare('INSERT INTO notes_fts (rowid, title, inhalt, body) VALUES (?, ?, ?, ?)');

  function indexFile(file: { relativePath: string; absolutePath: string; mtime: number }): void {
    const content = fs.readFileSync(file.absolutePath, 'utf-8');
    const parsed = parseFrontmatter(content);
    const title = getTitle(file.relativePath);
    const folder = getFolder(file.relativePath);

    insertNote.run(
      file.relativePath, title, parsed.datum, parsed.uhrzeit, parsed.ort,
      parsed.organisator, parsed.inhalt, parsed.vorausgegangen, parsed.body,
      folder, file.mtime
    );

    const noteRow = db.prepare('SELECT id FROM notes WHERE path = ?').get(file.relativePath) as { id: number };
    const noteId = noteRow.id;

    deleteParticipants.run(noteId);
    for (const p of parsed.teilnehmer) {
      insertParticipant.run(noteId, p);
    }

    deleteTags.run(noteId);
    for (const t of parsed.tags) {
      insertTag.run(noteId, t);
    }

    deleteArt.run(noteId);
    for (const a of parsed.art) {
      insertArt.run(noteId, a);
    }

    deleteFts.run(noteId);
    insertFts.run(noteId, title, parsed.inhalt ?? '', parsed.body);
  }

  let errors = 0;

  // Batch in a single transaction for performance
  const batchIndex = db.transaction(() => {
    for (const file of files) {
      currentPaths.add(file.relativePath);

      const existingMtime = existing.get(file.relativePath);
      if (existingMtime !== undefined && Math.abs(existingMtime - file.mtime) < 1000) {
        skipped++;
        continue;
      }

      try {
        indexFile(file);
        indexed++;
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`[indexer] Error indexing ${file.relativePath}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  });

  batchIndex();
  if (errors > 5) {
    console.error(`[indexer] ... and ${errors - 5} more errors`);
  }

  // Remove deleted files
  const removedPaths = [...existing.keys()].filter(p => !currentPaths.has(p));
  let removed = 0;
  if (removedPaths.length > 0) {
    const removeTransaction = db.transaction(() => {
      for (const p of removedPaths) {
        const row = db.prepare('SELECT id FROM notes WHERE path = ?').get(p) as { id: number } | undefined;
        if (row) {
          deleteParticipants.run(row.id);
          deleteTags.run(row.id);
          deleteArt.run(row.id);
          deleteFts.run(row.id);
          db.prepare('DELETE FROM notes WHERE id = ?').run(row.id);
          removed++;
        }
      }
    });
    removeTransaction();
  }

  return { indexed, skipped, removed };
}

/**
 * Quick cleanup: remove index entries for files that no longer exist on disk.
 * Much faster than a full buildIndex — only checks existing DB paths against the filesystem.
 */
export function cleanupDeletedFiles(): number {
  const db = getDb();
  const rows = db.prepare('SELECT id, path FROM notes').all() as Array<{ id: number; path: string }>;
  let removed = 0;

  const toRemove: number[] = [];
  for (const row of rows) {
    const absPath = path.join(VAULT_PATH, row.path);
    if (!fs.existsSync(absPath)) {
      toRemove.push(row.id);
    }
  }

  if (toRemove.length > 0) {
    const cleanup = db.transaction(() => {
      for (const id of toRemove) {
        db.prepare('DELETE FROM note_participants WHERE note_id = ?').run(id);
        db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(id);
        db.prepare('DELETE FROM note_art WHERE note_id = ?').run(id);
        db.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(id);
        db.prepare('DELETE FROM notes WHERE id = ?').run(id);
        removed++;
      }
    });
    cleanup();
  }

  return removed;
}

export function indexSingleFile(relativePath: string): void {
  const db = getDb();
  const absolutePath = path.join(VAULT_PATH, relativePath);

  if (!fs.existsSync(absolutePath)) {
    // File was deleted
    const row = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath) as { id: number } | undefined;
    if (row) {
      db.prepare('DELETE FROM note_participants WHERE note_id = ?').run(row.id);
      db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(row.id);
      db.prepare('DELETE FROM note_art WHERE note_id = ?').run(row.id);
      db.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(row.id);
      db.prepare('DELETE FROM notes WHERE id = ?').run(row.id);
    }
    return;
  }

  const stat = fs.statSync(absolutePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const parsed = parseFrontmatter(content);
  const title = getTitle(relativePath);
  const folder = getFolder(relativePath);

  // Clean up old relations BEFORE replace (avoids FOREIGN KEY errors)
  const existingRow = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath) as { id: number } | undefined;
  if (existingRow) {
    db.prepare('DELETE FROM note_participants WHERE note_id = ?').run(existingRow.id);
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(existingRow.id);
    db.prepare('DELETE FROM note_art WHERE note_id = ?').run(existingRow.id);
    db.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(existingRow.id);
  }

  db.prepare(`
    INSERT OR REPLACE INTO notes (path, title, datum, uhrzeit, ort, organisator, inhalt, vorausgegangen, body, folder, mtime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    relativePath, title, parsed.datum, parsed.uhrzeit, parsed.ort,
    parsed.organisator, parsed.inhalt, parsed.vorausgegangen, parsed.body,
    folder, stat.mtimeMs
  );

  const noteRow = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath) as { id: number };
  const noteId = noteRow.id;

  // Relations already cleaned above, just insert new ones
  for (const p of parsed.teilnehmer) {
    db.prepare('INSERT OR IGNORE INTO note_participants (note_id, participant) VALUES (?, ?)').run(noteId, p);
  }

  for (const t of parsed.tags) {
    db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)').run(noteId, t);
  }

  for (const a of parsed.art) {
    db.prepare('INSERT OR IGNORE INTO note_art (note_id, art) VALUES (?, ?)').run(noteId, a);
  }

  db.prepare('INSERT INTO notes_fts (rowid, title, inhalt, body) VALUES (?, ?, ?, ?)').run(
    noteId, title, parsed.inhalt ?? '', parsed.body
  );
}

export function removeFile(relativePath: string): void {
  const db = getDb();
  const row = db.prepare('SELECT id FROM notes WHERE path = ?').get(relativePath) as { id: number } | undefined;
  if (row) {
    db.prepare('DELETE FROM note_participants WHERE note_id = ?').run(row.id);
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(row.id);
    db.prepare('DELETE FROM note_art WHERE note_id = ?').run(row.id);
    db.prepare('DELETE FROM notes_fts WHERE rowid = ?').run(row.id);
    db.prepare('DELETE FROM notes WHERE id = ?').run(row.id);
  }
}
