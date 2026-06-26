import { mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DatabaseSync } from "node:sqlite";

export type SecretMessage = {
  id: string;
  pickupCode: string | null;
  requirePickupCode: boolean;
  encryptedContent: string;
  encryptionSalt: string;
  encryptionIv: string;
  encryptionTag: string;
  passwordHash: string;
  expiresAt: Date;
  burnAfterRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRow = {
  id: string;
  pickupCode: string | null;
  requirePickupCode: number;
  encryptedContent: string;
  encryptionSalt: string;
  encryptionIv: string;
  encryptionTag: string;
  passwordHash: string;
  expiresAt: string;
  burnAfterRead: number;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const globalForDb = globalThis as unknown as {
  letheDb?: DatabaseSync;
};

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

function databasePath() {
  const url = process.env.DATABASE_URL ?? "file:./data/lethe.db";

  if (!url.startsWith("file:")) {
    throw new Error("Only SQLite file DATABASE_URL values are supported.");
  }

  const filePath = url.slice("file:".length);
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

export function initializeDatabase() {
  const filePath = databasePath();
  mkdirSync(path.dirname(filePath), { recursive: true });

  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrateSecretMessages(db);

  return db;
}

function tableExists(db: DatabaseSync) {
  return Boolean(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'secret_messages'")
      .get()
  );
}

function tableColumns(db: DatabaseSync) {
  return db.prepare("PRAGMA table_info(secret_messages)").all() as Array<{
    name: string;
    notnull: number;
  }>;
}

function migrateSecretMessages(db: DatabaseSync) {
  if (!tableExists(db)) {
    db.exec(createSecretMessagesTableSql);
    return;
  }

  const columns = tableColumns(db);
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
    return;
  }

  const legacyTable = `secret_messages_legacy_${Date.now()}`;
  db.exec(`
    ALTER TABLE secret_messages RENAME TO ${legacyTable};
    ${createSecretMessagesTableSql}
  `);

  const legacyColumns = new Set(tableInfoFor(db, legacyTable).map((column) => column.name));
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

function tableInfoFor(db: DatabaseSync, tableName: string) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
}

function db() {
  if (!globalForDb.letheDb) {
    globalForDb.letheDb = initializeDatabase();
  }

  return globalForDb.letheDb;
}

function mapMessage(row: Record<string, unknown> | undefined): SecretMessage | null {
  if (!row) {
    return null;
  }

  const typed = row as MessageRow;

  return {
    id: typed.id,
    pickupCode: typed.pickupCode,
    requirePickupCode: typed.requirePickupCode === 1,
    encryptedContent: typed.encryptedContent,
    encryptionSalt: typed.encryptionSalt,
    encryptionIv: typed.encryptionIv,
    encryptionTag: typed.encryptionTag,
    passwordHash: typed.passwordHash,
    expiresAt: new Date(typed.expiresAt),
    burnAfterRead: typed.burnAfterRead === 1,
    readAt: typed.readAt ? new Date(typed.readAt) : null,
    createdAt: new Date(typed.createdAt),
    updatedAt: new Date(typed.updatedAt)
  };
}

export function findMessageByPickupCode(pickupCode: string) {
  return mapMessage(
    db()
      .prepare(
        "SELECT * FROM secret_messages WHERE pickupCode = ? AND requirePickupCode = 1 LIMIT 1"
      )
      .get(pickupCode)
  );
}

export function pickupCodeExists(pickupCode: string) {
  const row = db()
    .prepare("SELECT id FROM secret_messages WHERE pickupCode = ? LIMIT 1")
    .get(pickupCode);

  return Boolean(row);
}

export function createMessage(input: {
  pickupCode: string | null;
  requirePickupCode: boolean;
  encryptedContent: string;
  encryptionSalt: string;
  encryptionIv: string;
  encryptionTag: string;
  passwordHash: string;
  expiresAt: Date;
  burnAfterRead: boolean;
}) {
  const now = new Date().toISOString();
  const id = randomUUID();

  db()
    .prepare(
      `
      INSERT INTO secret_messages (
        id, pickupCode, requirePickupCode, encryptedContent, encryptionSalt, encryptionIv,
        encryptionTag, passwordHash, expiresAt, burnAfterRead, readAt, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `
    )
    .run(
      id,
      input.pickupCode,
      input.requirePickupCode ? 1 : 0,
      input.encryptedContent,
      input.encryptionSalt,
      input.encryptionIv,
      input.encryptionTag,
      input.passwordHash,
      input.expiresAt.toISOString(),
      input.burnAfterRead ? 1 : 0,
      now,
      now
    );

  return findMessageById(id);
}

export function findMessageById(id: string) {
  return mapMessage(db().prepare("SELECT * FROM secret_messages WHERE id = ? LIMIT 1").get(id));
}

export function findPasswordOnlyMessages() {
  return db()
    .prepare(
      `
      SELECT * FROM secret_messages
      WHERE requirePickupCode = 0 AND expiresAt > ?
      ORDER BY createdAt DESC
    `
    )
    .all(new Date().toISOString())
    .map((row) => mapMessage(row))
    .filter((message): message is SecretMessage => Boolean(message));
}

export function deleteMessage(id: string) {
  db().prepare("DELETE FROM secret_messages WHERE id = ?").run(id);
}

export function markMessageRead(id: string, onlyUnread: boolean) {
  const now = new Date().toISOString();

  if (onlyUnread) {
    return db()
      .prepare("UPDATE secret_messages SET readAt = ?, updatedAt = ? WHERE id = ? AND readAt IS NULL")
      .run(now, now, id).changes;
  }

  return db()
    .prepare("UPDATE secret_messages SET readAt = ?, updatedAt = ? WHERE id = ?")
    .run(now, now, id).changes;
}

export function deleteExpiredMessages() {
  return db()
    .prepare("DELETE FROM secret_messages WHERE expiresAt <= ?")
    .run(new Date().toISOString()).changes;
}
