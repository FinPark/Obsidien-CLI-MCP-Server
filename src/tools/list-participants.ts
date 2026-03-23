import { listParticipants } from '../database/queries.js';

export const listParticipantsSchema = {
  name: 'list_participants',
  description: 'List all known participants across all vault notes, with their note count. Optionally filter by name.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Filter participants by name (partial match)' },
    },
  },
};

export function handleListParticipants(args: Record<string, unknown>): string {
  const results = listParticipants(args.query as string | undefined);
  return JSON.stringify(results, null, 2);
}
