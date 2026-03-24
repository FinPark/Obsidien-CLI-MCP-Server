import { exec } from '../cli/obsidian-cli.js';

export const researchChainSchema = {
  name: 'research_chain',
  description: `Trace the full predecessor chain ("Vorausgegangen" frontmatter) of a note and collect context.
Follows the chain backwards until the root note (no predecessor) is found.

IMPORTANT: Pass an actual note file name or path, NOT a folder name. Use search_notes or list_files first
if you're unsure of the exact note name. The tool has fallbacks but works best with precise input.

Returns:
1. **chain** — The full note chain from oldest (root) to newest, with title, path, and date
2. **links** — All outgoing links from the chain notes (deduplicated)
3. **backlinks** — All backlinks TO the chain notes (deduplicated, excluding chain-internal links)

This gives a complete overview of a topic's history and related context.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name of the starting note (resolved like wikilinks)' },
      path: { type: 'string', description: 'Exact vault-relative path of the starting note' },
    },
  },
};

interface ChainEntry {
  title: string;
  path: string;
  datum?: string;
}

export async function handleResearchChain(args: Record<string, unknown>): Promise<string> {
  const startFile = args.file as string | undefined;
  const startPath = args.path as string | undefined;

  if (!startFile && !startPath) {
    return JSON.stringify({ error: 'file oder path ist erforderlich.' });
  }

  // 1. Resolve starting note — with fallback strategies
  let resolvedStart = await resolveNote(startFile, startPath);

  if (!resolvedStart && startFile) {
    // Fallback 1: maybe it's a folder name → find newest .md file in it
    resolvedStart = await resolveViaFolder(startFile);
  }

  if (!resolvedStart && startFile) {
    // Fallback 2: search vault for matching notes
    resolvedStart = await resolveViaSearch(startFile);
  }

  if (!resolvedStart) {
    const hint = startFile || startPath;
    return JSON.stringify({
      error: `Notiz "${hint}" nicht gefunden. Bitte einen genauen Dateinamen oder Pfad angeben.`,
    });
  }

  const chain: ChainEntry[] = [];
  const visited = new Set<string>();
  let currentFile: string | undefined = undefined;
  let currentPath: string | undefined = resolvedStart.path;

  // Walk backwards through Vorausgegangen chain
  while (true) {
    // Resolve current note
    const info = await resolveNote(currentFile, currentPath);
    if (!info) break;

    // Prevent infinite loops
    if (visited.has(info.path)) break;
    visited.add(info.path);

    // Get date
    let datum: string | undefined;
    try {
      datum = (await exec('property:read', { name: 'Datum', path: info.path })).trim() || undefined;
    } catch { /* no date */ }

    chain.unshift({ title: info.name, path: info.path, datum });

    // Get predecessor
    let predecessor: string | undefined;
    try {
      const raw = await exec('property:read', { name: 'Vorausgegangen', path: info.path });
      predecessor = extractWikilink(raw.trim());
    } catch { /* no predecessor */ }

    if (!predecessor) break;

    // Set up next iteration — predecessor is a file name (from wikilink)
    currentFile = predecessor;
    currentPath = undefined;
  }

  // 2. Collect outgoing links from all chain notes
  const chainPaths = new Set(chain.map((c) => c.path));
  const allLinks = new Set<string>();
  const allBacklinks = new Set<string>();

  await Promise.all(
    chain.map(async (entry) => {
      // Outgoing links
      try {
        const linksOutput = await exec('links', { path: entry.path });
        for (const line of linksOutput.split('\n')) {
          const link = line.trim();
          if (link && !chainPaths.has(link)) {
            allLinks.add(link);
          }
        }
      } catch { /* no links */ }

      // Backlinks
      try {
        const backlinksOutput = await exec('backlinks', { path: entry.path });
        for (const line of backlinksOutput.split('\n')) {
          const bl = line.trim();
          if (bl && !chainPaths.has(bl) && bl.includes('.md')) {
            allBacklinks.add(bl);
          }
        }
      } catch { /* no backlinks */ }
    }),
  );

  return JSON.stringify({
    chain,
    links: [...allLinks].sort(),
    backlinks: [...allBacklinks].sort(),
  }, null, 2);
}

async function resolveNote(
  file: string | undefined,
  path: string | undefined,
): Promise<{ name: string; path: string } | null> {
  try {
    const params: Record<string, string> = {};
    if (path) params.path = path;
    else if (file) params.file = file;
    else return null;

    const info = await exec('file', params);
    const parsed: Record<string, string> = {};
    for (const line of info.split('\n')) {
      const [key, ...rest] = line.split('\t');
      if (key && rest.length > 0) parsed[key] = rest.join('\t');
    }

    if (parsed.path && parsed.name) {
      return { name: parsed.name, path: parsed.path };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback: input might be a folder name. Search all folders, find the matching one,
 * then pick the newest .md file inside it.
 */
async function resolveViaFolder(input: string): Promise<{ name: string; path: string } | null> {
  try {
    const foldersOutput = await exec('folders');
    const allFolders = foldersOutput.split('\n').filter((f) => f && f !== '/');
    const inputLower = input.toLowerCase();

    // Find folders whose last segment matches the input
    const matches = allFolders.filter((f) => {
      const last = f.split('/').pop()!.toLowerCase();
      return last.includes(inputLower);
    });

    if (matches.length === 0) return null;

    // Use first matching folder, list its .md files
    const folder = matches[0];
    const filesOutput = await exec('files', { folder, ext: 'md' });
    const files = filesOutput.split('\n').filter((f) => f.trim());

    if (files.length === 0) return null;

    // Pick the last file (typically newest by name with dates)
    const lastFile = files[files.length - 1];
    return await resolveNote(undefined, lastFile);
  } catch {
    return null;
  }
}

/**
 * Fallback: search vault for notes matching the input.
 * Picks the first .md result.
 */
async function resolveViaSearch(input: string): Promise<{ name: string; path: string } | null> {
  try {
    const searchOutput = await exec('search', { query: input, limit: '5' });
    const files = searchOutput.split('\n').filter((f) => f.trim().endsWith('.md'));
    if (files.length === 0) return null;
    return await resolveNote(undefined, files[0].trim());
  } catch {
    return null;
  }
}

function extractWikilink(text: string): string | undefined {
  if (!text) return undefined;
  // Match [[link]] or [[link|alias]]
  const match = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (match) return match[1].trim();
  // If no wikilink syntax, treat as plain text reference
  if (text.length > 0 && !text.startsWith('Error')) return text;
  return undefined;
}
