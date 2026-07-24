import { DatabaseSync } from 'node:sqlite';

// Open or create local SQLite database file using Node.js native SQLite engine
export const sqlite = new DatabaseSync('./pos_local.sqlite');
sqlite.exec('PRAGMA journal_mode = WAL;');
