/** Web Crypto API only: plaintext never leaves the user's browser. */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const asBufferSource = (bytes: Uint8Array) => bytes as unknown as BufferSource;

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function keyFromPassphrase(passphrase: string, salt: Uint8Array) {
  const source = await crypto.subtle.importKey(
    "raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations: 310000, hash: "SHA-256" },
    source,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

export async function encryptEvent(plaintext: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromPassphrase(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(encoder.encode(plaintext)));
  return `${toBase64(salt)}.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptEvent(payload: string, passphrase: string) {
  const [saltValue, ivValue, encryptedValue] = payload.split(".");
  if (!saltValue || !ivValue || !encryptedValue) throw new Error("Invalid encrypted event");
  const salt = fromBase64(saltValue);
  const iv = fromBase64(ivValue);
  const key = await keyFromPassphrase(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBufferSource(iv) }, key, asBufferSource(fromBase64(encryptedValue)));
  return decoder.decode(plain);
}
