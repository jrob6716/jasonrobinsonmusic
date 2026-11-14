// Exercise the real handler/SDK against a mocked Supabase transport. No project is modified.
Deno.env.set('SUPABASE_URL', 'https://private-music-test.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
const id = '8b8a1aa1-1111-4111-8111-111111111111';
const code = 'a'.repeat(64);
let mode = 'valid';
let storageCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = String(input);
  let result: unknown;
  if (url.includes('/auth/v1/user')) result = { id, aud: 'authenticated' };
  else if (url.includes('/private_music_admins')) result = mode === 'non-admin' ? null : { user_id: id };
  else if (url.includes('/private_music_shares') && (!init?.method || init.method === 'GET')) result = mode === 'missing' ? null : {
    id, title: 'A private song', track_ids: [id], revoked_at: mode === 'revoked' ? new Date().toISOString() : null,
    expires_at: mode === 'expired' ? '2000-01-01T00:00:00Z' : null,
  };
  else if (url.includes('/private_music_tracks') && init?.method === 'POST') result = null;
  else if (url.includes('/private_music_tracks')) result = [{ id, title: 'Song one', subtitle: 'Demo', storage_path: `${id}.mp3` }];
  else if (url.includes('/storage/v1/object/upload/sign/')) result = { url: '/object/upload/sign/private-music/test.mp3?token=upload-token' };
  else if (url.includes('/storage/v1/object/list/')) result = [{ name: `${id}.mp3` }];
  else if (url.includes('/storage/v1/object/sign/')) { storageCalls++; result = { signedURL: '/object/sign/private-music/test.mp3?token=short-lived' }; }
  else if (url.includes('/private_music_shares') && init?.method === 'POST') result = null;
  else throw new Error(`Unexpected test request: ${url}`);
  return Promise.resolve(new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } }));
};
const { handleRequest } = await import('./handler.ts');
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
function call(body: unknown, signedIn = false) {
  return handleRequest(new Request('https://test/functions/v1/private-music', { method: 'POST', headers: {
    'Content-Type': 'application/json', Origin: 'https://dirtyfreqs.com', ...(signedIn ? { Authorization: 'Bearer user-token' } : {}),
  }, body: JSON.stringify(body) }));
}
Deno.test('private music access boundaries', async () => {
  try {
    let response = await call({ action: 'resolve', token: code });
    const data = await response.json();
    assert(response.status === 200 && data.tracks.length === 1 && data.tracks[0].id === id, 'valid link returns exactly its selected song');
    assert(!JSON.stringify(data).includes('storage_path') && !JSON.stringify(data).includes('token_hash'), 'private database fields are omitted');
    for (const state of ['missing', 'revoked', 'expired']) {
      mode = state; storageCalls = 0;
      response = await call({ action: 'resolve', token: code });
      assert(response.status === 404 && storageCalls === 0, `${state} link cannot obtain audio URLs`);
    }
    response = await call({ action: 'resolve', token: 'guess' });
    assert(response.status === 404, 'invalid token rejected');
    for (const action of ['list','upload','save-track','create-share','revoke']) {
      response = await call({ action });
      assert(response.status === 401, `anonymous ${action} rejected`);
    }
    mode = 'non-admin';
    response = await call({ action: 'list' }, true);
    assert(response.status === 403, 'signed-in non-admin rejected');
    mode = 'valid';
    response = await call({ action: 'upload', title: 'Demo', subtitle: '', extension: 'mp3' }, true);
    const upload = await response.json();
    assert(response.status === 200 && upload.path.endsWith('.mp3') && upload.token === 'upload-token', 'admin receives scoped audio upload authorization');
    response = await call({ action: 'save-track', id, title: 'Demo', subtitle: '', path: `${id}.mp3` }, true);
    assert(response.status === 200, 'uploaded audio metadata can be saved');
    response = await call({ action: 'save-track', id, title: 'Demo', subtitle: '', path: 'another-song.mp3' }, true);
    assert(response.status === 400, 'cannot attach an unrelated storage object');
    response = await call({ action: 'upload', title: 'Demo', subtitle: '', extension: 'html' }, true);
    assert(response.status === 400, 'non-audio upload rejected');
    response = await call({ action: 'create-share', title: 'test', trackIds: [id, id] }, true);
    assert(response.status === 400, 'duplicate tracks rejected');
    response = await call({ action: 'create-share', title: 'test', trackIds: [id], expiresAt: '2000-01-01' }, true);
    assert(response.status === 400, 'past expiration rejected');
    response = await call({ action: 'create-share', title: 'test', trackIds: [id] }, true);
    const created = await response.json();
    assert(response.status === 200 && /^[a-f0-9]{64}$/.test(created.token), 'admin receives random access code');
    response = await handleRequest(new Request('https://test', { method: 'POST', headers: { Origin: 'https://other-site.test' }, body: '{}' }));
    assert(response.status === 403, 'unconfigured browser origin rejected');
    response = await handleRequest(new Request('https://test'));
    assert(response.status === 405, 'GET requests rejected');
    assert(response.headers.get('Cache-Control') === 'no-store', 'responses are not cached');
  } finally { globalThis.fetch = realFetch; }
});
