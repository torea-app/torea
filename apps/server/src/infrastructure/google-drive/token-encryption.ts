/**
 * AES-256-GCM による Google OAuth トークンの at-rest 暗号化。
 *
 * 形式: `base64(iv) + ":" + base64(ciphertext + authTag)`
 * - 各暗号化操作で 12 bytes のランダム IV を生成（GCM の標準）
 * - 鍵は env.INTEGRATION_ENCRYPTION_KEY (base64 32 bytes)
 * - Cloudflare Workers の crypto.subtle 操作は CPU 時間にカウントされない
 *   (auth.ts の PBKDF2 と同じ前提)
 */

const ALG = { name: "AES-GCM", length: 256 } as const;

async function importKey(b64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64Key), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must be 32 bytes (base64)");
  }
  return crypto.subtle.importKey("raw", raw, ALG, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(
  plaintext: string,
  b64Key: string,
): Promise<string> {
  const key = await importKey(b64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data),
  );
  return `${b64(iv)}:${b64(cipher)}`;
}

export async function decryptToken(
  encoded: string,
  b64Key: string,
): Promise<string> {
  const [ivPart, cipherPart] = encoded.split(":");
  if (!ivPart || !cipherPart) throw new Error("malformed ciphertext");
  const key = await importKey(b64Key);
  const iv = u8(ivPart);
  const cipher = u8(cipherPart);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher),
  );
  return new TextDecoder().decode(plain);
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function u8(b64s: string): Uint8Array {
  return Uint8Array.from(atob(b64s), (c) => c.charCodeAt(0));
}
