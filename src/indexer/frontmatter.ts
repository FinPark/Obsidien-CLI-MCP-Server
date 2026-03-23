import matter from 'gray-matter';

export interface ParsedNote {
  datum: string | null;
  uhrzeit: string | null;
  ort: string | null;
  organisator: string | null;
  teilnehmer: string[];
  tags: string[];
  art: string[];
  inhalt: string | null;
  vorausgegangen: string | null;
  body: string;
}

export function parseFrontmatter(content: string): ParsedNote {
  let data: Record<string, unknown> = {};
  let body = content;

  try {
    const result = matter(content);
    data = result.data;
    body = result.content;
  } catch {
    // YAML parse error — try to salvage by extracting frontmatter manually
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      body = fmMatch[2];
      // Try line-by-line extraction for key fields
      const lines = fmMatch[1].split('\n');
      data = extractFieldsManually(lines);
    }
  }

  return {
    datum: normalizeDate(data.Datum ?? data.datum),
    uhrzeit: normalizeTime(data.Uhrzeit ?? data.uhrzeit),
    ort: asString(data.Ort ?? data.ort),
    organisator: asString(data.Organisator ?? data.organisator),
    teilnehmer: asStringArray(data.Teilnehmer ?? data.teilnehmer),
    tags: asStringArray(data.tags ?? data.Tags),
    art: asStringArray(data.Art ?? data.art),
    inhalt: asString(data.Inhalt ?? data.inhalt),
    vorausgegangen: asString(data.Vorausgegangen ?? data.vorausgegangen),
    body: body.trim(),
  };
}

function extractFieldsManually(lines: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let currentKey = '';
  let currentList: string[] | null = null;

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentKey) {
      if (!currentList) currentList = [];
      currentList.push(listItem[1].trim());
      continue;
    }

    // Save previous list
    if (currentList && currentKey) {
      data[currentKey] = currentList;
      currentList = null;
    }

    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value) {
        data[currentKey] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Save trailing list
  if (currentList && currentKey) {
    data[currentKey] = currentList;
  }

  return data;
}

function normalizeTime(value: unknown): string | null {
  if (value == null || value === '') return null;

  // If it's a number, YAML parsed "10:00" as minutes since midnight (60*h + m)
  if (typeof value === 'number') {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const str = String(value).trim();

  // Already HH:mm format
  if (/^\d{1,2}:\d{2}$/.test(str)) return str;

  // Pure number as string (same conversion)
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    const hours = Math.floor(num / 60);
    const minutes = num % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return str;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  // Match YYYY-MM-DD
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function asString(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).trim();
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(v => v.length > 0);
  }
  const str = String(value).trim();
  if (str.length === 0) return [];
  return [str];
}
