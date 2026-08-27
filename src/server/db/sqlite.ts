import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initializeSecuritySchema } from "./security-schema";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/security-ops.db");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
initializeSecuritySchema(db);
