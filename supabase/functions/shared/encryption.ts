// Deno WebCrypto AES-GCM Implementation

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array) => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

export async function encryptText(text: string, mekHex: string): Promise<string> {
  if (!text) return text;
  
  const keyBytes = hexToBytes(mekHex);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedText
  );
  
  const cipherBytes = new Uint8Array(cipherBuffer);
  
  // In WebCrypto, the auth tag is appended to the ciphertext automatically.
  // We'll separate it out to match our React Native quick-crypto format: iv:ciphertext:authtag
  // AES-GCM auth tag is always the last 16 bytes.
  const authTag = cipherBytes.slice(-16);
  const encrypted = cipherBytes.slice(0, -16);
  
  return `${bytesToHex(iv)}:${bytesToHex(encrypted)}:${bytesToHex(authTag)}`;
}

export async function decryptText(cipherText: string, mekHex: string): Promise<string> {
  if (!cipherText || !cipherText.includes(':')) return cipherText;
  
  try {
    const keyBytes = hexToBytes(mekHex);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const parts = cipherText.split(':');
    if (parts.length === 3) {
      const [ivHex, encryptedHex, authTagHex] = parts;
      const iv = hexToBytes(ivHex);
      const encrypted = hexToBytes(encryptedHex);
      const authTag = hexToBytes(authTagHex);
      
      // WebCrypto expects ciphertext + authTag as a single buffer
      const cipherBuffer = new Uint8Array(encrypted.length + authTag.length);
      cipherBuffer.set(encrypted, 0);
      cipherBuffer.set(authTag, encrypted.length);
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBuffer
      );
      
      return new TextDecoder().decode(decryptedBuffer);
    }
    
    console.warn("Unrecognized ciphertext format (possibly old CTR)");
    return cipherText;
    
  } catch (e) {
    console.warn("Failed to decrypt text", e);
    return cipherText;
  }
}
