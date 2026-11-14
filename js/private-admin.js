import { client, configured, request } from './private-api.js';
const $ = id => document.getElementById(id);
let data = { tracks: [], shares: [], versions: [], activity: { shares: [], versions: [] } };
let busy = false;
let choiceOrder = [];
let dialogTask;
const dialog = $('manage-dialog');
const mobile = matchMedia('(max-width: 700px)');
let mobileView = 'songs';
let statusTimer;
document.body.dataset.mobileReady = 'true';
function setAdminView(view, scroll = false) {
    mobileView = view;
    document.body.dataset.adminView = view;
    document.querySelectorAll('.admin-nav a').forEach(link => {
        const selected = link.dataset.adminView === view;
        link.classList.toggle('active', selected);
        if (mobile.matches && selected) link.setAttribute('aria-current','page');
        else link.removeAttribute('aria-current');
    });
    if (scroll && mobile.matches) window.scrollTo({ top: 0, behavior: 'instant' });
}
document.querySelectorAll('.admin-nav a').forEach(link => link.addEventListener('click', event => {
    if (mobile.matches) { event.preventDefault(); setAdminView(link.dataset.adminView,true); }
}));
function syncMobile() {
    setAdminView(mobileView);
    document.querySelectorAll('.song-more,.share-options').forEach(details => { details.open = !mobile.matches; });
}
mobile.addEventListener('change',syncMobile);
syncMobile();
const date = value => value ? new Date(value).toLocaleString() : 'None';
const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
};
function status(message, error = false) {
    clearTimeout(statusTimer);
    $('admin-status').textContent = message; $('admin-status').classList.toggle('error', error);
    if (mobile.matches && message && !message.includes('…')) statusTimer = setTimeout(() => { $('admin-status').textContent = ''; }, error ? 12000 : 6500);
}
async function run(button, task) {
    if (busy) return;
    busy = true; button.disabled = true;
    $('dialog-error').textContent = '';
    try { await task(); }
    catch (error) {
        status(error.message, true);
        if (dialog.open) $('dialog-error').textContent = error.message;
    } finally { busy = false; button.disabled = false; }
}
function action(label, task, danger = false) {
    const button = el('button', label, `outline${danger ? ' danger' : ''}`); button.type = 'button';
    button.onclick = () => run(button, task);
    return button;
}
function closeDialog() { dialog.close(); $('dialog-body').replaceChildren(); dialogTask = null; }
function openDialog(title, markup, task, submit = 'Save changes') {
    $('dialog-title').textContent = title; $('dialog-body').innerHTML = markup;
    $('dialog-error').textContent = ''; $('dialog-submit').textContent = submit;
    $('dialog-submit').hidden = !task; dialogTask = task;
    dialog.showModal();
}
$('close-dialog').onclick = () => { if (!busy) closeDialog(); };
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('manage-form').onsubmit = event => {
    event.preventDefault();
    if (dialogTask) run($('dialog-submit'), dialogTask);
};
function clearPrivateUI() {
    $('admin-preview').pause(); $('admin-preview').removeAttribute('src'); $('admin-preview').load();
    $('admin-preview').hidden = true; $('preview-title').textContent = '';
    document.body.classList.remove('signed-in');
    $('dashboard').hidden = true; $('login-panel').hidden = false; $('signout').hidden = true;
    $('created-link').hidden = true; $('share-url').value = ''; $('open-link').removeAttribute('href');
    for (const id of ['song-choices','share-list','song-manager','activity-summary','version-activity']) $(id).replaceChildren();
    $('share-form').reset(); $('upload-form').reset(); if (dialog.open) closeDialog();
    data = { tracks: [], shares: [], versions: [], activity: { shares: [], versions: [] } }; choiceOrder = [];
}
function selectedIds(root = $('song-choices')) { return Array.from(root.querySelectorAll('input:checked'), input => input.value); }
function renderChoices(root, tracks, selected, order = tracks.map(t => t.id)) {
    root.replaceChildren();
    const sorted = order.map(id => tracks.find(t => t.id === id)).filter(Boolean);
    sorted.push(...tracks.filter(t => !order.includes(t.id)));
    if (!sorted.length) { root.textContent = 'Upload an active song to create a link.'; return; }
    sorted.forEach((track, index) => {
        const row = el('div', undefined, 'choice-row');
        const label = el('label', undefined, 'song-choice');
        const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'track'; input.value = track.id; input.checked = selected.includes(track.id);
        const info = el('span', track.title + (track.archived_at ? ' (archived)' : ''));
        if (track.subtitle) info.append(el('small', track.subtitle));
        label.append(input, info);
        const controls = el('div', undefined, 'choice-order');
        for (const [symbol, offset, word] of [['↑',-1,'up'],['↓',1,'down']]) {
            const button = el('button', symbol); button.type = 'button'; button.setAttribute('aria-label', `Move ${track.title} ${word}`);
            button.disabled = index + offset < 0 || index + offset >= sorted.length;
            button.onclick = () => {
                const checked = selectedIds(root); const ids = sorted.map(t => t.id);
                [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
                if (root === $('song-choices')) choiceOrder = ids;
                renderChoices(root, tracks, checked, ids);
                root.querySelector(`button[aria-label="Move ${CSS.escape(track.title)} ${word}"]`)?.focus();
            };
            controls.append(button);
        }
        row.append(label, controls); root.append(row);
    });
}
async function load() {
    const selected = selectedIds();
    const result = await request('list', {}, true);
    if (result.apiVersion !== 2) throw new Error('The music backend needs its management update before this admin screen can be used.');
    data = result;
    const active = data.tracks.filter(t => !t.archived_at && !t.deleted_at);
    renderChoices($('song-choices'), active, selected, choiceOrder.length ? choiceOrder : active.map(t => t.id));
    renderSongs(); renderShares(); renderActivity();
}
function linksFor(track) { return data.shares.filter(s => s.track_ids.includes(track.id)); }
function renderSongs() {
    const root = $('song-manager'); root.replaceChildren();
    const query = $('song-search').value.trim().toLowerCase();
    const tracks = data.tracks.filter(t => (!t.deleted_at || t.cleanup_pending) && ($('show-archived').checked || !t.archived_at || t.cleanup_pending) && `${t.title} ${t.subtitle} ${data.versions.filter(v => v.track_id === t.id).map(v => v.label).join(" ")}`.toLowerCase().includes(query));
    if (!tracks.length) root.append(el('p', 'No songs match this view.', 'muted'));
    tracks.forEach(track => {
        const card = el('article', undefined, 'song-card');
        const heading = el('div', undefined, 'song-card-heading'); heading.append(el('h3', track.title));
        heading.append(el('span', track.deleted_at ? 'CLEANUP PENDING' : track.archived_at ? 'ARCHIVED' : 'ACTIVE', 'badge'));
        const versions = data.versions.filter(v => v.track_id === track.id);
        const current = versions.find(v => v.id === track.current_version_id);
        card.append(heading, el('p', `${track.subtitle || 'Jason Robinson'} · ${current?.label || 'Current mix'} · ${versions.length} audio ${versions.length === 1 ? 'version' : 'versions'}`, 'muted'));
        const shares = linksFor(track);
        card.append(el('p', `${shares.length} shared ${shares.length === 1 ? 'selection' : 'selections'} reference this song.`, 'muted'));
        const controls = el('div', undefined, 'row-actions');
        if (track.deleted_at) controls.append(action('Retry audio cleanup', () => deleteTrack(track), true));
        else {
            controls.append(
                action('Preview', async () => {
                    const { url } = await request('preview', { id: track.id }, true);
                    $('admin-preview').src = url; $('admin-preview').hidden = false; $('preview-title').textContent = `Previewing: ${track.title} / ${current?.label || 'Current mix'}`;
                    await $('admin-preview').play();
                }),
                action('Replace audio', () => replaceAudio(track))
            );
            const more = el('details', undefined, 'song-more'); more.open = !mobile.matches;
            more.append(el('summary', 'More options'));
            const secondary = el('div', undefined, 'row-actions secondary-actions');
            secondary.append(
                action('Edit details', () => editTrack(track)),
                action('Version history', () => versionHistory(track)),
                action(track.archived_at ? 'Unarchive' : 'Archive', async () => {
                    await request('archive-track', { id: track.id, archived: !track.archived_at }, true);
                    await load(); status(track.archived_at ? 'Song returned to the active library.' : 'Song archived. Existing sharing links still work.');
                }),
                action('Delete permanently', () => deleteTrack(track), true)
            );
            more.append(secondary); controls.append(more);
        }
        card.append(controls); root.append(card);
    });
}
function editTrack(track) {
    openDialog('Edit song details', '<label>Title<input id="edit-title" maxlength="200" required></label><label>Artist or version<input id="edit-subtitle" maxlength="300"></label>', async () => {
        await request('edit-track', { id: track.id, title: $('edit-title').value.trim(), subtitle: $('edit-subtitle').value.trim() }, true);
        closeDialog(); await load(); status('Song details updated across existing links.');
    });
    $('edit-title').value = track.title; $('edit-subtitle').value = track.subtitle;
}
const fileTypes = { mp3:'audio/mpeg', m4a:'audio/mp4', wav:'audio/wav', flac:'audio/flac', ogg:'audio/ogg', aac:'audio/aac' };
async function uploadAudio(file, values, label) {
    if (!file || file.size === 0 || file.size > 104857600) throw new Error('Choose a nonempty audio file up to 100 MB.');
    const extension = file.name.split('.').pop().toLowerCase();
    if (!fileTypes[extension]) throw new Error('Choose an MP3, M4A, WAV, FLAC, OGG or AAC file.');
    const upload = await request('upload', { ...values, extension }, true);
    const { error } = await client.storage.from('private-music').uploadToSignedUrl(upload.path, upload.token, file, { contentType: fileTypes[extension], cacheControl: '60' });
    if (error) throw new Error('Audio upload failed. Your current mix has not changed.');
    try { await request('save-track', { ...upload, token: undefined, title: values.title, subtitle: values.subtitle, label }, true); }
    catch (error) { throw new Error(`${error.message} Your existing mix remains available. The uploaded file may need cleanup by your site administrator.`); }
}
function replaceAudio(track) {
    openDialog('Replace audio', '<p class="muted">The new mix will play through the same sharing links. The current version is kept so you can restore it. Someone already listening may finish the previous mix.</p><label>Version label<input id="version-label" maxlength="100" placeholder="Mix 2 — revised vocal" required></label><label>New audio file<input id="replacement-file" type="file" accept=".mp3,.m4a,.wav,.flac,.ogg,.aac" required></label>', async () => {
        const label = $('version-label').value.trim(); const file = $('replacement-file').files[0];
        $('dialog-error').textContent = 'Uploading replacement. Keep this page open…';
        await uploadAudio(file, { trackId: track.id }, label);
        $('admin-preview').pause(); $('admin-preview').hidden = true; $('preview-title').textContent = '';
        closeDialog(); await load(); status('Audio replaced. All existing sharing links now load the new mix.');
    }, 'Upload replacement');
}
function versionHistory(track) {
    openDialog('Version history', '<p class="muted">Restoring a version keeps the same sharing links and retains the other mixes.</p><div id="version-list"></div>', null);
    data.versions.filter(v => v.track_id === track.id).forEach(version => {
        const row = el('div', undefined, 'version-choice');
        const text = el('div'); text.append(el('strong', version.label), el('p', date(version.created_at), 'muted'));
        const metrics = data.activity.versions.find(v => v.id === version.id);
        if (metrics) text.append(el('p', `${metrics.starts} starts · ${metrics.engaged} engaged · ${metrics.completions} completions`, 'muted'));
        row.append(text);
        if (version.id === track.current_version_id) row.append(el('span', 'CURRENT', 'badge'));
        else row.append(action('Restore this version', async () => {
            await request('restore-version', { id: track.id, versionId: version.id, expectedVersion: track.current_version_id }, true);
            closeDialog(); await load(); status('Previous audio version restored. Sharing links are unchanged.');
        }));
        $('version-list').append(row);
    });
}
function deleteTrack(track) {
    const affected = linksFor(track);
    openDialog(track.deleted_at ? 'Retry audio cleanup' : 'Delete song permanently', '<p class="muted">This deletes every audio version and cannot be undone. Single-song links will be revoked. Other playlists will keep working with this song removed. Historical listening totals will remain.</p><div id="affected-links"></div><label>Type the exact song title to confirm<input id="delete-title" required autocomplete="off"></label>', async () => {
        const confirmTitle = $('delete-title').value;
        if (confirmTitle !== track.title) throw new Error('Type the exact song title to confirm.');
        const result = await request('delete-track', { id: track.id, confirmTitle }, true);
        $('admin-preview').pause(); $('admin-preview').hidden = true; $('preview-title').textContent = '';
        closeDialog(); await load();
        status(result.cleanupPending ? 'Song access removed. Audio cleanup could not finish; use Retry audio cleanup.' : 'Song and all audio versions deleted. Affected links have been updated.');
    }, track.deleted_at ? 'Retry cleanup' : 'Delete permanently');
    $('affected-links').append(el('p', `Song: ${track.title}`, 'muted'));
    affected.forEach(s => $('affected-links').append(el('p', `${s.title}${s.recipient_label ? ` / ${s.recipient_label}` : ''} — ${s.track_ids.length === 1 ? 'link will be revoked' : 'song will be removed'}`, 'muted')));
    if (!affected.length) $('affected-links').append(el('p', 'No current sharing selections reference this song.', 'muted'));
}
function shareState(share) { return share.revoked_at ? 'Revoked' : share.expires_at && Date.parse(share.expires_at) <= Date.now() ? 'Expired' : 'Active'; }
function showLink(token) {
    const url = new URL('../', location.href); url.hash = token;
    $('share-url').value = url.href; $('open-link').href = url.href; $('created-link').hidden = false;
    $('send-link').hidden = !navigator.share;
    setAdminView('create');
}
function renderShares() {
    const root = $('share-list'); root.replaceChildren(); const query = $('share-search').value.trim().toLowerCase();
    const shares = data.shares.filter(s => `${s.title} ${s.recipient_label}`.toLowerCase().includes(query));
    if (!shares.length) root.append(el('p', 'No shared selections match this view.', 'muted'));
    shares.forEach(share => {
        const row = el('article', undefined, 'share-row');
        row.append(el('strong', share.title));
        if (share.recipient_label) row.append(el('p', `For: ${share.recipient_label}`, 'muted'));
        row.append(el('p', `${shareState(share)} · ${share.track_ids.length} songs · Expires: ${date(share.expires_at)}`, 'muted'));
        const stats = data.activity.shares.find(s => s.id === share.id);
        if (stats) row.append(el('p', `${stats.opens} opens · ${stats.starts} starts · ${stats.engaged} engaged · ${stats.completions} completions · Last activity: ${date(stats.last_at)}`, 'stats-line'));
        const controls = el('div', undefined, 'row-actions');
        if (share.canCopy) controls.append(action('Get link', async () => {
            const { token } = await request('copy-share', { id: share.id }, true); showLink(token);
            $('created-link').scrollIntoView({ behavior: 'smooth', block: 'center' }); status('Link retrieved. Copy it from the link field.');
        }));
        else row.append(el('p', 'Older link: use your saved URL. It cannot be retrieved from its original hash.', 'muted'));
        if (!share.revoked_at) controls.append(action('Edit selection', () => editShare(share)), action('Revoke link', async () => {
            await request('revoke', { id: share.id }, true);
            $('created-link').hidden = true; $('share-url').value = ''; $('open-link').removeAttribute('href');
            await load(); status('Link revoked. New audio access is blocked.');
        }));
        row.append(controls); root.append(row);
    });
}
function localDate(value) {
    if (!value) return '';
    const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
function editShare(share) {
    openDialog('Edit shared selection', '<label>Title<input id="edit-share-title" maxlength="200" required></label><label>Recipient label (only you see this)<input id="edit-recipient" maxlength="200"></label><label>Personal message<textarea id="edit-message" maxlength="2000" rows="3"></textarea></label><fieldset><legend>Songs in playback order</legend><div id="edit-choices"></div></fieldset><label>Expiration (clear for no expiration)<input id="edit-expiry" type="datetime-local"></label>', async () => {
        const trackIds = selectedIds($('edit-choices'));
        if (!trackIds.length) throw new Error('Select at least one song.');
        await request('edit-share', { id: share.id, title: $('edit-share-title').value.trim(), recipientLabel: $('edit-recipient').value.trim(), message: $('edit-message').value.trim(), trackIds, expiresAt: expiration($('edit-expiry').value) }, true);
        closeDialog(); await load(); status('Selection updated. The sharing link is unchanged.');
    });
    $('edit-share-title').value = share.title; $('edit-recipient').value = share.recipient_label;
    $('edit-message').value = share.message; $('edit-expiry').value = localDate(share.expires_at);
    const tracks = data.tracks.filter(t => !t.deleted_at && (!t.archived_at || share.track_ids.includes(t.id)));
    renderChoices($('edit-choices'), tracks, share.track_ids, share.track_ids);
}
function renderActivity() {
    const root = $('activity-summary'); root.replaceChildren();
    for (const [field,label] of [['opens','Page opens'],['starts','Playback starts'],['engaged','30-second listens'],['completions','90% completions']]) {
        const value = data.activity.shares.reduce((sum,s) => sum + Number(s[field]),0);
        const metric = el('div', undefined, 'metric'); metric.append(el('strong', String(value)),el('span',label)); root.append(metric);
    }
    $('version-activity').replaceChildren();
    data.activity.versions.forEach(version => {
        const track = data.tracks.find(t => t.id === version.track_id);
        const row = el('div',undefined,'version-row');
        row.append(el('strong', `${track?.title || 'Deleted song'} / ${version.label}${track?.deleted_at ? ' (deleted)' : ''}`));
        row.append(el('span', `${version.starts} starts · ${version.p25} reached 25% · ${version.p50} reached 50% · ${version.p75} reached 75% · ${version.completions} completed · ${Math.round(Number(version.seconds)/60)} min heard`, 'stats-line'));
        $('version-activity').append(row);
    });
}
function expiration(value) {
    if (!value) return null;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time) || time <= Date.now()) throw new Error('Choose an expiration date in the future, or clear it.');
    return new Date(time).toISOString();
}
$('login-form').onsubmit = event => {
    event.preventDefault(); run(event.submitter, async () => {
        if (!configured) throw new Error('Private music is not connected yet.');
        status('Signing in…');
        const { error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value }); $('password').value = '';
        if (error) throw new Error('Sign in failed. Check your email and password.');
        try { await load(); } catch (error) { await client.auth.signOut(); clearPrivateUI(); throw error; }
        document.body.classList.add('signed-in'); setAdminView('songs');
        $('login-panel').hidden = true; $('dashboard').hidden = false; $('signout').hidden = false; status('');
    });
};
$('signout').onclick = () => run($('signout'), async () => { await client.auth.signOut({ scope:'local' }); clearPrivateUI(); status('Signed out.'); });
$('upload-form').onsubmit = event => {
    event.preventDefault(); run(event.submitter, async () => {
        const values = { title: $('song-title').value.trim(), subtitle: $('song-subtitle').value.trim() };
        status('Uploading your song. Keep this page open…');
        await uploadAudio($('song-file').files[0], values, 'Original upload');
        $('upload-form').reset(); await load(); status('Song uploaded. Select it to create a private link.');
    });
};
$('share-form').onsubmit = event => {
    event.preventDefault(); run(event.submitter, async () => {
        const trackIds = selectedIds();
        if (!trackIds.length) throw new Error('Select at least one song.');
        status('Creating your listening link…');
        const { token } = await request('create-share', { title: $('selection-title').value.trim(), trackIds, expiresAt: expiration($('expires-at').value), recipientLabel: $('recipient-label').value.trim(), message: $('share-message').value.trim() }, true);
        showLink(token); $('created-link').scrollIntoView({ behavior:'smooth', block:'center' }); status('Your private link is ready. Copy it below.');
        try { await load(); } catch { status('Your link is ready. Save it, then refresh the selections.'); }
    });
};
$('send-link').onclick = async () => {
    if (!navigator.share || !$('share-url').value) return;
    try { await navigator.share({ title: 'Private listening — Dirtyfreqs Media', url: $('share-url').value }); }
    catch (error) { if (error.name !== 'AbortError') status('Sharing is unavailable here. Use Copy link instead.', true); }
};
$('copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText($('share-url').value); status('Private link copied.'); }
    catch { $('share-url').focus(); $('share-url').select(); status('Select and copy the link from the field.'); }
};
$('refresh').onclick = () => run($('refresh'), async () => { await load(); status('Music, shares and listening activity refreshed.'); });
$('song-search').oninput = $('show-archived').onchange = renderSongs;
$('share-search').oninput = renderShares;
window.addEventListener('pagehide', () => { $('share-url').value = ''; });
if (!configured) { status('Private music is not connected yet. Complete backend/PRIVATE-MUSIC.md to activate it.'); $('login-form').querySelector('button').disabled = true; }
