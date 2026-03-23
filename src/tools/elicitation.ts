import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ElicitResult } from '@modelcontextprotocol/sdk/types.js';

const ELICITATION_TIMEOUT_MS = 60_000;

/**
 * Try elicitation with a timeout. Returns null if:
 * - Client doesn't support elicitation (error)
 * - Client doesn't respond in time (timeout)
 * - User declines or cancels
 */
export async function tryElicit(
  server: Server,
  params: Parameters<Server['elicitInput']>[0]
): Promise<ElicitResult | null> {
  try {
    const result = await Promise.race([
      server.elicitInput(params),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), ELICITATION_TIMEOUT_MS)
      ),
    ]);

    if (!result || result.action !== 'accept') return null;
    return result;
  } catch {
    return null;
  }
}
