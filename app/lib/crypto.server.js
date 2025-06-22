// app/lib/crypto.server.js
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const algorithm = "aes-256-cbc";

const secretKey = process.env.ENCRYPTION_SECRET;
if (!secretKey || secretKey.length !== 32) {
  throw new Error(
    "Invalid ENCRYPTION_SECRET in .env file. It must be 32 characters long.",
  );
}

const key = scryptSync(secretKey, "salt", 32);

export function encrypt(text) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return {
    iv: iv.toString("hex"),
    content: encrypted.toString("hex"),
  };
}

export function decrypt(hash) {
  try {
    const decipher = createDecipheriv(
      algorithm,
      key,
      Buffer.from(hash.iv, "hex"),
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(hash.content, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}