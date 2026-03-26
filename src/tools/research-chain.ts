import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { exec } from '../cli/obsidian-cli.js';

async function sendProgress(
  server: Server,
  progressToken: string | number | undefined,
  progress: number,
  total: number,
) {
  if (!progressToken) return;
  await server.notification({
    method: 'notifications/progress',
    params: { progressToken, progress, total },
  });
}

export const researchChainSchema = {
  name: 'research_chain',
  description: `Trace the full predecessor chain ("Vorausgegangen" frontmatter) of a note and collect context.
Follows the chain backwards until the root note (no predecessor) is found.

IMPORTANT: Pass an actual note file name or path, NOT a folder name. Use search_notes or list_files first
if you're unsure of the exact note name. The tool has fallbacks but works best with precise input.

Returns a COMPLETE context package — no follow-up calls to file_info, list_files, or list_folders needed:
1. **chain** — The full note chain from oldest (root) to newest, with: title, path, date, folder,
   size, created/modified timestamps, Inhalt (summary), Teilnehmer, tags, and heading outline
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

export async function handleResearchChain(
  args: Record<string, unknown>,
  server: Server,
  meta?: Record<string, unknown>,
): Promise<string> {
  const startFile = args.file as string | undefined;
  const startPath = args.path as string | undefined;
  const progressToken = meta?.progressToken as string | number | undefined;

  if (!startFile && !startPath) {
    return JSON.stringify({ error: 'file oder path ist erforderlich.' });
  }

  await sendProgress(server, progressToken, 1, 3);

  // Resolve starting note
  let resolvedStart = await resolveNote(startFile, startPath);

  if (!resolvedStart && startFile) {
    resolvedStart = await resolveViaFolder(startFile);
  }

  if (!resolvedStart && startFile) {
    resolvedStart = await resolveViaSearch(startFile);
  }

  if (!resolvedStart) {
    const hint = startFile || startPath;
    return JSON.stringify({
      error: `Notiz "${hint}" nicht gefunden. Bitte einen genauen Dateinamen oder Pfad angeben.`,
    });
  }

  await sendProgress(server, progressToken, 2, 3);

  // Single eval call that does ALL the work inside Obsidian — no 370 CLI calls
  const code = `
(function() {
  const startPath = ${JSON.stringify(resolvedStart.path)};
  const vault = app.vault;
  const cache = app.metadataCache;

  function getFile(p) { return vault.getAbstractFileByPath(p); }
  function getMeta(f) { return f ? cache.getFileCache(f) : null; }
  function getFm(f) { const m = getMeta(f); return m?.frontmatter || {}; }

  function resolveLink(linkText) {
    if (!linkText) return null;
    const match = linkText.match(/\\[\\[([^\\]|]+)/);
    const name = match ? match[1].trim() : linkText.trim();
    if (!name) return null;
    const found = vault.getMarkdownFiles().find(f => f.basename === name);
    return found || null;
  }

  function getOutline(f) {
    const m = getMeta(f);
    if (!m?.headings) return '';
    return m.headings.map(h => '  '.repeat(h.level - 1) + '#'.repeat(h.level) + ' ' + h.heading).join('\\n');
  }

  function getLinks(f) {
    const m = getMeta(f);
    const links = [];
    if (m?.links) {
      for (const l of m.links) {
        const resolved = cache.getFirstLinkpathDest(l.link, f.path);
        if (resolved) links.push(resolved.path);
      }
    }
    return links;
  }

  function getBacklinks(f) {
    const bl = cache.getBacklinksForFile(f);
    return bl?.data ? [...bl.data.keys()] : [];
  }

  // Walk the chain backwards
  const chain = [];
  const visited = new Set();
  let currentFile = getFile(startPath);

  while (currentFile) {
    if (visited.has(currentFile.path)) break;
    visited.add(currentFile.path);

    const fm = getFm(currentFile);
    const teilnehmer = fm.Teilnehmer || fm.teilnehmer || [];
    const tags = fm.tags || [];

    chain.unshift({
      title: currentFile.basename,
      path: currentFile.path,
      folder: currentFile.parent ? currentFile.parent.path : '',
      datum: fm.Datum || fm.datum || undefined,
      inhalt: fm.Inhalt || fm.inhalt || undefined,
      teilnehmer: Array.isArray(teilnehmer) ? teilnehmer : [teilnehmer],
      tags: Array.isArray(tags) ? tags : [tags],
      size: currentFile.stat?.size,
      created: currentFile.stat?.ctime,
      modified: currentFile.stat?.mtime,
      outline: getOutline(currentFile),
    });

    // Follow predecessor
    const prev = fm.Vorausgegangen || fm.vorausgegangen;
    if (!prev) break;
    currentFile = resolveLink(prev);
  }

  // Collect links and backlinks
  const chainPaths = new Set(chain.map(c => c.path));
  const allLinks = new Set();
  const allBacklinks = new Set();

  for (const entry of chain) {
    const f = getFile(entry.path);
    if (!f) continue;

    for (const l of getLinks(f)) {
      if (!chainPaths.has(l)) allLinks.add(l);
    }
    for (const bl of getBacklinks(f)) {
      if (!chainPaths.has(bl) && bl.endsWith('.md')) allBacklinks.add(bl);
    }
  }

  return JSON.stringify({
    chain: chain,
    links: [...allLinks].sort(),
    backlinks: [...allBacklinks].sort(),
  });
})()
  `.trim();

  try {
    const result = await exec('eval', { code });
    await sendProgress(server, progressToken, 3, 3);
    // eval returns stringified JSON, parse and re-format
    const parsed = JSON.parse(result);
    return JSON.stringify(parsed, null, 2);
  } catch (err) {
    return JSON.stringify({
      error: `research_chain fehlgeschlagen: ${err instanceof Error ? err.message : err}`,
    });
  }
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

async function resolveViaFolder(input: string): Promise<{ name: string; path: string } | null> {
  try {
    const foldersOutput = await exec('folders');
    const allFolders = foldersOutput.split('\n').filter((f) => f && f !== '/');
    const inputLower = input.toLowerCase();

    const matches = allFolders.filter((f) => {
      const last = f.split('/').pop()!.toLowerCase();
      return last.includes(inputLower);
    });

    if (matches.length === 0) return null;

    const folder = matches[0];
    const filesOutput = await exec('files', { folder, ext: 'md' });
    const files = filesOutput.split('\n').filter((f) => f.trim());

    if (files.length === 0) return null;

    const lastFile = files[files.length - 1];
    return await resolveNote(undefined, lastFile);
  } catch {
    return null;
  }
}

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
