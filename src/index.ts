import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from './server.js';
import { buildIndex } from './indexer/indexer.js';
import { startWatcher } from './indexer/watcher.js';
import { closeDb } from './database/db.js';

const PORT = parseInt(process.env.PORT || '8201', 10);

async function main(): Promise<void> {
  // Always run delta index: skips unchanged files (mtime check), picks up changes and deletions
  console.error('[obsidian-mcp] Building index (delta)...');
  const result = buildIndex();
  console.error(`[obsidian-mcp] Index ready: ${result.indexed} indexed, ${result.skipped} unchanged, ${result.removed} removed`);

  // Start file watcher
  startWatcher();
  console.error('[obsidian-mcp] File watcher started');

  // Session management: one MCP server + transport per session
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url !== '/mcp') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'GET') {
      // SSE stream for existing session
      if (!sessionId || !transports.has(sessionId)) {
        res.writeHead(400);
        res.end('Invalid or missing session ID');
        return;
      }
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === 'DELETE') {
      // Session termination
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
      } else {
        res.writeHead(400);
        res.end('Invalid session');
      }
      return;
    }

    if (req.method === 'POST') {
      // Parse body
      const body = await readBody(req);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
        return;
      }

      // Existing session
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, parsed);
        return;
      }

      // New session (initialize request)
      if (!sessionId && isInitializeRequest(parsed)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            transports.set(sid, transport);
            console.error(`[obsidian-mcp] Session created: ${sid}`);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            transports.delete(sid);
            console.error(`[obsidian-mcp] Session closed: ${sid}`);
          }
        };

        // Create a new MCP server for this session
        const mcpServer = createServer();
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, parsed);
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID' },
        id: null,
      }));
      return;
    }

    res.writeHead(405);
    res.end('Method not allowed');
  });

  httpServer.listen(PORT, () => {
    console.error(`[obsidian-mcp] StreamableHTTP server running on http://localhost:${PORT}/mcp`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.error('[obsidian-mcp] Shutting down...');
    for (const [sid, transport] of transports) {
      transport.close();
      transports.delete(sid);
    }
    httpServer.close();
    closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

main().catch((err) => {
  console.error('[obsidian-mcp] Fatal error:', err);
  process.exit(1);
});
