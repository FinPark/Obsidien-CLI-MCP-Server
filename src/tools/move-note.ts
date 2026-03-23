import fs from 'node:fs';
import path from 'node:path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { VAULT_PATH, SKIP_DIRS } from '../config.js';
import { indexSingleFile, removeFile } from '../indexer/indexer.js';
import { tryElicit } from './elicitation.js';

export const moveNoteSchema = {
  name: 'move_note',
  description: `Move an Obsidian note to a different folder within the vault.
Supports smart matching for filename and folders. DO NOT resolve ambiguity yourself — pass the user's
original wording and let this tool handle disambiguation via user interaction.

IMPORTANT: Do NOT call list_folders first to pre-resolve the folder. Just pass the user's folder name directly.
If multiple matches exist, the tool will ask the user to choose.
The tool always asks the user for confirmation before moving.

- filename: partial match (e.g. "Chat" finds "Chat vom 2026-03-23.md")
- sourceFolder: defaults to "📥 Inbox" if omitted
- destinationFolder: user's wording, e.g. "Bewerber", "KI Client", "Projekte"`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string', description: 'Full or partial filename (without .md)' },
      sourceFolder: { type: 'string', description: 'Source folder (default: "📥 Inbox")' },
      destinationFolder: { type: 'string', description: 'Destination folder in the user\'s own words' },
    },
    required: ['filename', 'destinationFolder'],
  },
};

export async function handleMoveNote(args: Record<string, unknown>, server: Server): Promise<string> {
  const filename = args.filename as string;
  const sourceFolder = (args.sourceFolder as string) || '📥 Inbox';
  const destInput = args.destinationFolder as string;
  let userAlreadyInteracted = false;

  // 1. Resolve source folder
  const resolvedSource = resolveFolder(sourceFolder);
  if (resolvedSource.length === 0) {
    return JSON.stringify({ error: `Quellordner nicht gefunden: "${sourceFolder}"` });
  }
  let srcFolder: string;
  if (resolvedSource.length > 1) {
    const picked = await askUserToPick(server, 'folder', resolvedSource,
      `Mehrere Quellordner für "${sourceFolder}" gefunden:`);
    if (!picked) {
      return JSON.stringify({
        error: `Mehrere Quellordner für "${sourceFolder}" gefunden. Bitte genauer angeben:`,
        candidates: resolvedSource,
      }, null, 2);
    }
    srcFolder = picked;
    userAlreadyInteracted = true;
  } else {
    srcFolder = resolvedSource[0];
  }

  // 2. Resolve destination folder
  const resolvedDest = resolveFolder(destInput);
  if (resolvedDest.length === 0) {
    return JSON.stringify({ error: `Zielordner nicht gefunden: "${destInput}"` });
  }
  let dstFolder: string;
  if (resolvedDest.length > 1) {
    const picked = await askUserToPick(server, 'folder', resolvedDest,
      `Mehrere Zielordner für "${destInput}" gefunden:`);
    if (!picked) {
      return JSON.stringify({
        error: `Mehrere Zielordner für "${destInput}" gefunden. Bitte genauer angeben:`,
        candidates: resolvedDest,
      }, null, 2);
    }
    dstFolder = picked;
    userAlreadyInteracted = true;
  } else {
    dstFolder = resolvedDest[0];
  }

  // 3. Find the note file in source folder
  const matchingFiles = findNoteInFolder(srcFolder, filename);
  if (matchingFiles.length === 0) {
    return JSON.stringify({ error: `Keine Notiz mit "${filename}" in "${srcFolder}" gefunden.` });
  }
  let noteFileName: string;
  if (matchingFiles.length > 1) {
    const picked = await askUserToPick(server, 'note', matchingFiles.map(f => f.name),
      `Mehrere Notizen für "${filename}" gefunden:`);
    if (!picked) {
      return JSON.stringify({
        error: `Mehrere Notizen für "${filename}" gefunden. Bitte genauer angeben:`,
        candidates: matchingFiles.map(f => f.name),
      }, null, 2);
    }
    noteFileName = picked;
    userAlreadyInteracted = true;
  } else {
    noteFileName = matchingFiles[0].name;
  }

  const oldRelPath = `${srcFolder}/${noteFileName}`;
  const newRelPath = `${dstFolder}/${noteFileName}`;
  const oldAbsPath = path.join(VAULT_PATH, oldRelPath);
  const newAbsPath = path.join(VAULT_PATH, newRelPath);

  // 4. Check destination doesn't already have this file
  if (fs.existsSync(newAbsPath)) {
    return JSON.stringify({ error: `Datei existiert bereits im Ziel: "${newRelPath}"` });
  }

  // 5. Confirmation — only if user hasn't already interacted via elicitation
  if (!userAlreadyInteracted) {
    const confirmed = await tryElicit(server, {
      mode: 'form',
      message: `Notiz verschieben?\n\n📄 ${noteFileName}\n📂 Von: ${srcFolder}\n📁 Nach: ${dstFolder}`,
      requestedSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            title: 'Verschieben bestätigen',
            description: `"${noteFileName}" → ${dstFolder}`,
            default: true,
          },
        },
      },
    });

    if (confirmed && !confirmed.content?.confirm) {
      return JSON.stringify({ message: 'Verschieben abgebrochen.' });
    }
  }

  // 6. Move the file
  fs.renameSync(oldAbsPath, newAbsPath);

  // 7. Update index
  try {
    removeFile(oldRelPath);
    indexSingleFile(newRelPath);
  } catch {
    // Non-critical
  }

  return JSON.stringify({
    message: 'Notiz verschoben',
    from: oldRelPath,
    to: newRelPath,
  }, null, 2);
}

