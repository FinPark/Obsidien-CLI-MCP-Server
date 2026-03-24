import { exec, execJson } from '../cli/obsidian-cli.js';

interface TagEntry {
  tag: string;
  count: string;
}

export const listTagsSchema = {
  name: 'list_tags',
  description: 'List all tags in the vault with occurrence counts. Optionally filter by tag name.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Filter tags by name (partial match)' },
    },
  },
};

export async function handleListTags(args: Record<string, unknown>): Promise<string> {
  const query = (args.query as string | undefined)?.toLowerCase();

  const tags = await execJson<TagEntry[]>('tags', {}, ['counts']);

  const filtered = query
    ? tags.filter((t) => t.tag.toLowerCase().includes(query))
    : tags;

  return JSON.stringify(filtered, null, 2);
}
