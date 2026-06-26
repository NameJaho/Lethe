import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export type EncryptedContent = {
  encryptedContent: string;
  encryptionSalt: string;
  encryptionIv: string;
  encryptionTag: string;
};

async function deriveKey(password: string, salt: Buffer) {
  return (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
}

export async function encryptContent(content: string, password: string): Promise<EncryptedContent> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);

  return {
    encryptedContent: encrypted.toString("base64"),
    encryptionSalt: salt.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionTag: cipher.getAuthTag().toString("base64")
  };
}

export async function decryptContent(
  encrypted: EncryptedContent,
  password: string
): Promise<string | null> {
  try {
    const salt = Buffer.from(encrypted.encryptionSalt, "base64");
    const iv = Buffer.from(encrypted.encryptionIv, "base64");
    const authTag = Buffer.from(encrypted.encryptionTag, "base64");
    const key = await deriveKey(password, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.encryptedContent, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}
