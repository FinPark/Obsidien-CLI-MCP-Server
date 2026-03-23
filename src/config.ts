import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VAULT_PATH = process.env.VAULT_PATH
  || '/Users/aFinken/Library/Mobile Documents/iCloud~md~obsidian/Documents/vault_arbeit';

export const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', 'data', 'obsidian.db');

export const SKIP_DIRS = new Set([
  '.obsidian',
  '.smart-env',
  '.trash',
  '.claude',
  '.makemd',
  '.space',
  '.smtcmp_json_db',
  'Excalidraw',
  'attachments',
  '📂 Vorlagen',
]);
