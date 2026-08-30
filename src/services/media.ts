import { supabase } from '../lib/supabase';

export async function uploadMedia(userId: string, localUri: string, type: 'audio' | 'image'): Promise<string> {
  const match = localUri.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1] : (type === 'audio' ? 'webm' : 'jpg');
  const path = `${userId}/${Date.now()}.${ext}`;

  // Fetch the file from the local URI to get it as a Blob
  const response = await fetch(localUri);
  const blob = await response.blob();

  const { data, error } = await supabase.storage.from('media').upload(path, blob, {
    contentType: type === 'audio' ? 'audio/webm' : 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return path;
}
