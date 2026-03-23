import { listTags } from '../database/queries.js';

export const listTagsSchema = {
  name: 'list_tags',
  description: 'List all known tags across all vault notes, with their note count. Optionally filter by tag name.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Filter tags by name (partial match)' },
    },
  },
};

export function handleListTags(args: Record<string, unknown>): string {
  const results = listTags(args.query as string | undefined);
  return JSON.stringify(results, null, 2);
}
