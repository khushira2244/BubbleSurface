import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { initializeSecuritySchema } from "../src/server/db/security-schema";
import { resetDemoState } from "../src/server/seed/reset-demo-state";

if (process.env.NODE_ENV === "production") throw new Error("reset:demo is development/demo tooling and cannot run with NODE_ENV=production.");
const databasePath=resolve(process.env.DATABASE_PATH??"./data/security-ops.db");
mkdirSync(dirname(databasePath),{recursive:true});
const db=new Database(databasePath);
try {
  db.pragma("journal_mode = WAL");initializeSecuritySchema(db);
  console.log(JSON.stringify(resetDemoState(db),null,2));
} finally { db.close(); }
