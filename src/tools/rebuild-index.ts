import { getDb } from '../database/db.js';
import { buildIndex } from '../indexer/indexer.js';

export const rebuildIndexSchema = {
  name: 'rebuild_index',
  description: 'Force a full re-index of the Obsidian vault. Clears the database and re-parses all notes. Use when index seems stale.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      full: { type: 'boolean', description: 'If true, clears the entire database before re-indexing (default: false, delta update)' },
    },
  },
};

export function handleRebuildIndex(args: Record<string, unknown>): string {
  const full = args.full as boolean | undefined;

  if (full) {
    const db = getDb();
    db.exec('DELETE FROM note_participants');
    db.exec('DELETE FROM note_tags');
    db.exec('DELETE FROM note_art');
    db.exec('DELETE FROM notes_fts');
    db.exec('DELETE FROM notes');
  }

  const result = buildIndex();
  return JSON.stringify({
    message: full ? 'Full re-index complete' : 'Delta index complete',
    ...result,
  }, null, 2);
}
