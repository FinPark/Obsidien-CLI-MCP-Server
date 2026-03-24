import { exec } from '../cli/obsidian-cli.js';

export const getOutlineSchema = {
  name: 'get_outline',
  description: `Get the heading structure (outline) of a note.
Returns all headings with their levels. Useful for understanding note structure before reading the full content.
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path' },
      format: {
        type: 'string',
        enum: ['tree', 'json', 'md'],
        description: 'Output format: tree (indented), json (structured), md (markdown headings). Default: tree',
      },
    },
  },
};

export async function handleGetOutline(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.format) params.format = args.format as string;

  const result = await exec('outline', params);
  return result || 'Keine Headings gefunden.';
}
