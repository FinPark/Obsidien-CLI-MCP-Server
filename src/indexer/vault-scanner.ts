import fs from 'node:fs';
import path from 'node:path';
import { VAULT_PATH, SKIP_DIRS } from '../config.js';

export interface VaultFile {
  relativePath: string;
  absolutePath: string;
  mtime: number;
}

export function scanVault(): VaultFile[] {
  const files: VaultFile[] = [];
  walkDir(VAULT_PATH, '', files);
  return files;
}

function walkDir(base: string, rel: string, files: VaultFile[]): void {
  const dir = rel ? path.join(base, rel) : base;
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const relPath = rel ? `${rel}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      walkDir(base, relPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      try {
        const stat = fs.statSync(path.join(base, relPath));
        files.push({
          relativePath: relPath,
          absolutePath: path.join(base, relPath),
          mtime: stat.mtimeMs,
        });
      } catch {
        // skip inaccessible files
      }
    }
  }
}

export function getFolder(relativePath: string): string | null {
  const firstSlash = relativePath.indexOf('/');
  if (firstSlash === -1) return null;
  return relativePath.substring(0, firstSlash);
}

export function getTitle(relativePath: string): string {
  const basename = path.basename(relativePath, '.md');
  return basename;
}
