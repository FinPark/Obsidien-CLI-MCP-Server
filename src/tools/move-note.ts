import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { exec } from '../cli/obsidian-cli.js';
import { tryElicit } from './elicitation.js';

export const moveNoteSchema = {
  name: 'move_note',
  description: `Move an Obsidian note to a different folder within the vault.
Supports smart matching for filename and folders. DO NOT resolve ambiguity yourself — pass the user's
original wording and let this tool handle disambiguation via user interaction.

IMPORTANT: Do NOT call list_folders first to pre-resolve the folder. Just pass the user's folder name directly.
If multiple matches exist, the tool will ask the user to choose.
The tool always asks the user for confirmation before moving.

Uses Obsidian CLI's move command which automatically updates all internal links.

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

  // 1. Resolve destination folder via CLI folders listing
  const foldersOutput = await exec('folders');
  const allFolders = foldersOutput.split('\n').filter((f) => f && f !== '/');

  const resolvedDest = resolveFolder(allFolders, destInput);
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

  // 2. Find the note file in source folder
  const filesOutput = await exec('files', { folder: sourceFolder, ext: 'md' });
  const filesInFolder = filesOutput.split('\n').filter((f) => f.trim());
  const filenameLower = filename.toLowerCase();
  const matchingFiles = filesInFolder.filter((f) => {
    const name = f.split('/').pop()?.replace('.md', '').toLowerCase() ?? '';
    return name.includes(filenameLower);
  });

  if (matchingFiles.length === 0) {
    return JSON.stringify({ error: `Keine Notiz mit "${filename}" in "${sourceFolder}" gefunden.` });
  }
  let notePath: string;
  if (matchingFiles.length > 1) {
    const picked = await askUserToPick(server, 'note',
      matchingFiles.map((f) => f.split('/').pop() ?? f),
      `Mehrere Notizen für "${filename}" gefunden:`);
    if (!picked) {
      return JSON.stringify({
        error: `Mehrere Notizen für "${filename}" gefunden. Bitte genauer angeben:`,
        candidates: matchingFiles,
      }, null, 2);
    }
    notePath = matchingFiles.find((f) => f.endsWith(picked)) ?? matchingFiles[0];
    userAlreadyInteracted = true;
  } else {
    notePath = matchingFiles[0];
  }

  const noteFileName = notePath.split('/').pop() ?? notePath;
  const newPath = `${dstFolder}/${noteFileName}`;

  // 3. Confirmation
  if (!userAlreadyInteracted) {
    const confirmed = await tryElicit(server, {
      mode: 'form',
      message: `Notiz verschieben?\n\n${noteFileName}\nVon: ${sourceFolder}\nNach: ${dstFolder}`,
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

  // 4. Move via CLI (automatically updates internal links)
  const result = await exec('move', { path: notePath, to: newPath });

  return JSON.stringify({
    message: 'Notiz verschoben',
    from: notePath,
    to: newPath,
    cliOutput: result,
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

function resolveFolder(allFolders: string[], input: string): string[] {
  // Exact match first
  const exact = allFolders.filter(f => f === input);
  if (exact.length > 0) return exact;

  const inputLower = input.toLowerCase();

  // Match by last path segment
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
