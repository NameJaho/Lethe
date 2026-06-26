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
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");

const createSecretMessagesTableSql = `
  CREATE TABLE IF NOT EXISTS secret_messages (
    id TEXT PRIMARY KEY,
    pickupCode TEXT UNIQUE,
    requirePickupCode INTEGER NOT NULL DEFAULT 1,
    encryptedContent TEXT NOT NULL,
    encryptionSalt TEXT NOT NULL,
    encryptionIv TEXT NOT NULL,
    encryptionTag TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    burnAfterRead INTEGER NOT NULL DEFAULT 0,
    readAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_secret_messages_expiresAt
    ON secret_messages (expiresAt);
  CREATE INDEX IF NOT EXISTS idx_secret_messages_requirePickupCode
    ON secret_messages (requirePickupCode);
`;

function tableExists() {
  return Boolean(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'secret_messages'")
      .get()
  );
}

function tableInfo(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

if (!tableExists()) {
  db.exec(createSecretMessagesTableSql);
} else {
  const columns = tableInfo("secret_messages");
  const columnNames = new Set(columns.map((column) => column.name));
  const pickupCodeColumn = columns.find((column) => column.name === "pickupCode");
  const alreadyEncrypted =
    columnNames.has("encryptedContent") &&
    columnNames.has("encryptionSalt") &&
    columnNames.has("encryptionIv") &&
    columnNames.has("encryptionTag") &&
    columnNames.has("requirePickupCode") &&
    pickupCodeColumn?.notnull === 0 &&
    !columnNames.has("content");

  if (alreadyEncrypted) {
    db.exec(createSecretMessagesTableSql);
  } else {
    const legacyTable = `secret_messages_legacy_${Date.now()}`;
    db.exec(`
      ALTER TABLE secret_messages RENAME TO ${legacyTable};
      ${createSecretMessagesTableSql}
    `);

    const legacyColumns = new Set(tableInfo(legacyTable).map((column) => column.name));
    if (
      legacyColumns.has("encryptedContent") &&
      legacyColumns.has("encryptionSalt") &&
      legacyColumns.has("encryptionIv") &&
      legacyColumns.has("encryptionTag")
    ) {
      db.exec(`
        INSERT INTO secret_messages (
          id, pickupCode, requirePickupCode, encryptedContent, encryptionSalt, encryptionIv,
          encryptionTag, passwordHash, expiresAt, burnAfterRead, readAt, createdAt, updatedAt
        )
        SELECT
          id, pickupCode,
          CASE WHEN pickupCode IS NULL THEN 0 ELSE 1 END,
          encryptedContent, encryptionSalt, encryptionIv, encryptionTag, passwordHash,
          expiresAt, burnAfterRead, readAt, createdAt, updatedAt
        FROM ${legacyTable}
        WHERE encryptedContent IS NOT NULL;
      `);
    }

    db.exec(`DROP TABLE ${legacyTable};`);
    db.exec(createSecretMessagesTableSql);
  }
}
db.close();

console.log(`Database ready at ${filePath}`);
