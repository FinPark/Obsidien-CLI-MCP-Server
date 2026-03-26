import { VAULT_NAME } from '../config.js';
import { generateLinkInstructions } from '../utils/obsidian-links.js';

export const PROMPTS = [
  {
    name: 'link-format-instructions',
    description: 'Injiziert Formatierungsregeln für klickbare Obsidian-Links (obsidian://). Vault-Name wird automatisch ermittelt.',
    arguments: [],
  },
  {
    name: 'meeting-summary',
    description: 'Schreibt eine prägnante Zusammenfassung einer Meeting-Note',
    arguments: [
      { name: 'note_path', description: 'Vault-relativer Pfad der Note', required: true },
    ],
  },
  {
    name: 'research-topic',
    description: 'Erstellt einen strukturierten Überblick über die gesamte Themenhistorie via research_chain',
    arguments: [
      { name: 'note_file', description: 'Dateiname der Startnotiz', required: true },
      { name: 'depth', description: 'Tiefe der Analyse (full/short)', required: false },
    ],
  },
  {
    name: 'daily-review',
    description: 'Zeigt die heutige Daily Note und alle offenen Tasks',
    arguments: [],
  },
  {
    name: 'link-suggestions',
    description: 'Analysiert Links und schlägt noch nicht verlinkte thematisch passende Notes vor',
    arguments: [
      { name: 'note_path', description: 'Vault-relativer Pfad der Note', required: true },
    ],
  },
];

export function getPromptMessages(name: string, args: Record<string, string>) {
  switch (name) {
    case 'link-format-instructions': {
      return [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: generateLinkInstructions(VAULT_NAME),
          },
        },
      ];
    }

    case 'meeting-summary':
      return [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Lies die Note ${args.note_path} und schreibe eine prägnante Zusammenfassung der besprochenen Themen, Entscheidungen und nächsten Schritte.`,
          },
        },
      ];

    case 'research-topic': {
      const depth = args.depth || 'full';
      return [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Nutze research_chain für die Note ${args.note_file} und gib mir einen strukturierten Überblick über die gesamte Themenhistorie. Tiefe: ${depth}.`,
          },
        },
      ];
    }

    case 'daily-review':
      return [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: 'Zeige mir die heutige Daily Note und alle offenen Tasks aus dem Vault. Fasse den Tag zusammen.',
          },
        },
      ];

    case 'link-suggestions':
      return [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Analysiere die Note ${args.note_path} mit list_links und list_backlinks. Schlage 3-5 thematisch passende Notes vor, die noch nicht verlinkt sind.`,
          },
        },
      ];

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
