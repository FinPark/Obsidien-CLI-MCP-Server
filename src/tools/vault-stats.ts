import { exec, execJson } from '../cli/obsidian-cli.js';

export const vaultStatsSchema = {
  name: 'vault_stats',
  description: 'Get vault overview: name, path, file/folder counts, size, top tags.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export async function handleVaultStats(): Promise<string> {
  const [vaultInfo, tags] = await Promise.all([
    exec('vault'),
    execJson<Array<{ tag: string; count: string }>>('tags', {}, ['counts']),
  ]);

  // Parse vault info (tab-separated key-value lines)
  const vault: Record<string, string> = {};
  for (const line of vaultInfo.split('\n')) {
    const [key, ...rest] = line.split('\t');
    if (key && rest.length > 0) vault[key] = rest.join('\t');
  }

  const topTags = tags
    .sort((a, b) => parseInt(b.count) - parseInt(a.count))
    .slice(0, 20);

  return JSON.stringify({
    name: vault.name,
    path: vault.path,
    files: parseInt(vault.files || '0'),
    folders: parseInt(vault.folders || '0'),
    sizeBytes: parseInt(vault.size || '0'),
    topTags,
  }, null, 2);
}
