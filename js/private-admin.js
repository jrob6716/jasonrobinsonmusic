import { client, configured, request } from './private-api.js';
const $ = id => document.getElementById(id);
let tracks = [];
let busy = false;
function status(message, error = false) { $('admin-status').textContent = message; $('admin-status').classList.toggle('error', error); }
async function run(button, task) {
    if (busy) return;
    busy = true; button.disabled = true;
    try { await task(); } catch (error) { status(error.message, true); }
    finally { busy = false; button.disabled = false; }
}
function clearPrivateUI() {
    $('dashboard').hidden = true; $('login-panel').hidden = false; $('signout').hidden = true;
    $('created-link').hidden = true; $('share-url').value = ''; $('open-link').removeAttribute('href');
    $('song-choices').replaceChildren(); $('share-list').replaceChildren(); tracks = [];
}
async function load() {
    const selected = new Set(Array.from(document.querySelectorAll('input[name=track]:checked'), el => el.value));
    const data = await request('list', {}, true);
    tracks = data.tracks;
    $('song-choices').replaceChildren();
    if (!tracks.length) $('song-choices').textContent = 'Upload your first song to create a link.';
    tracks.forEach(track => {
        const label = document.createElement('label'); label.className = 'song-choice';
        const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'track'; input.value = track.id; input.checked = selected.has(track.id);
        const span = document.createElement('span'); span.textContent = track.title;
        if (track.subtitle) { const small = document.createElement('small'); small.textContent = track.subtitle; span.append(small); }
        label.append(input, span); $('song-choices').append(label);
    });
    $('share-list').replaceChildren();
    if (!data.shares.length) $('share-list').textContent = 'Your shared selections will appear here.';
    data.shares.forEach(share => {
        const row = document.createElement('div'); row.className = 'share-row';
        const info = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = share.title;
        const meta = document.createElement('p'); meta.className = 'muted';
        const state = share.revoked_at ? 'Revoked' : share.expires_at && Date.parse(share.expires_at) <= Date.now() ? 'Expired' : 'Active';
        meta.textContent = `${state} · ${share.track_ids.length} ${share.track_ids.length === 1 ? 'song' : 'songs'} · Created ${new Date(share.created_at).toLocaleDateString()}${share.expires_at ? ` · Expires ${new Date(share.expires_at).toLocaleString()}` : ''}`;
        info.append(title, meta); row.append(info);
        if (state === 'Active') {
            const button = document.createElement('button'); button.className = 'outline'; button.textContent = 'Revoke link';
            button.onclick = () => run(button, async () => {
                await request('revoke', { id: share.id }, true);
                // Clear the freshly-created URL too, since it may be the one just revoked.
                $('created-link').hidden = true; $('share-url').value = ''; $('open-link').removeAttribute('href');
                await load(); status('Link revoked. New audio access is blocked.');
            });
            row.append(button);
        }
        $('share-list').append(row);
    });
}
$('login-form').onsubmit = event => {
    event.preventDefault();
    run(event.submitter, async () => {
        if (!configured) throw new Error('Private music is not connected yet. Follow backend/PRIVATE-MUSIC.md to configure it.');
        status('Signing in…');
        const { error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
        $('password').value = '';
        if (error) throw new Error('Sign in failed. Check your email and password.');
        try { await load(); }
        catch (error) { await client.auth.signOut(); clearPrivateUI(); throw error; }
        $('login-panel').hidden = true; $('dashboard').hidden = false; $('signout').hidden = false; status('');
    });
};
$('signout').onclick = () => run($('signout'), async () => {
    const { error } = await client.auth.signOut();
    clearPrivateUI(); status(error ? 'Session cleared locally. Reload this page before signing in again.' : 'Signed out.');
});
$('upload-form').onsubmit = event => {
    event.preventDefault();
    run(event.submitter, async () => {
        const file = $('song-file').files[0];
        if (!file || file.size === 0 || file.size > 104857600) throw new Error('Choose a nonempty audio file up to 100 MB.');
        const extension = file.name.split('.').pop().toLowerCase();
        const types = { mp3:'audio/mpeg', m4a:'audio/mp4', wav:'audio/wav', flac:'audio/flac', ogg:'audio/ogg', aac:'audio/aac' };
        if (!types[extension]) throw new Error('Choose an MP3, M4A, WAV, FLAC, OGG or AAC file.');
        const title = $('song-title').value.trim(); const subtitle = $('song-subtitle').value.trim();
        status('Uploading your song. Keep this page open…');
        const upload = await request('upload', { title, subtitle, extension }, true);
        const { error } = await client.storage.from('private-music').uploadToSignedUrl(upload.path, upload.token, file, { contentType: types[extension] });
        if (error) throw new Error('Audio upload failed. Please try again.');
        // Retrying the metadata save does not upload the file a second time.
        try { await request('save-track', { id: upload.id, path: upload.path, title, subtitle }, true); }
        catch { throw new Error(`Audio uploaded, but saving the song failed. Ask your site administrator to recover storage object ${upload.path} before uploading it again.`); }
        $('upload-form').reset(); await load(); status('Song uploaded. Select it to create a private link.');
    });
};
$('share-form').onsubmit = event => {
    event.preventDefault();
    run(event.submitter, async () => {
        const trackIds = Array.from(document.querySelectorAll('input[name=track]:checked'), el => el.value);
        if (!trackIds.length) throw new Error('Select at least one song.');
        const value = $('expires-at').value;
        const expiresAt = value ? new Date(value).toISOString() : null;
        if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error('Choose an expiration date in the future.');
        status('Creating your listening link…');
        const { token } = await request('create-share', { title: $('selection-title').value.trim(), trackIds, expiresAt }, true);
        const url = new URL('../', location.href); url.hash = token;
        $('share-url').value = url.href; $('open-link').href = url.href; $('created-link').hidden = false;
        status('Your private link is ready. Copy and save it below.');
        // Keep the new link visible even if refreshing the list fails.
        try { await load(); } catch { status('Your link is ready. The selection list could not refresh; save your link, then press Refresh.'); }
    });
};
$('copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText($('share-url').value); status('Private link copied.'); }
    catch { $('share-url').focus(); $('share-url').select(); status('Select and copy the link from the field.'); }
};
$('refresh').onclick = () => run($('refresh'), async () => { await load(); status('Selections refreshed.'); });
window.addEventListener('pagehide', () => { $('share-url').value = ''; });
if (!configured) {
    status('Private music is not connected yet. Complete backend/PRIVATE-MUSIC.md to activate uploads and sharing.');
    $('login-form').querySelector('button').disabled = true;
}