async function askUserToPick(
  server: Server,
  field: string,
  candidates: string[],
  message: string
): Promise<string | null> {
  const title = field === 'folder' ? 'Ordner auswählen' : 'Notiz auswählen';
  const result = await tryElicit(server, {
    mode: 'form',
    message,
    requestedSchema: {
      type: 'object',
      properties: {
        [field]: {
          type: 'string',
          title,
          oneOf: candidates.map(c => ({
            const: c,
            title: field === 'note' ? c.replace('.md', '') : c,
          })),
        },
      },
      required: [field],
    },
  });
  return (result?.content?.[field] as string) ?? null;
}

function resolveFolder(input: string): string[] {
  const allFolders = scanAllFolders(VAULT_PATH, '', 0);

  // Exact match first
  const exact = allFolders.filter(f => f === input);
  if (exact.length > 0) return exact;

  const inputLower = input.toLowerCase();

  // Match by last path segment (case-insensitive)
  const byLastSegment = allFolders.filter(f => {
    const lastSegment = f.split('/').pop()!.toLowerCase();
    return lastSegment.includes(inputLower);
  });
  if (byLastSegment.length > 0) return byLastSegment;

  // Match full input as substring anywhere in path
  const bySubstring = allFolders.filter(f => f.toLowerCase().includes(inputLower));
  if (bySubstring.length > 0) return bySubstring;

  // Multi-word: ALL words must appear somewhere in the path
  const words = inputLower.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 1) {
    return allFolders.filter(f => {
      const pathLower = f.toLowerCase();
      return words.every(w => pathLower.includes(w));
    });
  }

  return [];
}

function findNoteInFolder(folder: string, filename: string): fs.Dirent[] {
  const absFolder = path.join(VAULT_PATH, folder);
  const filenameLower = filename.toLowerCase();

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absFolder, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.filter(e => {
    if (!e.isFile() || !e.name.endsWith('.md')) return false;
    const nameWithoutExt = e.name.slice(0, -3).toLowerCase();
    return nameWithoutExt.includes(filenameLower);
  });
}

function scanAllFolders(base: string, rel: string, depth: number): string[] {
  if (depth > 5) return [];
  const dir = rel ? path.join(base, rel) : base;
  const result: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;

    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    result.push(relPath);
    result.push(...scanAllFolders(base, relPath, depth + 1));
  }

  return result;
}
