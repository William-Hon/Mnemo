import * as SecureStore from 'expo-secure-store';
import forge from 'node-forge';

const MEK_STORAGE_KEY = 'qora_mek_v1';

export async function generateMEK(): Promise<string> {
  return new Promise((resolve) => {
    // Generate 32 bytes (256 bits) for AES-256
    const key = forge.random.getBytesSync(32);
    resolve(forge.util.encode64(key));
  });
}

export async function saveLocalMEK(mekBase64: string): Promise<void> {
  await SecureStore.setItemAsync(MEK_STORAGE_KEY, mekBase64);
}

export async function getLocalMEK(): Promise<string | null> {
  return await SecureStore.getItemAsync(MEK_STORAGE_KEY);
}

export async function deleteLocalMEK(): Promise<void> {
  await SecureStore.deleteItemAsync(MEK_STORAGE_KEY);
}

export async function deriveKEK(passphrase: string, saltHex: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const md = forge.md.sha256.create();
    // Using 50,000 on mobile JS so it doesn't take 10 seconds
    forge.pkcs5.pbkdf2(passphrase, forge.util.hexToBytes(saltHex), 50000, 32, md, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(forge.util.encode64(derivedKey));
    });
  });
}

export function generateSaltHex(): string {
  return forge.util.bytesToHex(forge.random.getBytesSync(16));
}

export async function wrapMEK(mekBase64: string, kekBase64: string): Promise<{ wrappedMek: string, iv: string }> {
  return new Promise((resolve) => {
    const mekBytes = forge.util.decode64(mekBase64);
    const kekBytes = forge.util.decode64(kekBase64);
    
    const iv = forge.random.getBytesSync(12);
    const cipher = forge.cipher.createCipher('AES-GCM', kekBytes);
    cipher.start({ iv });
    cipher.update(forge.util.createBuffer(mekBytes));
    cipher.finish();
    
    const encrypted = cipher.output.getBytes();
    const tag = cipher.mode.tag.getBytes();
    
    // Format: iv(12):ciphertext:tag(16)
    resolve({
      wrappedMek: forge.util.encode64(encrypted + tag),
      iv: forge.util.encode64(iv)
    });
  });
}

export async function unwrapMEK(wrappedMekBase64: string, ivBase64: string, kekBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ivBytes = forge.util.decode64(ivBase64);
    const kekBytes = forge.util.decode64(kekBase64);
    const wrappedMekBytes = forge.util.decode64(wrappedMekBase64);
    
    const tagLength = 16;
    const encrypted = wrappedMekBytes.slice(0, -tagLength);
    const tag = wrappedMekBytes.slice(-tagLength);
    
    const decipher = forge.cipher.createDecipher('AES-GCM', kekBytes);
    decipher.start({
      iv: ivBytes,
      tag: forge.util.createBuffer(tag)
    });
    decipher.update(forge.util.createBuffer(encrypted));
    const success = decipher.finish();
    
    if (!success) {
      reject(new Error('Failed to unwrap MEK. Incorrect recovery passphrase or corrupted data.'));
    } else {
      resolve(forge.util.encode64(decipher.output.getBytes()));
    }
  });
}

export async function encryptText(plaintext: string, mekBase64: string): Promise<string> {
  return new Promise((resolve) => {
    const mekBytes = forge.util.decode64(mekBase64);
    const iv = forge.random.getBytesSync(12);
    
    const cipher = forge.cipher.createCipher('AES-GCM', mekBytes);
    cipher.start({ iv });
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)));
    cipher.finish();
    
    const encrypted = cipher.output.getBytes();
    const tag = cipher.mode.tag.getBytes();
    
    const combined = iv + encrypted + tag;
    resolve(forge.util.encode64(combined));
  });
}

export async function decryptText(ciphertextBase64: string, mekBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ciphertextBytes = forge.util.decode64(ciphertextBase64);
    const mekBytes = forge.util.decode64(mekBase64);
    
    const iv = ciphertextBytes.slice(0, 12);
    const tag = ciphertextBytes.slice(-16);
    const encrypted = ciphertextBytes.slice(12, -16);
    
    const decipher = forge.cipher.createDecipher('AES-GCM', mekBytes);
    decipher.start({
      iv,
      tag: forge.util.createBuffer(tag)
    });
    decipher.update(forge.util.createBuffer(encrypted));
    const success = decipher.finish();
    
    if (!success) {
      reject(new Error('Decryption failed.'));
    } else {
      resolve(forge.util.decodeUtf8(decipher.output.getBytes()));
    }
  });
}
