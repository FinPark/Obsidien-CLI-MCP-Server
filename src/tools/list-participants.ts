import { exec } from '../cli/obsidian-cli.js';

export const listParticipantsSchema = {
  name: 'list_participants',
  description: `List all values of the "Teilnehmer" property across vault notes, with occurrence counts.
Optionally filter by name (partial match).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Filter participants by name (partial match)' },
    },
  },
};

export async function handleListParticipants(args: Record<string, unknown>): Promise<string> {
  const query = (args.query as string | undefined)?.toLowerCase();

  // Use eval to query Obsidian's metadata cache for Teilnehmer values
  const code = `
    const counts = {};
    for (const file of app.vault.getMarkdownFiles()) {
      const meta = app.metadataCache.getFileCache(file);
      const fm = meta?.frontmatter;
      if (!fm?.Teilnehmer) continue;
      const participants = Array.isArray(fm.Teilnehmer) ? fm.Teilnehmer : [fm.Teilnehmer];
      for (const p of participants) {
        if (typeof p === 'string' && p.trim()) {
          const name = p.trim();
          counts[name] = (counts[name] || 0) + 1;
        }
      }
    }
    JSON.stringify(Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
  `.trim();

  const result = await exec('eval', { code });

  let participants: Array<{ name: string; count: number }>;
  try {
    participants = JSON.parse(result);
  } catch {
    return JSON.stringify({ error: 'Failed to parse participants', raw: result });
  }

  const filtered = query
    ? participants.filter((p) => p.name.toLowerCase().includes(query))
    : participants;

  return JSON.stringify(filtered, null, 2);
}
