import { exec } from '../cli/obsidian-cli.js';
import { VAULT_NAME } from '../config.js';
import { formatNoteEntry } from '../utils/obsidian-links.js';

export const searchNotesSchema = {
  name: 'search_notes',
  description: `Search Obsidian vault notes via full-text search.
Returns matching file paths with raw vault-relative paths in backticks — use those paths directly in read_note.

IMPORTANT search tips to avoid multiple retries:
- Use SHORT, simple queries (1-2 keywords). Long compound queries often return 0 results.
- Bad: "PV-Anlage Solarertrag Jahresrechnung 2024" → likely 0 results
- Good: "Solarertrag" or "PV Anlage"
- Use context:true only when you need to see matching lines, not just to find a note.
- If results are 0, retry with a shorter/simpler query before trying other tools.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query — keep short (1-2 keywords) for best results' },
      folder: { type: 'string', description: 'Limit to folder path' },
      limit: { type: 'number', description: 'Max results (default 20)' },
      context: { type: 'boolean', description: 'Include matching line context. Use only when you need to see content snippets, not for navigation.' },
    },
    required: ['query'],
  },
};

export async function handleSearchNotes(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  const folder = args.folder as string | undefined;
  const limit = args.limit as number | undefined;
  const context = args.context as boolean | undefined;

  const command = context ? 'search:context' : 'search';
  const params: Record<string, string> = { query };
  if (folder) params.path = folder;
  if (limit) params.limit = String(limit);

  const result = await exec(command, params);

  if (!result) return 'Keine Notizen gefunden.';

  if (context) {
    // grep-style output: "path/to/note.md: matching line"
    // Group matches by file and prepend formatted path with raw backtick path for the agent
    const byFile = new Map<string, string[]>();
    for (const line of result.split('\n').filter(Boolean)) {
      const colonIdx = line.indexOf(': ');
      if (colonIdx === -1) continue;
      const filePath = line.slice(0, colonIdx).trim();
      const matchLine = line.slice(colonIdx + 2).trim();
      if (!byFile.has(filePath)) byFile.set(filePath, []);
      byFile.get(filePath)!.push(matchLine);
    }
    return [...byFile.entries()]
      .map(([filePath, lines]) =>
        `${formatNoteEntry(filePath, VAULT_NAME)}\n${lines.map((l) => `  > ${l}`).join('\n')}`,
      )
      .join('\n\n');
  }

  const paths = result.split('\n').filter(Boolean);
  return paths
    .map((p) => `- ${formatNoteEntry(p.trim(), VAULT_NAME)}`)
    .join('\n');
}
