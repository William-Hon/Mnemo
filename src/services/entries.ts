import { supabase } from '../lib/supabase';
import { getLocalMEK, encryptText, decryptText } from '../lib/encryption';

export type Entry = {
  id: string;
  user_id: string;
  content: string; // Plaintext in app
  encrypted_content: string; // Ciphertext in DB
  entry_type: 'voice' | 'text';
  audio_path: string | null;
  processing_status?: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

// Helper to ensure MEK is available
async function requireMEK() {
  const mek = await getLocalMEK();
  if (!mek) throw new Error("Encryption Key not found. Please log in and provide your recovery passphrase.");
  return mek;
}

export async function markEntryFailed(id: string, errorMsg: string) {
  const { error } = await supabase
    .from('entries')
    .update({ 
      processing_status: 'failed',
      last_error: errorMsg
    })
    .eq('id', id);

  if (error) console.error("Failed to mark entry as failed:", error);
}

export async function createTextEntry(content: string, userId: string) {
  const key = await requireMEK();
  const encryptedContent = encryptText(content, key);

  const { data, error } = await supabase
    .from('entries')
    .insert([{ 
      encrypted_content: encryptedContent, 
      entry_type: 'text',
      user_id: userId,
      processing_status: 'ready'
    }])
    .select()
    .single();
    
  if (error) throw error;

  // Fire and forget background embedding generation
  supabase.functions.invoke('process-entry', { body: { entryId: data.id, encryptionKey: key } })
    .catch((err) => markEntryFailed(data.id, err.message || JSON.stringify(err)));

  data.content = content; // Return plaintext to UI
  return data as Entry;
}

export async function getUserEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  const key = await requireMEK();
  return (data as Entry[]).map(entry => ({
    ...entry,
    content: decryptText(entry.encrypted_content, key)
  }));
}

export async function getFailedEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('processing_status', 'failed')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  const key = await requireMEK();
  return (data as Entry[]).map(entry => ({
    ...entry,
    content: decryptText(entry.encrypted_content, key)
  }));
}

export async function getUnindexedEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .is('whole_embedding', null)
    .neq('encrypted_content', '') 
    .order('created_at', { ascending: false });
    
  if (error) throw error;

  const key = await requireMEK();
  return (data as Entry[]).map(entry => ({
    ...entry,
    content: decryptText(entry.encrypted_content, key)
  }));
}

export async function updateEntry(id: string, content: string) {
  const key = await requireMEK();
  const encryptedContent = encryptText(content, key);

  const { data, error } = await supabase
    .from('entries')
    .update({ 
      encrypted_content: encryptedContent,
      processing_status: 'ready',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Fire and forget background embedding generation
  supabase.functions.invoke('process-entry', { body: { entryId: data.id, encryptionKey: key } })
    .catch((err) => markEntryFailed(data.id, err.message || JSON.stringify(err)));

  data.content = content; // Return plaintext to UI
  return data as Entry;
}

export async function deleteEntry(id: string) {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createPendingVoiceEntry(userId: string, audioPath: string) {
  const { data, error } = await supabase
    .from('entries')
    .insert([{ 
      encrypted_content: '', // Empty until transcribed
      entry_type: 'voice',
      user_id: userId,
      audio_path: audioPath,
      processing_status: 'pending'
    }])
    .select()
    .single();
    
  if (error) throw error;
  return data as Entry;
}

export async function processTranscription(entryId: string, audioPath: string) {
  const key = await requireMEK();
  
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { entryId, audioPath, encryptionKey: key },
  });
  
  if (error) {
    await markEntryFailed(entryId, error.message || JSON.stringify(error));
    throw error;
  }
  
  // Note: the edge function returns the plaintext transcription for immediate UI display
  return data.text;
}

export async function retryEmbedding(entryId: string) {
  // Update status to processing to clear the error visually
  await supabase.from('entries').update({ processing_status: 'ready', last_error: null }).eq('id', entryId);
  
  const key = await requireMEK();
  
  const { data, error } = await supabase.functions.invoke('process-entry', {
    body: { entryId, encryptionKey: key },
  });
  
  if (error) {
    await markEntryFailed(entryId, error.message || JSON.stringify(error));
    throw error;
  }
  return data;
}

export async function searchEntries(query: string) {
  const { data, error } = await supabase.functions.invoke('search-entries', {
    body: { query },
  });
  
  if (error) throw error;
  
  const key = await requireMEK();
  return (data.results as Array<{ id: string; encrypted_content: string; created_at: string; similarity: number }>).map(res => ({
    ...res,
    content: decryptText(res.encrypted_content, key)
  }));
}
