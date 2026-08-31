import { supabase } from '../lib/supabase';
import { getLocalMEK, encryptText, decryptText } from '../lib/encryption';

export type Entry = {
  id: string;
  user_id: string;
  entry_type: 'text' | 'voice' | 'handwriting';
  audio_path: string | null;
  encrypted_content: string;
  content: string; // Decrypted content for the UI
  created_at: string;
  updated_at: string;
  processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  last_error?: string | null;
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

export async function createTextEntry(text: string): Promise<Entry> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  const encryptedContent = await encryptText(text, mek);

  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: user.id,
      entry_type: 'text',
      encrypted_content: encryptedContent,
      processing_status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  // Trigger processing
  supabase.functions.invoke('process-entry', {
    body: { entryId: data.id, encryptionKey: mek }
  }).catch((err) => markEntryFailed(data.id, err.message || JSON.stringify(err)));

  return {
    ...data,
    content: text // Inject plaintext for immediate UI use
  } as Entry;
}

export async function getUserEntries(type?: string, startDate?: string, endDate?: string, limit?: number) {
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  let query = supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('entry_type', type);
  }

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return await Promise.all(data.map(async entry => ({
    ...entry,
    content: entry.encrypted_content ? await decryptText(entry.encrypted_content, mek) : ''
  }))) as Entry[];
}

export async function getFailedEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('processing_status', 'failed')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  return await Promise.all(data.map(async entry => ({
    ...entry,
    content: entry.encrypted_content ? await decryptText(entry.encrypted_content, mek) : ''
  }))) as Entry[];
}

export async function getUnindexedEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .is('whole_embedding', null)
    .neq('encrypted_content', '') 
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  return await Promise.all(data.map(async entry => ({
    ...entry,
    content: entry.encrypted_content ? await decryptText(entry.encrypted_content, mek) : ''
  }))) as Entry[];
}

export async function updateEntry(id: string, text: string): Promise<Entry> {
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  const encryptedContent = await encryptText(text, mek);

  const { data, error } = await supabase
    .from('entries')
    .update({ 
      encrypted_content: encryptedContent,
      updated_at: new Date().toISOString(),
      processing_status: 'pending' // Re-process if text changed
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  supabase.functions.invoke('process-entry', {
    body: { entryId: id, encryptionKey: mek }
  }).catch((err) => markEntryFailed(id, err.message || JSON.stringify(err)));

  return {
    ...data,
    content: text
  } as Entry;
}

export async function deleteEntries(entries: Entry[]) {
  const ids = entries.map(e => e.id);
  const audioPaths = entries.map(e => e.audio_path).filter(Boolean) as string[];

  // 1. Delete audio files from storage if any exist
  if (audioPaths.length > 0) {
    const { error: storageError } = await supabase.storage.from('audio_entries').remove(audioPaths);
    if (storageError) console.error("Failed to delete audio files:", storageError);
  }

  // 2. Delete database rows
  const { error } = await supabase
    .from('entries')
    .delete()
    .in('id', ids);

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
  return { ...data, content: '' } as Entry;
}

export async function processTranscription(entryId: string, audioPath: string) {
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  const res = await supabase.functions.invoke('transcribe', {
    body: { entryId, audioPath, encryptionKey: mek },
  });
  
  if (res.error) {
    console.log("Edge Function raw error:", res.error);
    
    let errorMsg = res.error.message;
    // Attempt to extract the response body if it's a FunctionsHttpError
    if (res.error.context && typeof res.error.context.json === 'function') {
      try {
        const body = await res.error.context.json();
        errorMsg = body.error || JSON.stringify(body);
        console.log("Parsed error body:", errorMsg);
      } catch (e) {
        // ignore
      }
    } else if (res.error.context && typeof res.error.context.text === 'function') {
      try {
        const text = await res.error.context.text();
        errorMsg = text;
        console.log("Parsed error text:", text);
      } catch (e) {
        // ignore
      }
    }
    
    await markEntryFailed(entryId, errorMsg || JSON.stringify(res.error));
    throw new Error(errorMsg);
  }
  
  return res.data.text;
}

export async function retryEmbedding(entryId: string) {
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found.');

  await supabase.from('entries').update({ processing_status: 'ready', last_error: null }).eq('id', entryId);
  
  const { data, error } = await supabase.functions.invoke('process-entry', {
    body: { entryId, encryptionKey: mek },
  });
  
  if (error) {
    await markEntryFailed(entryId, error.message || JSON.stringify(error));
    throw error;
  }
  return data;
}

export async function searchEntries(query: string, filterType?: string, filterStartDate?: string, filterEndDate?: string): Promise<any[]> {
  const mek = await getLocalMEK();
  if (!mek) throw new Error('Encryption key not found. Please set up your recovery passphrase.');

  const { data, error } = await supabase.functions.invoke('search-entries', {
    body: { query, filterType, filterStartDate },
  });
  
  if (error || !data || !data.results) {
    console.error("Search edge function failed:", error);
    return [];
  }
  
  // 1. Decrypt all candidates
  let decryptedResults = await Promise.all(data.results.map(async (item: any) => ({
    ...item,
    content: item.encrypted_content ? await decryptText(item.encrypted_content, mek) : '',
    fullContent: item.encrypted_entry_content ? await decryptText(item.encrypted_entry_content, mek) : ''
  })));

  // Client-side end-date filter
  if (filterEndDate) {
    const end = new Date(filterEndDate).getTime();
    decryptedResults = decryptedResults.filter(item => {
      const created = new Date(item.created_at).getTime();
      return created <= end;
    });
  }

  // 2. Vector Rank (items are already ordered by vector similarity from DB)
  const vectorRanked = decryptedResults.map((item, index) => ({ 
    ...item, 
    vectorRank: index + 1 
  }));

  // 3. Keyword Rank
  const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const keywordScored = vectorRanked.map(item => {
    let exactMatches = 0;
    const textLower = item.content.toLowerCase();
    
    queryTokens.forEach(token => {
      if (textLower.includes(token)) {
        exactMatches += 1;
      }
    });

    const hasExactPhrase = textLower.includes(query.toLowerCase());
    const keywordScore = exactMatches + (hasExactPhrase ? 5 : 0); // Pure sorting signal
    
    return { ...item, keywordScore, hasExactPhrase };
  });

  // Sort to establish keyword rankings
  const keywordRanked = [...keywordScored]
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .map((item, index) => ({ ...item, keywordRank: index + 1 }));

  // 4. Reciprocal Rank Fusion (RRF)
  const k = 60; // Standard RRF constant
  const rrfScored = keywordRanked.map(item => {
    const rrfScore = (1 / (k + item.vectorRank)) + (1 / (k + item.keywordRank));
    return { ...item, rrfScore };
  });

  // 5. Final Sort by RRF
  rrfScored.sort((a, b) => b.rrfScore - a.rrfScore);
  
  // Return top 10 and map them so their final index is their final rank
  return rrfScored.slice(0, 10).map((item, index) => ({
    ...item,
    finalRank: index + 1
  }));
}
