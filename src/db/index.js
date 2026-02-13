import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { CONFIG } from '../utils/config.js';
import { createTables } from './schema.js';

let db = null;

export function getDb() {
  if (!db) {
    mkdirSync(dirname(CONFIG.dbPath), { recursive: true });
    db = new Database(CONFIG.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createTables(db);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
