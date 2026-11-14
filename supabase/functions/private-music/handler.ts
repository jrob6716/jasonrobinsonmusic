import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = db.storage.from('private-music');
const origins = (Deno.env.get('PRIVATE_MUSIC_ORIGINS') || 'https://dirtyfreqs.com,https://www.dirtyfreqs.com').split(',').map(s => s.trim());
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
function check(error: unknown) { if (error) throw error; }
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const validIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length > 0 && ids.length <= 100 && ids.every(id => typeof id === 'string' && uuid.test(id)) && new Set(ids).size === ids.length;
const validExpiry = (value: unknown) => value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now());
const encoder = new TextEncoder();
// Server-only encryption allows admins to copy new links later without storing raw codes.
async function linkKey() {
  const secret = Deno.env.get('PRIVATE_MUSIC_LINK_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode('private-music-links-v1:' + secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(token: string, id: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(id) }, await linkKey(), encoder.encode(token));
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(data)));
}
async function unseal(value: string, id: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: encoder.encode(id) }, await linkKey(), bytes.slice(12));
  return new TextDecoder().decode(data);
}
async function getShare(token: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await db.from('private_music_shares').select('*').eq('token_hash', await hash(token)).maybeSingle();
  check(error);
  return !data || data.revoked_at || (data.expires_at && Date.parse(data.expires_at) <= Date.now()) ? null : data;
}
async function getTrack(id: string) {
  const { data, error } = await db.from('private_music_tracks').select('*').eq('id', id).maybeSingle();
  check(error); return data;
}
async function validateSelection(ids: string[]) {
  const { data, error } = await db.from('private_music_tracks').select('id').in('id', ids).is('deleted_at', null).is('archived_at', null);
  check(error); return data?.length === ids.length;
}

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
    if (['resolve','visit','listen'].includes(body.action)) {
      const share = await getShare(body.token);
      if (!share) return reply({ error: 'This listening link is unavailable or has expired.' }, 404);
      if (body.action !== 'resolve') {
        if (!uuid.test(body.sessionId)) return reply({ error: 'Invalid session.' }, 400);
        if (body.action === 'visit') {
          const { error } = await db.from('private_music_visits').upsert({ share_id: share.id, session_id: body.sessionId }, { onConflict: 'share_id,session_id', ignoreDuplicates: true });
          check(error); return reply({ ok: true });
        }
        if (!uuid.test(body.trackId) || !uuid.test(body.versionId) || !share.track_ids.includes(body.trackId) ||
          !Number.isFinite(body.seconds) || body.seconds < 0 || body.seconds > 86400 ||
          !Number.isFinite(body.coverage) || body.coverage < 0 ||
          !Number.isFinite(body.duration) || body.duration < 0 || body.duration > 86400) return reply({ error: 'Invalid listening event.' }, 400);
        const { data: version, error } = await db.from('private_music_versions').select('id').eq('id', body.versionId).eq('track_id', body.trackId).maybeSingle();
        check(error);
        const track = await getTrack(body.trackId);
        if (!version || !track || track.deleted_at) return reply({ error: 'Song unavailable.' }, 404);
        const { error: recordError } = await db.rpc('private_music_record_listen', {
          p_share: share.id, p_session: body.sessionId, p_track: body.trackId, p_version: body.versionId,
          p_seconds: body.seconds, p_duration: body.duration, p_coverage: body.coverage,
        });
        check(recordError); return reply({ ok: true });
      }
      const { data: tracks, error: trackError } = await db.from('private_music_tracks').select('id,title,subtitle,storage_path,current_version_id,deleted_at').in('id', share.track_ids).is('deleted_at', null);
      check(trackError);
      if (!tracks || tracks.length !== share.track_ids.length) return reply({ error: 'This listening link is unavailable.' }, 404);
      const ttl = Math.min(300, share.expires_at ? Math.floor((Date.parse(share.expires_at) - Date.now()) / 1000) : 300);
      if (ttl < 1) return reply({ error: 'This listening link has expired.' }, 404);
      const signed = await Promise.all(share.track_ids.map(async (id: string) => {
        const track = tracks.find(t => t.id === id)!;
        const { data, error } = await bucket.createSignedUrl(track.storage_path, ttl);
        check(error);
        return { id: track.id, title: track.title, subtitle: track.subtitle, versionId: track.current_version_id, url: data!.signedUrl };
      }));
      return reply({ title: share.title, message: share.message || '', tracks: signed, expiresAt: share.expires_at });
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
        const [tracks, shares, versions, activity] = await Promise.all([
          db.from('private_music_tracks').select('id,title,subtitle,created_at,archived_at,deleted_at,cleanup_pending,current_version_id').order('created_at', { ascending: false }),
          db.from('private_music_shares').select('id,title,recipient_label,message,track_ids,expires_at,revoked_at,created_at,token_encrypted').order('created_at', { ascending: false }),
          db.from('private_music_versions').select('id,track_id,label,created_at').order('created_at', { ascending: false }),
          db.rpc('private_music_activity'),
        ]);
        check(tracks.error); check(shares.error); check(versions.error); check(activity.error);
        return reply({ apiVersion: 2, tracks: tracks.data, versions: versions.data, activity: activity.data,
          shares: shares.data!.map(({ token_encrypted, ...share }) => ({ ...share, canCopy: Boolean(token_encrypted) })) });
      }
      case 'upload': {
        if (!['mp3','m4a','wav','flac','ogg','aac'].includes(body.extension)) return reply({ error: 'Choose a supported audio file.' }, 400);
        if (body.trackId && !uuid.test(body.trackId)) return reply({ error: 'Invalid song.' }, 400);
        const track = body.trackId ? await getTrack(body.trackId) : null;
        if (body.trackId && (!track || track.deleted_at)) return reply({ error: 'Song unavailable.' }, 404);
        if (!body.trackId && (!string(body.title,200) || typeof body.subtitle !== 'string' || body.subtitle.length>300)) return reply({ error: 'Enter a title and choose a supported audio file.' }, 400);
        const id = track?.id || crypto.randomUUID();
        const versionId = crypto.randomUUID();
        const path = `${id}/${versionId}.${body.extension}`;
        const { data, error } = await bucket.createSignedUploadUrl(path);
        check(error);
        return reply({ id, versionId, expectedVersion: track?.current_version_id || null, path, token: data!.token });
      }
      case 'save-track': {
        if (!uuid.test(body.id) || !uuid.test(body.versionId) || (body.expectedVersion !== null && !uuid.test(body.expectedVersion)) ||
          !string(body.label,100) || (body.expectedVersion === null && (!string(body.title,200) || typeof body.subtitle !== 'string' || body.subtitle.length>300)) ||
          !new RegExp(`^${body.id}/${body.versionId}\\.(mp3|m4a|wav|flac|ogg|aac)$`).test(body.path)) return reply({ error: 'Invalid song or audio version.' }, 400);
        const { error } = await db.rpc('private_music_save_audio', { p_id: body.id, p_version: body.versionId, p_path: body.path,
          p_label: body.label.trim(), p_expected: body.expectedVersion, p_title: body.title?.trim() || null, p_subtitle: body.subtitle?.trim() || '' });
        if (error?.message?.includes('Song changed')) return reply({ error: 'This song changed in another session. Refresh before replacing it again.' }, 409);
        check(error); return reply({ ok: true });
      }
      case 'edit-track':
      case 'archive-track': {
        if (!uuid.test(body.id)) return reply({ error: 'Invalid song.' }, 400);
        const track = await getTrack(body.id);
        if (!track || track.deleted_at) return reply({ error: 'Song unavailable.' }, 404);
        if (body.action === 'edit-track' && (!string(body.title,200) || typeof body.subtitle !== 'string' || body.subtitle.length>300)) return reply({ error: 'Enter a song title.' }, 400);
        if (body.action === 'archive-track' && typeof body.archived !== 'boolean') return reply({ error: 'Invalid archive state.' }, 400);
        const values = body.action === 'edit-track' ? { title: body.title.trim(), subtitle: body.subtitle.trim() } : { archived_at: body.archived ? new Date().toISOString() : null };
        const { error } = await db.from('private_music_tracks').update(values).eq('id',body.id).is('deleted_at',null);
        check(error); return reply({ ok: true });
      }
      case 'preview': {
        if (!uuid.test(body.id)) return reply({ error: 'Invalid song.' }, 400);
        const track = await getTrack(body.id);
        if (!track || track.deleted_at) return reply({ error: 'Song unavailable.' }, 404);
        const { data, error } = await bucket.createSignedUrl(track.storage_path,300);
        check(error); return reply({ url: data!.signedUrl });
      }
      case 'restore-version': {
        if (!uuid.test(body.id) || !uuid.test(body.versionId) || !uuid.test(body.expectedVersion)) return reply({ error: 'Invalid version.' }, 400);
        const { error } = await db.rpc('private_music_restore_audio', { p_id: body.id,p_version: body.versionId,p_expected: body.expectedVersion });
        if (error?.message?.includes('Song changed')) return reply({ error: 'This song changed. Refresh before restoring a version.' },409);
        check(error); return reply({ ok: true });
      }
      case 'delete-track': {
        if (!uuid.test(body.id)) return reply({ error: 'Invalid song.' },400);
        const track = await getTrack(body.id);
        if (!track) return reply({ error: 'Song unavailable.' },404);
        if (body.confirmTitle !== track.title) return reply({ error: 'Type the song title to confirm permanent deletion.' },400);
        const { error } = await db.rpc('private_music_delete_song', { p_id: body.id });
        check(error);
        const { data: versions,error: versionError } = await db.from('private_music_versions').select('storage_path').eq('track_id',body.id);
        check(versionError);
        const paths = versions!.map(v => v.storage_path);
        // Block access transactionally before deleting objects. Failed cleanup is retryable.
        for (let offset=0;offset<paths.length;offset+=100) {
          const { error: removeError } = await bucket.remove(paths.slice(offset,offset+100));
          if (removeError) return reply({ ok:true,cleanupPending:true });
        }
        const { error: doneError } = await db.from('private_music_tracks').update({cleanup_pending:false}).eq('id',body.id);
        check(doneError); return reply({ ok:true,cleanupPending:false });
      }
      case 'create-share':
      case 'edit-share': {
        const ids = body.trackIds;
        if (!string(body.title,200) || !validIds(ids) || typeof body.recipientLabel !== 'string' || body.recipientLabel.length>200 ||
          typeof body.message !== 'string' || body.message.length>2000 || !validExpiry(body.expiresAt)) return reply({ error: 'Enter a title, select songs, and choose a future expiration or none.' },400);
        if (body.action === 'create-share' && !await validateSelection(ids)) return reply({ error: 'One or more songs are archived or unavailable.' },400);
        if (body.action === 'edit-share') {
          if (!uuid.test(body.id)) return reply({ error: 'Invalid share.' },400);
          const { data: existing,error } = await db.from('private_music_shares').select('track_ids').eq('id',body.id).maybeSingle();
          check(error);
          if (!existing) return reply({ error:'Share unavailable.' },404);
          // Existing archived selections can be retained and reordered, but not newly added.
          const added = ids.filter(id => !existing.track_ids.includes(id));
          if (added.length && !await validateSelection(added)) return reply({ error:'New songs must be active.' },400);
          const { data: live,error: liveError } = await db.from('private_music_tracks').select('id').in('id',ids).is('deleted_at',null);
          check(liveError);
          if (live?.length!==ids.length) return reply({ error:'A selected song was deleted.' },400);
        }
        const editing = body.action === 'edit-share';
        const token = editing ? null : randomToken(); const id = editing ? body.id : crypto.randomUUID();
        const { error } = await db.rpc('private_music_save_share', {
          p_id:id,p_title:body.title.trim(),p_recipient:body.recipientLabel.trim(),p_message:body.message.trim(),
          p_tracks:ids,p_expiry:body.expiresAt,p_hash:token ? await hash(token) : null,p_encrypted:token ? await seal(token,id) : null,
        });
        check(error); return reply(editing ? { ok:true } : { token });
      }
      case 'copy-share': {
        if (!uuid.test(body.id)) return reply({ error:'Invalid share.' },400);
        const { data: share,error } = await db.from('private_music_shares').select('id,token_encrypted,token_hash').eq('id',body.id).maybeSingle();
        check(error);
        if (!share?.token_encrypted) return reply({ error:'This older link was saved as a hash only. Use your original saved URL or create a new link.' },409);
        try {
          const token = await unseal(share.token_encrypted,share.id);
          if (await hash(token)!==share.token_hash) throw new Error('Invalid code');
          return reply({ token });
        } catch { return reply({ error:'This link cannot be retrieved with the current server encryption key. Existing saved links still work.' },409); }
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
