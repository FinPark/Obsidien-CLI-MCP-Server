import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { searchNotesSchema, handleSearchNotes } from './tools/search-notes.js';
import { readNoteSchema, handleReadNote } from './tools/read-note.js';
import { listParticipantsSchema, handleListParticipants } from './tools/list-participants.js';
import { listTagsSchema, handleListTags } from './tools/list-tags.js';
import { vaultStatsSchema, handleVaultStats } from './tools/vault-stats.js';
import { rebuildIndexSchema, handleRebuildIndex } from './tools/rebuild-index.js';
import { createNoteSchema, handleCreateNote } from './tools/create-note.js';
import { listFoldersSchema, handleListFolders } from './tools/list-folders.js';
import { moveNoteSchema, handleMoveNote } from './tools/move-note.js';

export type ToolHandler = (args: Record<string, unknown>, server: Server) => string | Promise<string>;

const tools = [
  searchNotesSchema,
  readNoteSchema,
  listParticipantsSchema,
  listTagsSchema,
  vaultStatsSchema,
  rebuildIndexSchema,
  createNoteSchema,
  listFoldersSchema,
  moveNoteSchema,
];

const handlers: Record<string, ToolHandler> = {
  search_notes: handleSearchNotes,
  read_note: handleReadNote,
  list_participants: handleListParticipants,
  list_tags: handleListTags,
  vault_stats: handleVaultStats,
  rebuild_index: handleRebuildIndex,
  create_note: handleCreateNote,
  list_folders: handleListFolders,
  move_note: handleMoveNote,
};

export function createServer(): Server {
  const server = new Server(
    { name: 'obsidian-vault', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name];

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await handler(args ?? {}, server);
      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
