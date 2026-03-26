import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { handleListResources, handleReadResource } from './resources/notes.js';
import { PROMPTS, getPromptMessages } from './prompts/index.js';

import { searchNotesSchema, handleSearchNotes } from './tools/search-notes.js';
import { readNoteSchema, handleReadNote } from './tools/read-note.js';
import { listParticipantsSchema, handleListParticipants } from './tools/list-participants.js';
import { listTagsSchema, handleListTags } from './tools/list-tags.js';
import { vaultStatsSchema, handleVaultStats } from './tools/vault-stats.js';
import { createNoteSchema, handleCreateNote } from './tools/create-note.js';
import { listFoldersSchema, handleListFolders } from './tools/list-folders.js';
import { moveNoteSchema, handleMoveNote } from './tools/move-note.js';
import { updateTagsSchema, handleUpdateTags, renameTagSchema, handleRenameTag, deleteTagSchema, handleDeleteTag } from './tools/manage-tags.js';
import { listTasksSchema, handleListTasks, toggleTaskSchema, handleToggleTask } from './tools/tasks.js';
import { listBacklinksSchema, handleListBacklinks, listLinksSchema, handleListLinks, listOrphansSchema, handleListOrphans, listDeadendsSchema, handleListDeadends, listUnresolvedSchema, handleListUnresolved } from './tools/links.js';
import { listPropertiesSchema, handleListProperties, getPropertySchema, handleGetProperty, setPropertySchema, handleSetProperty, removePropertySchema, handleRemoveProperty } from './tools/properties.js';
import { getOutlineSchema, handleGetOutline } from './tools/outline.js';
import { appendNoteSchema, handleAppendNote, prependNoteSchema, handlePrependNote, renameNoteSchema, handleRenameNote, deleteNoteSchema, handleDeleteNote, fileInfoSchema, handleFileInfo, listFilesSchema, handleListFiles, listRecentsSchema, handleListRecents } from './tools/note-management.js';
import { researchChainSchema, handleResearchChain } from './tools/research-chain.js';

export type ProgressContext = {
  progressToken?: string | number;
  requestId?: string | number;
};

export type ToolHandler = (args: Record<string, unknown>, server: Server, progress?: ProgressContext) => string | Promise<string>;

const tools = [
  searchNotesSchema,
  readNoteSchema,
  listParticipantsSchema,
  listTagsSchema,
  vaultStatsSchema,
  createNoteSchema,
  listFoldersSchema,
  moveNoteSchema,
  updateTagsSchema,
  renameTagSchema,
  deleteTagSchema,
  // Tasks
  listTasksSchema,
  toggleTaskSchema,
  // Links
  listBacklinksSchema,
  listLinksSchema,
  listOrphansSchema,
  listDeadendsSchema,
  listUnresolvedSchema,
  // Properties
  listPropertiesSchema,
  getPropertySchema,
  setPropertySchema,
  removePropertySchema,
  // Outline
  getOutlineSchema,
  // Note Management
  appendNoteSchema,
  prependNoteSchema,
  renameNoteSchema,
  deleteNoteSchema,
  fileInfoSchema,
  listFilesSchema,
  listRecentsSchema,
  // Research
  researchChainSchema,
];

const handlers: Record<string, ToolHandler> = {
  search_notes: handleSearchNotes,
  read_note: handleReadNote,
  list_participants: handleListParticipants,
  list_tags: handleListTags,
  vault_stats: handleVaultStats,
  create_note: handleCreateNote,
  list_folders: handleListFolders,
  move_note: handleMoveNote,
  update_tags: handleUpdateTags,
  rename_tag: handleRenameTag,
  delete_tag: handleDeleteTag,
  // Tasks
  list_tasks: handleListTasks,
  toggle_task: handleToggleTask,
  // Links
  list_backlinks: handleListBacklinks,
  list_links: handleListLinks,
  list_orphans: handleListOrphans,
  list_deadends: handleListDeadends,
  list_unresolved: handleListUnresolved,
  // Properties
  list_properties: handleListProperties,
  get_property: handleGetProperty,
  set_property: handleSetProperty,
  remove_property: handleRemoveProperty,
  // Outline
  get_outline: handleGetOutline,
  // Note Management
  append_note: handleAppendNote,
  prepend_note: handlePrependNote,
  rename_note: handleRenameNote,
  delete_note: handleDeleteNote,
  file_info: handleFileInfo,
  list_files: handleListFiles,
  list_recents: handleListRecents,
  // Research
  research_chain: handleResearchChain,
};

export function createServer(): Server {
  const server = new Server(
    { name: 'obsidian-vault', version: '2.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name];

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const meta = request.params._meta as Record<string, unknown> | undefined;
      const progress: ProgressContext = {
        progressToken: meta?.progressToken as string | number | undefined,
        requestId: extra.requestId,
      };
      const result = await handler(args ?? {}, server, progress);
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

  // Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return handleListResources();
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return handleReadResource(request.params.uri);
  });

  // Prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;
    const args = (promptArgs ?? {}) as Record<string, string>;
    const messages = getPromptMessages(name, args);
    return { messages };
  });

  return server;
}
