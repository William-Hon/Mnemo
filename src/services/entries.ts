import { supabase } from '../lib/supabase';

export type Entry = {
  id: string;
  user_id: string;
  content: string; 
  entry_type: 'voice' | 'text';
  audio_path: string | null;
  processing_status?: string;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
};

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
  const { data, error } = await supabase
    .from('entries')
    .insert([{ 
      content: content, 
      entry_type: 'text',
      user_id: userId,
      processing_status: 'ready'
    }])
    .select()
    .single();
    
  if (error) throw error;

  // Fire and forget background embedding generation
  supabase.functions.invoke('process-entry', { body: { entryId: data.id } })
    .catch((err) => markEntryFailed(data.id, err.message || JSON.stringify(err)));

  return data as Entry;
}

export async function getUserEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return data as Entry[];
}

export async function getFailedEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('processing_status', 'failed')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  return data as Entry[];
}

export async function getUnindexedEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .is('whole_embedding', null)
    .neq('content', '') 
    .order('created_at', { ascending: false });
    
  if (error) throw error;

  return data as Entry[];
}

export async function updateEntry(id: string, content: string) {
  const { data, error } = await supabase
    .from('entries')
    .update({ 
      content: content,
      processing_status: 'ready',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Fire and forget background embedding generation
  supabase.functions.invoke('process-entry', { body: { entryId: data.id } })
    .catch((err) => markEntryFailed(data.id, err.message || JSON.stringify(err)));

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
      content: '', // Empty until transcribed
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
  const { data, error } = await supabase.functions.invoke('transcribe', {
    body: { entryId, audioPath },
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
  
  const { data, error } = await supabase.functions.invoke('process-entry', {
    body: { entryId },
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
  
  return data.results as Array<{ id: string; content: string; created_at: string; similarity: number }>;
}
