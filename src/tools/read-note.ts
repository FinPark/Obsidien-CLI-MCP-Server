import { readNote } from '../database/queries.js';

export const readNoteSchema = {
  name: 'read_note',
  description: `Read full details of one or more Obsidian notes by path.
Returns: path, title, datum, uhrzeit, ort, organisator, inhalt (summary), teilnehmer, tags, art, and full body content.
IMPORTANT: Pass ALL paths in a single call (array) instead of calling once per note.
Use search_notes first to find relevant notes, then read_note with all paths at once.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Relative paths within the vault (e.g. ["📥 Inbox/LLM Tool calls für MCP-Server.md"])',
      },
    },
    required: ['paths'],
  },
};

export function handleReadNote(args: Record<string, unknown>): string {
  const paths = args.paths as string[] | undefined;
  // Backwards compatibility: support old single-path format
  const pathList = paths ?? (args.path ? [args.path as string] : []);

  if (pathList.length === 0) {
    return 'Fehler: paths ist erforderlich.';
  }

  const results = [];
  for (const p of pathList) {
    const note = readNote(p);
    if (note) {
      results.push(note);
    } else {
      results.push({ path: p, error: 'Notiz nicht gefunden' });
    }
  }

  if (results.length === 1) {
    return JSON.stringify(results[0], null, 2);
  }

  return JSON.stringify(results, null, 2);
}
