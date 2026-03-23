import { searchNotes, type SearchParams } from '../database/queries.js';

export const searchNotesSchema = {
  name: 'search_notes',
  description: `Search Obsidian vault notes and return metadata for orientation (no note body).
Returns: path, title, datum, uhrzeit, ort, organisator, inhalt (summary), teilnehmer, tags, art.
Use read_note to get the full content of a specific note.
All filters are optional and combined with AND logic. Participants use partial matching (e.g. "Nikas" matches "Nikas Schröder").
Tags use OR logic (any matching tag). Sorted by date (newest first) or relevance if a query is given.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Full-text search across title, content summary, and note body' },
      dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD), inclusive' },
      dateTo: { type: 'string', description: 'End date (YYYY-MM-DD), inclusive' },
      participants: { type: 'array', items: { type: 'string' }, description: 'Filter by participants (AND logic, partial match)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (OR logic)' },
      art: { type: 'array', items: { type: 'string' }, description: 'Filter by type: Besprechung, Teams-Besprechung, Telefonat, Konzept, Training' },
      folder: { type: 'string', description: 'Limit to folder (e.g. "📥 Inbox", "📘 Arbeit")' },
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
  },
};

export function handleSearchNotes(args: Record<string, unknown>): string {
  const params: SearchParams = {
    query: args.query as string | undefined,
    dateFrom: args.dateFrom as string | undefined,
    dateTo: args.dateTo as string | undefined,
    participants: args.participants as string[] | undefined,
    tags: args.tags as string[] | undefined,
    art: args.art as string[] | undefined,
    folder: args.folder as string | undefined,
    limit: args.limit as number | undefined,
    includeContent: false,
  };

  const results = searchNotes(params);

  if (results.length === 0) {
    return 'Keine Notizen gefunden.';
  }

  return JSON.stringify(results, null, 2);
}
