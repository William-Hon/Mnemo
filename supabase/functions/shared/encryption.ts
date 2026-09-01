// WebCrypto API available natively in Deno

export async function encryptText(plaintext: string, mekBase64: string): Promise<string> {
  const mekBytes = decode64(mekBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await crypto.subtle.importKey(
    'raw',
    mekBytes as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encoder = new TextEncoder();
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  const encryptedBytes = new Uint8Array(encryptedBuf);
  
  // Combine iv + ciphertext + tag. WebCrypto appends the 16-byte tag to the ciphertext automatically.
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  
  return encode64(combined);
}

export async function decryptText(ciphertextBase64: string, mekBase64: string): Promise<string> {
  const combined = decode64(ciphertextBase64);
  const mekBytes = decode64(mekBase64);
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12); // ciphertext + tag
  
  const key = await crypto.subtle.importKey(
    'raw',
    mekBytes as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuf);
}

// Simple base64 decode/encode for Deno using btoa/atob
function decode64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
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
