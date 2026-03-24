import fs from 'node:fs';
import path from 'node:path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { VAULT_PATH } from '../config.js';
import { getDb } from '../database/db.js';
import { indexSingleFile } from '../indexer/indexer.js';
import { tryElicit } from './elicitation.js';

// ─── update_tags: Add/remove tags on specific notes ───

export const updateTagsSchema = {
  name: 'update_tags',
  description: `Add or remove tags on one or more Obsidian notes.
Modifies the YAML frontmatter tags array directly in the .md files.
Tags support hierarchical paths (e.g. "AI/MCP"). Case-sensitive.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      paths: {
        type: 'array', items: { type: 'string' },
        description: 'Relative paths of notes to modify',
      },
      addTags: {
        type: 'array', items: { type: 'string' },
        description: 'Tags to add (e.g. ["AI/MCP", "Knowledge"])',
      },
      removeTags: {
        type: 'array', items: { type: 'string' },
        description: 'Tags to remove',
      },
    },
    required: ['paths'],
  },
};

export function handleUpdateTags(args: Record<string, unknown>): string {
  const paths = args.paths as string[];
  const addTags = (args.addTags as string[]) ?? [];
  const removeTags = (args.removeTags as string[]) ?? [];

  if (addTags.length === 0 && removeTags.length === 0) {
    return JSON.stringify({ error: 'Mindestens addTags oder removeTags angeben.' });
  }

  const results: Array<{ path: string; status: string; tags?: string[] }> = [];

  for (const notePath of paths) {
    const absPath = path.join(VAULT_PATH, notePath);
    if (!fs.existsSync(absPath)) {
      results.push({ path: notePath, status: 'nicht gefunden' });
      continue;
    }

    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const updated = modifyTags(content, addTags, removeTags);
      fs.writeFileSync(absPath, updated.content, 'utf-8');
      indexSingleFile(notePath);
      results.push({ path: notePath, status: 'aktualisiert', tags: updated.tags });
    } catch (err) {
      results.push({ path: notePath, status: `Fehler: ${err instanceof Error ? err.message : err}` });
    }
  }

  return JSON.stringify(results, null, 2);
}

// ─── rename_tag: Rename a tag across all notes ───

export const renameTagSchema = {
  name: 'rename_tag',
  description: `Rename a tag across ALL notes in the vault.
Changes the tag in every note's YAML frontmatter. Use list_tags to see existing tags first.
Example: rename "Analyse" to "Analysis" or "AI" to "AI/General".`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      oldTag: { type: 'string', description: 'Current tag name (exact match)' },
      newTag: { type: 'string', description: 'New tag name' },
    },
    required: ['oldTag', 'newTag'],
  },
};

export async function handleRenameTag(args: Record<string, unknown>, server: Server): Promise<string> {
  const oldTag = args.oldTag as string;
  const newTag = args.newTag as string;
  const db = getDb();

  // Find all notes with this tag
  const notes = db.prepare(
    'SELECT n.path FROM notes n JOIN note_tags t ON t.note_id = n.id WHERE t.tag = ?'
  ).all(oldTag) as Array<{ path: string }>;

  if (notes.length === 0) {
    return JSON.stringify({ error: `Tag "${oldTag}" nicht gefunden.` });
  }

  // Confirm if many notes affected
  if (notes.length > 5) {
    const confirmed = await tryElicit(server, {
      mode: 'form',
      message: `Tag "${oldTag}" → "${newTag}" in ${notes.length} Notizen umbenennen?`,
      requestedSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            title: 'Umbenennung bestätigen',
            description: `${notes.length} Notizen werden geändert`,
            default: true,
          },
        },
      },
    });

    if (confirmed && !confirmed.content?.confirm) {
      return JSON.stringify({ message: 'Umbenennung abgebrochen.' });
    }
  }

  let updated = 0;
  let errors = 0;

  for (const note of notes) {
    const absPath = path.join(VAULT_PATH, note.path);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const result = modifyTags(content, [newTag], [oldTag]);
      fs.writeFileSync(absPath, result.content, 'utf-8');
      indexSingleFile(note.path);
      updated++;
    } catch {
      errors++;
    }
  }

  return JSON.stringify({
    message: `Tag "${oldTag}" → "${newTag}" umbenannt`,
    updated,
    errors,
  }, null, 2);
}

// ─── delete_tag: Remove a tag from all notes ───

export const deleteTagSchema = {
  name: 'delete_tag',
  description: `Delete a tag from ALL notes in the vault.
Removes the tag from every note's YAML frontmatter. The notes themselves are not deleted.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      tag: { type: 'string', description: 'Tag to delete (exact match)' },
    },
    required: ['tag'],
  },
};

