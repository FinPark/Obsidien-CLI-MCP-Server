import { exec } from '../cli/obsidian-cli.js';

// ─── list_properties ───

export const listPropertiesSchema = {
  name: 'list_properties',
  description: `List all properties (frontmatter keys) used across the vault, with types and occurrence counts.
Can also show properties for a specific file.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'Show properties for a specific file' },
      path: { type: 'string', description: 'Show properties for a specific path' },
      name: { type: 'string', description: 'Get count for a specific property name' },
      sort: {
        type: 'string',
        enum: ['name', 'count'],
        description: 'Sort by name (default) or count',
      },
      format: {
        type: 'string',
        enum: ['yaml', 'json', 'tsv'],
        description: 'Output format (default: json)',
      },
    },
  },
};

export async function handleListProperties(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};
  const flags: string[] = ['counts'];

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.name) params.name = args.name as string;
  if (args.sort) params.sort = args.sort as string;
  params.format = (args.format as string) || 'json';

  const result = await exec('properties', params, flags);
  return result || '[]';
}

// ─── get_property ───

export const getPropertySchema = {
  name: 'get_property',
  description: `Read a specific property value from a note's frontmatter.
Defaults to the active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Property name to read' },
      file: { type: 'string', description: 'File name' },
      path: { type: 'string', description: 'File path' },
    },
    required: ['name'],
  },
};

export async function handleGetProperty(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = { name: args.name as string };
  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;

  const result = await exec('property:read', params);
  return result || '(leer)';
}

// ─── set_property ───

export const setPropertySchema = {
  name: 'set_property',
  description: `Set a property value on a note's frontmatter.
Creates the property if it doesn't exist. Defaults to active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Property name' },
      value: { type: 'string', description: 'Property value' },
      type: {
        type: 'string',
        enum: ['text', 'list', 'number', 'checkbox', 'date', 'datetime'],
        description: 'Property type (auto-detected if omitted)',
      },
      file: { type: 'string', description: 'File name' },
      path: { type: 'string', description: 'File path' },
    },
    required: ['name', 'value'],
  },
};

export async function handleSetProperty(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {
    name: args.name as string,
    value: args.value as string,
  };
  if (args.type) params.type = args.type as string;
  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;

  const result = await exec('property:set', params);
  return result || `Property "${params.name}" gesetzt.`;
}

// ─── remove_property ───

export const removePropertySchema = {
  name: 'remove_property',
  description: `Remove a property from a note's frontmatter.
Defaults to active file if no file/path is specified.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Property name to remove' },
      file: { type: 'string', description: 'File name' },
      path: { type: 'string', description: 'File path' },
    },
    required: ['name'],
  },
};

export async function handleRemoveProperty(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = { name: args.name as string };
  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;

  const result = await exec('property:remove', params);
  return result || `Property "${params.name}" entfernt.`;
}
