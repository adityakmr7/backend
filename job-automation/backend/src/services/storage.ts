// backend/src/services/storage.ts
//
// Supabase Storage helper for resume PDFs.
//
// Strategy:
//   - One resume PDF per account, always stored at the same fixed path:
//       <bucket>/resume.pdf.gz
//   - The file is gzip-compressed before upload (~30-70% smaller for text PDFs).
//   - Uploading a new PDF always overwrites (upsert: true) the old one.
//   - The Supabase client is built lazily (per call) so the backend boots
//     even if env vars are missing — throws a clear error if called without them.
//
// Required env vars:
//   SUPABASE_URL             — https://xxxx.supabase.co
//   SUPABASE_KEY             — anon/publishable or service_role key
//   SUPABASE_RESUME_BUCKET   — bucket name (default: "resumes")

import { createClient } from '@supabase/supabase-js';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync   = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const RESUME_OBJECT_PATH = 'resume.pdf.gz';

function supabaseClient() {
  const url    = process.env.SUPABASE_URL?.trim();
  const key    = process.env.SUPABASE_KEY?.trim();
  const bucket = (process.env.SUPABASE_RESUME_BUCKET ?? 'resumes').trim();

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in backend/.env',
    );
  }

  return { client: createClient(url, key), bucket };
}

// ---------------------------------------------------------------------------
// Upload (compress + upsert)
// ---------------------------------------------------------------------------

/**
 * Gzip-compress the raw PDF bytes and upsert them to Supabase Storage.
 * Returns the public URL of the stored object.
 *
 * Always overwrites the previous resume — one resume per account.
 */
export async function uploadResumePdf(pdfBytes: Uint8Array): Promise<string> {
  const { client, bucket } = supabaseClient();

  // Compress
  const compressed = await gzipAsync(Buffer.from(pdfBytes));
  const originalKb  = Math.round(pdfBytes.length   / 1024);
  const compressedKb = Math.round(compressed.length / 1024);
  console.log(
    `[storage] Uploading resume PDF: ${originalKb} KB → ${compressedKb} KB (gzip, ${Math.round((1 - compressedKb / originalKb) * 100)}% reduction)`,
  );

  // Upsert — overwrites any previous resume stored at the same path
  const { error } = await client.storage
    .from(bucket)
    .upload(RESUME_OBJECT_PATH, compressed, {
      contentType: 'application/gzip',
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Return the public URL (bucket must be set to "Public" in Supabase dashboard,
  // or use a signed URL for private buckets)
  const { data } = client.storage
    .from(bucket)
    .getPublicUrl(RESUME_OBJECT_PATH);

  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Download (decompress)
// ---------------------------------------------------------------------------

/**
 * Download the stored compressed PDF from Supabase and decompress it.
 * Returns the original raw PDF bytes.
 */
export async function downloadResumePdf(): Promise<Uint8Array> {
  const { client, bucket } = supabaseClient();

  const { data, error } = await client.storage
    .from(bucket)
    .download(RESUME_OBJECT_PATH);

  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message ?? 'no data'}`);
  }

  const compressedBuf = Buffer.from(await data.arrayBuffer());
  const decompressed  = await gunzipAsync(compressedBuf);
  return new Uint8Array(decompressed);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Remove the stored PDF from Supabase (called when a resume is deleted).
 * Does not throw if the object doesn't exist.
 */
export async function deleteResumePdf(): Promise<void> {
  try {
    const { client, bucket } = supabaseClient();
    await client.storage.from(bucket).remove([RESUME_OBJECT_PATH]);
    console.log('[storage] Resume PDF deleted from Supabase.');
  } catch (e) {
    // Non-fatal — log and continue
    console.warn('[storage] Could not delete resume from Supabase:', (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Returns true if Supabase Storage is configured and reachable.
 * Used by the settings page / health endpoint.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}
