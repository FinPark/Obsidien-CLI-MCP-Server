import { exec } from '../cli/obsidian-cli.js';

export const readNoteSchema = {
  name: 'read_note',
  description: `Read full contents of one or more Obsidian notes.
Accepts paths (exact vault-relative path like "folder/note.md") or file names (resolved like wikilinks).
IMPORTANT: Pass ALL paths in a single call (array) instead of calling once per note.
Use search_notes first to find relevant notes, then read_note with all paths at once.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Vault-relative paths (e.g. ["📥 Inbox/My Note.md"]) or file names (e.g. ["My Note"])',
      },
    },
    required: ['paths'],
  },
};

export async function handleReadNote(args: Record<string, unknown>): Promise<string> {
  const paths = args.paths as string[] | undefined;
  const pathList = paths ?? (args.path ? [args.path as string] : []);

  if (pathList.length === 0) {
    return 'Fehler: paths ist erforderlich.';
  }

  const results = await Promise.all(
    pathList.map(async (p) => {
      try {
        // Use path= for full paths (contain /), file= for name resolution
        const isPath = p.includes('/') || p.endsWith('.md');
        const params: Record<string, string> = isPath ? { path: p } : { file: p };
        const content = await exec('read', params);
        return { path: p, content };
      } catch (err) {
        return { path: p, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  if (results.length === 1) {
    return JSON.stringify(results[0], null, 2);
  }

  return JSON.stringify(results, null, 2);
}
