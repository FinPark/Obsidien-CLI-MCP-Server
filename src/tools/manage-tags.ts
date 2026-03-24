import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { exec, execJson } from '../cli/obsidian-cli.js';
import { tryElicit } from './elicitation.js';

// ─── update_tags: Add/remove tags on specific notes ───

export const updateTagsSchema = {
  name: 'update_tags',
  description: `Add or remove tags on one or more Obsidian notes.
Modifies the tags property via Obsidian CLI. Tags support hierarchical paths (e.g. "AI/MCP").`,
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

export async function handleUpdateTags(args: Record<string, unknown>): Promise<string> {
  const paths = args.paths as string[];
  const addTags = (args.addTags as string[]) ?? [];
  const removeTags = (args.removeTags as string[]) ?? [];

  if (addTags.length === 0 && removeTags.length === 0) {
    return JSON.stringify({ error: 'Mindestens addTags oder removeTags angeben.' });
  }

  const results: Array<{ path: string; status: string; tags?: string[] }> = [];

  for (const notePath of paths) {
    try {
      // Read current tags
      let currentTagsRaw: string;
      try {
        currentTagsRaw = await exec('property:read', { name: 'tags', path: notePath });
      } catch {
        currentTagsRaw = '';
      }

      // Parse current tags (could be comma-separated or YAML list format)
      const currentTags = parseTagsOutput(currentTagsRaw);

      // Apply modifications
      const tagSet = new Set(currentTags);
      for (const t of removeTags) tagSet.delete(t);
      for (const t of addTags) tagSet.add(t);
      const newTags = [...tagSet];

      // Set new tags via property:set
      await exec('property:set', {
        name: 'tags',
        value: newTags.join(', '),
        type: 'list',
        path: notePath,
      });

      results.push({ path: notePath, status: 'aktualisiert', tags: newTags });
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

  // Find all files with this tag via CLI
  const tagInfo = await exec('tag', { name: oldTag }, ['verbose']);
  const files = parseTagVerboseOutput(tagInfo);

  if (files.length === 0) {
    return JSON.stringify({ error: `Tag "${oldTag}" nicht gefunden.` });
  }

  // Confirm if many notes affected
  if (files.length > 5) {
    const confirmed = await tryElicit(server, {
      mode: 'form',
      message: `Tag "${oldTag}" → "${newTag}" in ${files.length} Notizen umbenennen?`,
      requestedSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            title: 'Umbenennung bestätigen',
            description: `${files.length} Notizen werden geändert`,
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

  for (const filePath of files) {
    try {
      // Read current tags
      let currentTagsRaw: string;
      try {
        currentTagsRaw = await exec('property:read', { name: 'tags', path: filePath });
      } catch {
        currentTagsRaw = '';
      }
      const currentTags = parseTagsOutput(currentTagsRaw);

      // Replace old tag with new tag
      const tagSet = new Set(currentTags);
      tagSet.delete(oldTag);
      tagSet.add(newTag);
      const newTags = [...tagSet];

      await exec('property:set', {
        name: 'tags',
        value: newTags.join(', '),
        type: 'list',
        path: filePath,
      });
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

  const tagInfo = await exec('tag', { name: tag }, ['verbose']);
  const files = parseTagVerboseOutput(tagInfo);

  if (files.length === 0) {
    return JSON.stringify({ error: `Tag "${tag}" nicht gefunden.` });
  }

  // Always confirm deletion
  const confirmed = await tryElicit(server, {
    mode: 'form',
    message: `Tag "${tag}" aus ${files.length} Notizen entfernen?`,
    requestedSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          title: 'Löschung bestätigen',
          description: `"${tag}" wird aus ${files.length} Notizen entfernt`,
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

  for (const filePath of files) {
    try {
      let currentTagsRaw: string;
      try {
        currentTagsRaw = await exec('property:read', { name: 'tags', path: filePath });
      } catch {
        currentTagsRaw = '';
      }
      const currentTags = parseTagsOutput(currentTagsRaw);

      const tagSet = new Set(currentTags);
      tagSet.delete(tag);
      const newTags = [...tagSet];

      await exec('property:set', {
        name: 'tags',
        value: newTags.join(', '),
        type: 'list',
        path: filePath,
      });
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

// ─── Helpers ───

function parseTagsOutput(output: string): string[] {
  if (!output.trim()) return [];
  // Output could be: "tag1, tag2, tag3" or "tag1\ntag2\ntag3" or single value
  if (output.includes(',')) {
    return output.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  }
  return output.split('\n').map((t) => t.trim()).filter((t) => t.length > 0);
}

function parseTagVerboseOutput(output: string): string[] {
  // verbose output lists file paths, one per line
  // First line might be count info, rest are paths
  const lines = output.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  // Filter out lines that look like counts/stats and keep file paths
  return lines.filter((l) => l.includes('.md') || l.includes('/'));
}
