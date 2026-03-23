import { vaultStats } from '../database/queries.js';

export const vaultStatsSchema = {
  name: 'vault_stats',
  description: 'Get vault overview: total notes, date range, top participants, top tags, and folder distribution.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
};

export function handleVaultStats(): string {
  const stats = vaultStats();
  return JSON.stringify(stats, null, 2);
}
