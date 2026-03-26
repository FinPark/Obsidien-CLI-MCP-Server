/**
 * Formats a vault-relative note path as a clickable obsidian:// deep link.
 * The .md extension is stripped from the display label but kept (encoded) in the URL.
 */
export function formatObsidianLink(path: string, vaultName: string, title?: string): string {
  const encodedVault = encodeURIComponent(vaultName);
  const encodedPath = path.split('/').map(encodeURIComponent).join('%2F');
  const label = title ?? path.split('/').pop()?.replace(/\.md$/, '') ?? path;
  return `[${label}](obsidian://open?vault=${encodedVault}&file=${encodedPath})`;
}

/**
 * Generates the system-level formatting instructions for the AI client,
 * with the actual vault name baked in.
 */
export function generateLinkInstructions(vaultName: string): string {
  const encodedVault = encodeURIComponent(vaultName);
  return `Wenn du Obsidian-Notizen in deiner Antwort referenzierst oder verlinkst, \
formatiere jeden Notiz-Pfad als klickbaren Markdown-Link:

[Titel der Notiz](obsidian://open?vault=${encodedVault}&file=PFAD_URL_ENCODED)

Beispiel:
- Pfad: "Projekte/AI/Kickoff.md"
- Link: [Kickoff](obsidian://open?vault=${encodedVault}&file=Projekte%2FAI%2FKickoff.md)

Regeln:
- Vault-Name: "${vaultName}"
- Pfad URL-enkodiert: / → %2F, Leerzeichen → %20
- .md-Endung weglassen im Link-Text, im Pfad aber URL-enkodiert mitlesen
- Immer den Dateinamen ohne Ordnerpfad als Link-Text verwenden`;
}
