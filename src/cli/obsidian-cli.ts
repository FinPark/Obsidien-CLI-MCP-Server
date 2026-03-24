import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OBSIDIAN_BIN, VAULT_NAME } from '../config.js';

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

export class ObsidianCLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObsidianCLIError';
  }
}

/** Strip Obsidian startup noise that leaks into stdout */
function stripCliNoise(output: string): string {
  const cleaned = output
    .split('\n')
    .filter((line) => {
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Loading/.test(line)) return false;
      if (line.startsWith('Your Obsidian installer is out of date')) return false;
      return true;
    })
    .join('\n');
  // eval command returns "=> <value>" — strip the prefix
  if (cleaned.startsWith('=>')) {
    return cleaned.slice(2).trim();
  }
  return cleaned;
}

/**
 * Execute an Obsidian CLI command and return stdout.
 *
 * @param command  CLI command (e.g. "search", "tags", "read")
 * @param params   Key-value parameters (e.g. { query: "test", limit: "5" })
 * @param flags    Boolean flags (e.g. ["counts", "verbose"])
 */
export async function exec(
  command: string,
  params: Record<string, string> = {},
  flags: string[] = [],
): Promise<string> {
  const args = [`vault=${VAULT_NAME}`, command];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      args.push(`${key}=${value}`);
    }
  }
  args.push(...flags);

  try {
    const { stdout } = await execFileAsync(OBSIDIAN_BIN, args, {
      timeout: CLI_TIMEOUT,
      maxBuffer: MAX_BUFFER,
    });
    return stripCliNoise(stdout).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ETIMEDOUT') || message.includes('timed out')) {
      throw new ObsidianCLIError('Obsidian CLI timed out. Is Obsidian running?');
    }
    // The CLI writes errors to stdout as "Error: <message>"
    if (message.includes('Error:')) {
      const match = message.match(/Error:\s*(.+)/);
      throw new ObsidianCLIError(match ? match[1].trim() : message);
    }
    throw new ObsidianCLIError(message);
  }
}

/**
 * Execute an Obsidian CLI command and parse the JSON output.
 */
export async function execJson<T = unknown>(
  command: string,
  params: Record<string, string> = {},
  flags: string[] = [],
): Promise<T> {
  const output = await exec(command, { ...params, format: 'json' }, flags);
  if (!output) {
    return [] as unknown as T;
  }
  try {
    return JSON.parse(output) as T;
  } catch {
    throw new ObsidianCLIError(`Failed to parse JSON from "${command}": ${output.slice(0, 200)}`);
  }
}
