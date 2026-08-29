import * as SecureStore from 'expo-secure-store';
import forge from 'node-forge';
import { Platform } from 'react-native';

const KEY_NAME = 'qora_master_encryption_key';

export type KeyWrapMetadata = {
  wrappedMEK: string;
  wrappedMEKIV: string;
  kdfSalt: string;
};

// Web-safe storage wrappers
async function getStorageItem(key: string) {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  }
  return await SecureStore.getItemAsync(key);
}

async function setStorageItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function deleteStorageItem(key: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

// Generate a random 256-bit Master Encryption Key
export function generateMEK(): string {
  return forge.util.bytesToHex(forge.random.getBytesSync(32));
}

export async function saveLocalMEK(mekHex: string): Promise<void> {
  await setStorageItem(KEY_NAME, mekHex);
}

export async function getLocalMEK(): Promise<string | null> {
  return await getStorageItem(KEY_NAME);
}

export async function clearLocalMEK(): Promise<void> {
  await deleteStorageItem(KEY_NAME);
}

// Derive a KEK from a passphrase using PBKDF2
export function deriveKEK(passphrase: string, saltHex: string): string {
  const salt = forge.util.hexToBytes(saltHex);
  const iterations = 100000;
  const keylen = 32;
  
  const keyBytes = forge.pkcs5.pbkdf2(passphrase, salt, iterations, keylen);
  return forge.util.bytesToHex(keyBytes);
}

// Wrap MEK with KEK using AES-256-GCM
export function wrapMEK(mekHex: string, kekHex: string): { wrappedMEK: string; iv: string } {
  const key = forge.util.hexToBytes(kekHex);
  const iv = forge.random.getBytesSync(12);
  
  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(forge.util.hexToBytes(mekHex)));
  cipher.finish();
  
  const encrypted = cipher.output.toHex();
  const authTag = cipher.mode.tag.toHex();
  const ivHex = forge.util.bytesToHex(iv);
  
  return {
    wrappedMEK: `${encrypted}:${authTag}`,
    iv: ivHex
  };
}

// Unwrap MEK using KEK
export function unwrapMEK(wrappedMEK: string, ivHex: string, kekHex: string): string {
  const key = forge.util.hexToBytes(kekHex);
  const iv = forge.util.hexToBytes(ivHex);
  
  const [encryptedHex, authTagHex] = wrappedMEK.split(':');
  if (!authTagHex) throw new Error("Invalid wrapped MEK format");
  
  const decipher = forge.cipher.createDecipher('AES-GCM', key);
  decipher.start({
    iv,
    tag: forge.util.createBuffer(forge.util.hexToBytes(authTagHex))
  });
  decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedHex)));
  
  const pass = decipher.finish();
  if (!pass) throw new Error("Failed to authenticate wrapped MEK");
  
  return forge.util.bytesToHex(decipher.output.getBytes());
}

// Encrypt journal text
export function encryptText(text: string, mekHex: string): string {
  if (!text) return text;
  
  const key = forge.util.hexToBytes(mekHex);
  const iv = forge.random.getBytesSync(12);
  
  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(text)));
  cipher.finish();
  
  const encrypted = cipher.output.toHex();
  const authTag = cipher.mode.tag.toHex();
  const ivHex = forge.util.bytesToHex(iv);
  
  return `${ivHex}:${encrypted}:${authTag}`;
}

// Decrypt journal text
export function decryptText(cipherText: string, mekHex: string): string {
  if (!cipherText || !cipherText.includes(':')) return cipherText;
  
  try {
    const key = forge.util.hexToBytes(mekHex);
    const parts = cipherText.split(':');
    
    if (parts.length === 3) {
      const [ivHex, encryptedHex, authTagHex] = parts;
      const iv = forge.util.hexToBytes(ivHex);
      
      const decipher = forge.cipher.createDecipher('AES-GCM', key);
      decipher.start({
        iv,
        tag: forge.util.createBuffer(forge.util.hexToBytes(authTagHex))
      });
      decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedHex)));
      
      const pass = decipher.finish();
      if (!pass) throw new Error("Authentication tag failed to verify");
      
      return forge.util.decodeUtf8(decipher.output.getBytes());
    } 
    
    return cipherText;
    
  } catch (e) {
    console.warn("Failed to decrypt text", e);
    return cipherText;
  }
}
