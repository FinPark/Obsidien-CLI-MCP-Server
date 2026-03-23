import { watch, type FSWatcher } from 'chokidar';
import path from 'node:path';
import { VAULT_PATH, SKIP_DIRS } from '../config.js';
import { indexSingleFile, removeFile } from './indexer.js';

let watcher: FSWatcher | null = null;

export function startWatcher(): void {
  if (watcher) return;

  const ignoredPatterns = [...SKIP_DIRS].map(dir => path.join(VAULT_PATH, dir, '**'));

  watcher = watch(VAULT_PATH, {
    ignored: [
      ...ignoredPatterns,
      /(^|[/\\])\./,
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath: string) => handleFileChange(filePath));
  watcher.on('change', (filePath: string) => handleFileChange(filePath));
  watcher.on('unlink', (filePath: string) => handleFileRemove(filePath));
}

function handleFileChange(absolutePath: string): void {
  if (!absolutePath.endsWith('.md')) return;
  const relativePath = path.relative(VAULT_PATH, absolutePath);
  try {
    indexSingleFile(relativePath);
  } catch (err) {
    console.error(`[watcher] Error indexing ${relativePath}:`, err);
  }
}

function handleFileRemove(absolutePath: string): void {
  if (!absolutePath.endsWith('.md')) return;
  const relativePath = path.relative(VAULT_PATH, absolutePath);
  try {
    removeFile(relativePath);
  } catch (err) {
    console.error(`[watcher] Error removing ${relativePath}:`, err);
  }
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
