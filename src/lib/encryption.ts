import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, "hex");

  if (key.length !== KEY_BYTES) {
    throw new Error("Encryption key must be 32 bytes (64 hex characters).");
  }

  return key;
}

export function encryptText(plaintext: string, keyHex: string): string {
  const key = getKey(keyHex);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptText(payload: string, keyHex: string): string {
  const key = getKey(keyHex);
  const data = Buffer.from(payload, "base64");

  if (data.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted payload is invalid.");
  }

  const iv = data.subarray(0, IV_BYTES);
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = data.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
