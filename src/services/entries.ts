import { supabase } from '../lib/supabase';

export type Entry = {
  id: string;
  user_id: string;
  content: string;
  entry_type: 'voice' | 'text';
  audio_path: string | null;
  created_at: string;
  updated_at: string;
};

export async function createTextEntry(content: string, userId: string) {
  const { data, error } = await supabase
    .from('entries')
    .insert([{ 
      content, 
      entry_type: 'text',
      user_id: userId
    }])
    .select()
    .single();
    
  if (error) throw error;
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

export async function updateEntry(id: string, content: string) {
  const { data, error } = await supabase
    .from('entries')
    .update({ 
      content,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Entry;
}

export async function deleteEntry(id: string) {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createVoiceEntry(content: string, userId: string, audioPath?: string) {
  const { data, error } = await supabase
    .from('entries')
    .insert([{ 
      content, 
      entry_type: 'voice',
      user_id: userId,
      audio_path: audioPath || null
    }])
    .select()
    .single();
    
  if (error) throw error;
  return data as Entry;
}
