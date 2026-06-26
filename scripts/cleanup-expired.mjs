import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const url = process.env.DATABASE_URL ?? "file:./data/lethe.db";

if (!url.startsWith("file:")) {
  throw new Error("Only SQLite file DATABASE_URL values are supported.");
}

const rawPath = url.slice("file:".length);
const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

mkdirSync(path.dirname(filePath), { recursive: true });

const db = new DatabaseSync(filePath);
db.exec("PRAGMA busy_timeout = 5000;");
const result = db
  .prepare("DELETE FROM secret_messages WHERE expiresAt <= ?")
  .run(new Date().toISOString());
db.close();

console.log(`Deleted ${result.changes} expired message(s).`);