export async function handleDeleteTag(args: Record<string, unknown>, server: Server): Promise<string> {
  const tag = args.tag as string;
  const db = getDb();

  const notes = db.prepare(
    'SELECT n.path FROM notes n JOIN note_tags t ON t.note_id = n.id WHERE t.tag = ?'
  ).all(tag) as Array<{ path: string }>;

  if (notes.length === 0) {
    return JSON.stringify({ error: `Tag "${tag}" nicht gefunden.` });
  }

  // Always confirm deletion
  const confirmed = await tryElicit(server, {
    mode: 'form',
    message: `Tag "${tag}" aus ${notes.length} Notizen entfernen?`,
    requestedSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          title: 'Löschung bestätigen',
          description: `"${tag}" wird aus ${notes.length} Notizen entfernt`,
          default: true,
        },
      },
    },
  });

  if (confirmed && !confirmed.content?.confirm) {
    return JSON.stringify({ message: 'Löschung abgebrochen.' });
  }

  let updated = 0;
  let errors = 0;

  for (const note of notes) {
    const absPath = path.join(VAULT_PATH, note.path);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const result = modifyTags(content, [], [tag]);
      fs.writeFileSync(absPath, result.content, 'utf-8');
      indexSingleFile(note.path);
      updated++;
    } catch {
      errors++;
    }
  }

  return JSON.stringify({
    message: `Tag "${tag}" gelöscht`,
    updated,
    errors,
  }, null, 2);
}

// ─── Helper: Modify tags in a markdown file's frontmatter ───

function modifyTags(
  content: string,
  addTags: string[],
  removeTags: string[]
): { content: string; tags: string[] } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — add one with the new tags
    const tags = addTags.filter(t => !removeTags.includes(t));
    const tagsYaml = tags.length > 0
      ? `tags:\n${tags.map(t => `  - ${t}`).join('\n')}`
      : 'tags:';
    return {
      content: `---\n${tagsYaml}\n---\n\n${content}`,
      tags,
    };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  // Parse existing tags from frontmatter
  const existingTags = parseTags(frontmatter);

  // Apply modifications
  const tagSet = new Set(existingTags);
  for (const t of removeTags) tagSet.delete(t);
  for (const t of addTags) tagSet.add(t);
  const newTags = [...tagSet];

  // Replace tags in frontmatter
  const newFrontmatter = replaceTags(frontmatter, newTags);

  return {
    content: `---\n${newFrontmatter}\n---\n${body}`,
    tags: newTags,
  };
}

function parseTags(frontmatter: string): string[] {
  const tags: string[] = [];
  const lines = frontmatter.split('\n');
  let inTags = false;

  for (const line of lines) {
    // Inline array: tags: [tag1, tag2]
    const inlineMatch = line.match(/^tags:\s*\[([^\]]*)\]/);
    if (inlineMatch) {
      return inlineMatch[1].split(',').map(t => t.trim()).filter(t => t.length > 0);
    }

    // Start of tags block
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      continue;
    }

    // tags: with value on same line (single tag)
    const singleMatch = line.match(/^tags:\s+(.+)$/);
    if (singleMatch && !singleMatch[1].startsWith('[')) {
      return [singleMatch[1].trim()];
    }

    if (inTags) {
      const itemMatch = line.match(/^\s+-\s+(.+)$/);
      if (itemMatch) {
        tags.push(itemMatch[1].trim());
      } else if (/^\S/.test(line)) {
        // Next property — tags block ended
        break;
      }
    }
  }

  return tags;
}

function replaceTags(frontmatter: string, newTags: string[]): string {
  const lines = frontmatter.split('\n');
  const result: string[] = [];
  let inTags = false;
  let tagsInserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Inline array: tags: [...]
    if (/^tags:\s*\[/.test(line)) {
      if (newTags.length > 0) {
        result.push('tags:');
        for (const t of newTags) result.push(`  - ${t}`);
      } else {
        result.push('tags:');
      }
      tagsInserted = true;
      continue;
    }

    // Start of tags block or single-value tags
    if (/^tags:/.test(line)) {
      if (newTags.length > 0) {
        result.push('tags:');
        for (const t of newTags) result.push(`  - ${t}`);
      } else {
        result.push('tags:');
      }
      inTags = true;
      tagsInserted = true;
      continue;
    }

    if (inTags) {
      if (/^\s+-\s/.test(line)) {
        // Skip old tag items
        continue;
      }
      // Next property
      inTags = false;
    }

    result.push(line);
  }

  // If no tags field existed, add it
  if (!tagsInserted) {
    result.push('tags:');
    for (const t of newTags) result.push(`  - ${t}`);
  }

  return result.join('\n');
}
