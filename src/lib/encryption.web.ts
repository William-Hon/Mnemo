const MEK_STORAGE_KEY = 'qora_mek_v1';

// WebCrypto Helper
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function encode64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function generateMEK(): Promise<string> {
  const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
  return encode64(keyBytes);
}

export async function saveLocalMEK(mekBase64: string): Promise<void> {
  localStorage.setItem(MEK_STORAGE_KEY, mekBase64);
}

export async function getLocalMEK(): Promise<string | null> {
  return localStorage.getItem(MEK_STORAGE_KEY);
}

export async function deleteLocalMEK(): Promise<void> {
  localStorage.removeItem(MEK_STORAGE_KEY);
}

export async function deriveKEK(passphrase: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const saltBuffer = hexToBytes(saltHex);
  const derivedBits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' },
    passwordKey,
    256 // 32 bytes
  );
  
  return encode64(new Uint8Array(derivedBits));
}

export function generateSaltHex(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  let hex = '';
  for (let i = 0; i < salt.length; i++) {
    hex += salt[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function wrapMEK(mekBase64: string, kekBase64: string): Promise<{ wrappedMek: string, iv: string }> {
  const mekBytes = decode64(mekBase64);
  const kekBytes = decode64(kekBase64);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await window.crypto.subtle.importKey(
    'raw',
    kekBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    mekBytes
  );
  
  return {
    wrappedMek: encode64(new Uint8Array(encryptedBuf)), // contains ciphertext + tag
    iv: encode64(iv)
  };
}

export async function unwrapMEK(wrappedMekBase64: string, ivBase64: string, kekBase64: string): Promise<string> {
  const ivBytes = decode64(ivBase64);
  const kekBytes = decode64(kekBase64);
  const wrappedMekBytes = decode64(wrappedMekBase64);
  
  const key = await window.crypto.subtle.importKey(
    'raw',
    kekBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  try {
    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      wrappedMekBytes
    );
    return encode64(new Uint8Array(decryptedBuf));
  } catch (e) {
    throw new Error('Failed to unwrap MEK. Incorrect recovery passphrase or corrupted data.');
  }
}

export async function encryptText(plaintext: string, mekBase64: string): Promise<string> {
  const mekBytes = decode64(mekBase64);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await window.crypto.subtle.importKey(
    'raw',
    mekBytes as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encoder = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  const encryptedBytes = new Uint8Array(encryptedBuf);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  
  return encode64(combined);
}

export async function decryptText(ciphertextBase64: string, mekBase64: string): Promise<string> {
  const combined = decode64(ciphertextBase64);
  const mekBytes = decode64(mekBase64);
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const key = await window.crypto.subtle.importKey(
    'raw',
    mekBytes as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  try {
    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuf);
  } catch (e) {
    throw new Error('Decryption failed.');
  }
}
