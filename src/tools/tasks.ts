import { exec } from '../cli/obsidian-cli.js';

// ─── list_tasks ───

export const listTasksSchema = {
  name: 'list_tasks',
  description: `List tasks in the vault or a specific file.
Returns tasks with their status, text, file path and line number.
Supports filtering by status (todo/done), file, folder, or daily note.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'Filter by file name' },
      path: { type: 'string', description: 'Filter by file path' },
      status: {
        type: 'string',
        enum: ['todo', 'done', 'all'],
        description: 'Filter: "todo" (incomplete), "done" (completed), "all" (default: all)',
      },
      daily: { type: 'boolean', description: 'Show tasks from today\'s daily note' },
      verbose: { type: 'boolean', description: 'Group by file with line numbers' },
      format: {
        type: 'string',
        enum: ['text', 'json', 'tsv', 'csv'],
        description: 'Output format (default: text)',
      },
    },
  },
};

export async function handleListTasks(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};
  const flags: string[] = [];

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.format) params.format = args.format as string;

  const status = args.status as string | undefined;
  if (status === 'todo') flags.push('todo');
  else if (status === 'done') flags.push('done');

  if (args.daily) flags.push('daily');
  if (args.verbose) flags.push('verbose');

  const result = await exec('tasks', params, flags);
  return result || 'Keine Tasks gefunden.';
}

// ─── toggle_task ───

export const toggleTaskSchema = {
  name: 'toggle_task',
  description: `Show, toggle, or update a task's status.
Identify a task by file+line or ref (path:line). Can toggle, mark done/todo, or set a custom status character.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File name containing the task' },
      path: { type: 'string', description: 'File path containing the task' },
      line: { type: 'number', description: 'Line number of the task' },
      ref: { type: 'string', description: 'Task reference as "path:line" (alternative to file+line)' },
      action: {
        type: 'string',
        enum: ['toggle', 'done', 'todo'],
        description: 'Action to perform (default: toggle)',
      },
      status: { type: 'string', description: 'Set a custom status character (e.g. "-", "?", "/")' },
      daily: { type: 'boolean', description: 'Target task in today\'s daily note' },
    },
  },
};

export async function handleToggleTask(args: Record<string, unknown>): Promise<string> {
  const params: Record<string, string> = {};
  const flags: string[] = [];

  if (args.file) params.file = args.file as string;
  if (args.path) params.path = args.path as string;
  if (args.line) params.line = String(args.line);
  if (args.ref) params.ref = args.ref as string;
  if (args.status) params.status = args.status as string;

  const action = (args.action as string) || 'toggle';
  flags.push(action);

  if (args.daily) flags.push('daily');

  const result = await exec('task', params, flags);
  return result || 'Task aktualisiert.';
}
