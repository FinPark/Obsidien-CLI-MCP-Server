import { exec } from '../cli/obsidian-cli.js';

export async function handleListResources() {
  const filesOutput = await exec('files', { ext: 'md' });
  const files = filesOutput.split('\n').filter(Boolean);

  return {
    resources: files.map((path) => ({
      uri: `obsidian://note/${path}`,
      name: path.split('/').pop()?.replace(/\.md$/, '') ?? path,
      mimeType: 'text/markdown',
    })),
  };
}

export async function handleReadResource(uri: string) {
  const path = uri.replace('obsidian://note/', '');
  const content = await exec('read', { path });
  return {
    contents: [{ uri, mimeType: 'text/markdown', text: content }],
  };
}
