import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const KEY_BYTES = 32;
const IV_BYTES = 12;

function readOrCreateKey(path) {
  if (existsSync(path)) {
    const key = readFileSync(path);
    if (key.length !== KEY_BYTES) throw new Error("ASUKA native credential key is invalid");
    return key;
  }
  mkdirSync(dirname(path), { recursive: true });
  const key = randomBytes(KEY_BYTES);
  writeFileSync(path, key, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows uses the user profile ACL; chmod is best-effort there.
  }
  return key;
}

export function createFileSecretStore(dataDir) {
  const key = readOrCreateKey(join(dataDir, ".native-provider.key"));
  return {
    encrypt(value) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
      return `v1:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")}`;
    },
    decrypt(value) {
      const encoded = String(value || "");
      if (!encoded.startsWith("v1:")) throw new Error("unsupported native credential format");
      const payload = Buffer.from(encoded.slice(3), "base64");
      if (payload.length <= IV_BYTES + 16) throw new Error("native credential is truncated");
      const iv = payload.subarray(0, IV_BYTES);
      const tag = payload.subarray(IV_BYTES, IV_BYTES + 16);
      const encrypted = payload.subarray(IV_BYTES + 16);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    },
  };
}

export function electronSecretStore(safeStorage) {
  return {
    encrypt(value) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable");
      return `electron:${safeStorage.encryptString(String(value)).toString("base64")}`;
    },
    decrypt(value) {
      const encoded = String(value || "");
      if (!encoded.startsWith("electron:")) throw new Error("unsupported Electron credential format");
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is unavailable");
      return safeStorage.decryptString(Buffer.from(encoded.slice(9), "base64"));
    },
  };
}
