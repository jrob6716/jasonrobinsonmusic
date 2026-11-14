import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = db.storage.from('private-music');
const origins = (Deno.env.get('PRIVATE_MUSIC_ORIGINS') || 'https://dirtyfreqs.com,https://www.dirtyfreqs.com').split(',').map(s => s.trim());
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
function check(error: unknown) { if (error) throw error; }
function string(value: unknown, max: number) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }

export async function handleRequest(req: Request) {
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  if (origin && !origins.includes(origin)) return reply({ error: 'Origin not allowed.' }, 403);
  try {
    if (Number(req.headers.get('content-length')) > 20000) return reply({ error: 'Request too large.' }, 413);
    const raw = await req.text();
    if (raw.length > 20000) return reply({ error: 'Request too large.' }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object') return reply({ error: 'Invalid request.' }, 400);
    if (body.action === 'resolve') {
      if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return reply({ error: 'This listening link is unavailable or has expired.' }, 404);
      const { data: share, error } = await db.from('private_music_shares').select('*').eq('token_hash', await hash(body.token)).maybeSingle();
      check(error);
      if (!share || share.revoked_at || (share.expires_at && Date.parse(share.expires_at) <= Date.now())) return reply({ error: 'This listening link is unavailable or has expired.' }, 404);
      const { data: tracks, error: trackError } = await db.from('private_music_tracks').select('id,title,subtitle,storage_path').in('id', share.track_ids);
      check(trackError);
      if (!tracks || tracks.length !== share.track_ids.length) return reply({ error: 'This listening link is unavailable.' }, 404);
      // Bound the media URL lifetime by the share expiration as well as five minutes.
      const ttl = Math.min(300, share.expires_at ? Math.floor((Date.parse(share.expires_at) - Date.now()) / 1000) : 300);
      if (ttl < 1) return reply({ error: 'This listening link has expired.' }, 404);
      const signed = await Promise.all(share.track_ids.map(async (id: string) => {
        const track = tracks.find(t => t.id === id)!;
        const { data, error } = await bucket.createSignedUrl(track.storage_path, ttl);
        check(error);
        return { id: track.id, title: track.title, subtitle: track.subtitle, url: data!.signedUrl };
      }));
      return reply({ title: share.title, tracks: signed, expiresAt: share.expires_at });
    }
    const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return reply({ error: 'Please sign in.' }, 401);
    const { data: { user }, error: authError } = await db.auth.getUser(jwt);
    if (authError || !user) return reply({ error: 'Please sign in again.' }, 401);
    const { data: admin, error: adminError } = await db.from('private_music_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    check(adminError);
    if (!admin) return reply({ error: 'This account does not have music admin access.' }, 403);
    switch (body.action) {
      case 'list': {
        const [tracks, shares] = await Promise.all([
          db.from('private_music_tracks').select('id,title,subtitle,created_at').order('created_at', { ascending: false }),
          db.from('private_music_shares').select('id,title,track_ids,expires_at,revoked_at,created_at').order('created_at', { ascending: false }),
        ]);
        check(tracks.error); check(shares.error);
        return reply({ tracks: tracks.data, shares: shares.data });
      }
      case 'upload': {
        if (!string(body.title, 200) || typeof body.subtitle !== 'string' || body.subtitle.length > 300 || !['mp3','m4a','wav','flac','ogg','aac'].includes(body.extension)) return reply({ error: 'Enter a title and choose a supported audio file.' }, 400);
        const id = crypto.randomUUID();
        const path = `${id}.${body.extension}`;
        const { data, error } = await bucket.createSignedUploadUrl(path);
        check(error);
        // Metadata is committed only after the upload succeeds.
        return reply({ id, path, token: data!.token });
      }
      case 'save-track': {
        if (!uuid.test(body.id) || !string(body.title, 200) || typeof body.subtitle !== 'string' || body.subtitle.length > 300 || !new RegExp(`^${body.id}\\.(mp3|m4a|wav|flac|ogg|aac)$`).test(body.path)) return reply({ error: 'Invalid track.' }, 400);
        const { data: objects, error: objectError } = await bucket.list('', { search: body.path, limit: 10 });
        check(objectError);
        if (!objects?.some(o => o.name === body.path)) return reply({ error: 'Audio upload was not found.' }, 400);
        const { error } = await db.from('private_music_tracks').insert({ id: body.id, title: body.title.trim(), subtitle: body.subtitle.trim(), storage_path: body.path });
        check(error);
        return reply({ ok: true });
      }
      case 'create-share': {
        const ids = body.trackIds;
        if (!string(body.title, 200) || !Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(ids).size !== ids.length) return reply({ error: 'Choose at least one song and enter a share title.' }, 400);
        if (body.expiresAt && (typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt)) || Date.parse(body.expiresAt) <= Date.now())) return reply({ error: 'Choose a future expiration date.' }, 400);
        const { data: tracks, error: trackError } = await db.from('private_music_tracks').select('id').in('id', ids);
        check(trackError);
        if (tracks?.length !== ids.length) return reply({ error: 'One or more songs are unavailable.' }, 400);
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
        const { error } = await db.from('private_music_shares').insert({ title: body.title.trim(), token_hash: await hash(token), track_ids: ids, expires_at: body.expiresAt || null });
        check(error);
        return reply({ token });
      }
      case 'revoke': {
        if (!uuid.test(body.id)) return reply({ error: 'Invalid share.' }, 400);
        const { error } = await db.from('private_music_shares').update({ revoked_at: new Date().toISOString() }).eq('id', body.id);
        check(error);
        return reply({ ok: true });
      }
      default: return reply({ error: 'Unknown action.' }, 400);
    }
  } catch (error) {
    // Never log request bodies, access tokens, share codes, or signed URLs.
    console.error('Private music request failed:', error instanceof Error ? error.name : 'service error');
    return reply({ error: 'The music service could not complete this request. Please try again.' }, 500);
  }
}
