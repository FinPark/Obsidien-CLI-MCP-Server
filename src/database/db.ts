import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      datum DATE,
      uhrzeit TEXT,
      ort TEXT,
      organisator TEXT,
      inhalt TEXT,
      vorausgegangen TEXT,
      body TEXT,
      folder TEXT,
      mtime REAL
    );

    CREATE TABLE IF NOT EXISTS note_participants (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      participant TEXT NOT NULL,
      PRIMARY KEY (note_id, participant)
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (note_id, tag)
    );

    CREATE TABLE IF NOT EXISTS note_art (
      note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
      art TEXT NOT NULL,
      PRIMARY KEY (note_id, art)
    );

    CREATE INDEX IF NOT EXISTS idx_notes_datum ON notes(datum);
    CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder);
    CREATE INDEX IF NOT EXISTS idx_participants_name ON note_participants(participant);
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON note_tags(tag);
  `);

  // Standalone FTS5 table (not content-synced — we manage inserts/deletes ourselves)
  const ftsExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'"
  ).get();

  if (!ftsExists) {
    db.exec(`
      CREATE VIRTUAL TABLE notes_fts USING fts5(
        title, inhalt, body,
        content_rowid=id
      );
    `);
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
