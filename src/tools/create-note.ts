import fs from 'node:fs';
import path from 'node:path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { VAULT_PATH } from '../config.js';
import { indexSingleFile } from '../indexer/indexer.js';
import { tryElicit } from './elicitation.js';

export const createNoteSchema = {
  name: 'create_note',
  description: `Create a new Obsidian note in the 📥 Inbox folder.
Asks the user for title, summary, participants, and tags via a form.
Empty fields use defaults (title: "Chat vom <today>", teilnehmer: "André Finken", tags: "Knowledge").
The content parameter contains the note body (markdown).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: { type: 'string', description: 'The note body content (markdown)' },
    },
    required: ['content'],
  },
};

export async function handleCreateNote(args: Record<string, unknown>, server: Server): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const content = args.content as string;

  let title = `Chat vom ${today}`;
  let inhalt = '';
  let teilnehmer = ['André Finken'];
  let tags = ['Knowledge'];

  // Ask user for metadata via elicitation (falls back to defaults on timeout/error)
  const elicit = await tryElicit(server, {
    mode: 'form',
    message: 'Neue Notiz erstellen — Felder ausfüllen oder leer lassen für Defaults:',
    requestedSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          title: 'Notizname',
          description: `Dateiname ohne .md (Default: "${title}")`,
        },
        inhalt: {
          type: 'string',
          title: 'Inhalt (Zusammenfassung)',
          description: 'Kurze Beschreibung für das Frontmatter-Feld "Inhalt"',
        },
        teilnehmer: {
          type: 'string',
          title: 'Teilnehmer',
          description: 'Komma-getrennt (Default: "André Finken")',
        },
        tags: {
          type: 'string',
          title: 'Tags',
          description: 'Komma-getrennt (Default: "Knowledge")',
        },
      },
    },
  });

  if (elicit?.content) {
    const c = elicit.content;
    if (c.title && (c.title as string).trim()) {
      title = (c.title as string).trim();
    }
    if (c.inhalt && (c.inhalt as string).trim()) {
      inhalt = (c.inhalt as string).trim();
    }
    if (c.teilnehmer && (c.teilnehmer as string).trim()) {
      teilnehmer = (c.teilnehmer as string).split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
    if (c.tags && (c.tags as string).trim()) {
      tags = (c.tags as string).split(',').map(t => t.trim()).filter(t => t.length > 0);
    }
  }

  // Build frontmatter
  const teilnehmerYaml = teilnehmer.map(t => `  - ${t}`).join('\n');
  const tagsYaml = tags.map(t => `  - ${t}`).join('\n');

  const note = `---
Datum: ${today}
Teilnehmer:
${teilnehmerYaml}
tags:
${tagsYaml}
Inhalt: ${inhalt}
---

${content}
`;

  // Ensure unique filename
  const inboxDir = path.join(VAULT_PATH, '📥 Inbox');
  let filename = `${title}.md`;
  let filePath = path.join(inboxDir, filename);
  let counter = 1;
  while (fs.existsSync(filePath)) {
    filename = `${title} (${counter}).md`;
    filePath = path.join(inboxDir, filename);
    counter++;
  }

  fs.writeFileSync(filePath, note, 'utf-8');

  // Update index
  const relativePath = `📥 Inbox/${filename}`;
  try {
    indexSingleFile(relativePath);
  } catch {
    // Index update is non-critical
  }

  return JSON.stringify({
    message: 'Notiz erstellt',
    path: relativePath,
    title: filename.replace('.md', ''),
  }, null, 2);
}
