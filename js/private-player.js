import { request } from './private-api.js';
const $ = id => document.getElementById(id);
const audio = $('private-audio');
const token = location.hash.slice(1);
let tracks = [];
let current = null;
let pending = false;
let expired = false;
let expiryTimer;
function render() {
    $('private-tracks').replaceChildren();
    tracks.forEach((track, index) => {
        const button = document.createElement('button');
        button.className = `private-track${current === track.id ? ' active' : ''}`;
        button.disabled = expired || pending;
        button.setAttribute('aria-label', `${current === track.id && !audio.paused ? 'Pause' : 'Play'} ${track.title}`);
        const icon = document.createElement('span');
        icon.textContent = current === track.id && !audio.paused ? 'Ⅱ' : '▶';
        icon.setAttribute('aria-hidden', 'true');
        const info = document.createElement('span');
        const title = document.createElement('strong'); title.textContent = track.title;
        const subtitle = document.createElement('small'); subtitle.textContent = track.subtitle || 'Jason Robinson';
        info.append(title, subtitle);
        const number = document.createElement('span'); number.textContent = `PRIVATE / ${String(index + 1).padStart(2, '0')}`;
        button.append(icon, info, number);
        button.onclick = () => select(track.id, true);
        $('private-tracks').append(button);
    });
}
function unavailable(message) {
    expired = true;
    clearTimeout(expiryTimer);
    audio.pause(); audio.removeAttribute('src'); audio.load();
    $('private-player').hidden = true; $('room').hidden = true;
    $('room-status').hidden = false; $('room-status').textContent = message;
}
async function resolve() {
    const result = await request('resolve', { token });
    tracks = result.tracks;
    if (!tracks.length) throw new Error('There are no songs in this selection.');
    $('share-title').textContent = result.title;
    $('track-count').textContent = `${tracks.length} ${tracks.length === 1 ? 'SONG' : 'SONGS'}`;
    $('expiry').textContent = result.expiresAt ? `Available until ${new Date(result.expiresAt).toLocaleString()}` : '';
    clearTimeout(expiryTimer);
    if (result.expiresAt) {
        // Recheck long expirations daily to stay within browser timer limits.
        const delay = Date.parse(result.expiresAt) - Date.now();
        expiryTimer = setTimeout(() => {
            if (Date.parse(result.expiresAt) <= Date.now()) unavailable('This listening link has expired.');
            else resolve().catch(error => unavailable(error.message));
        }, Math.min(Math.max(0, delay), 86400000));
    }
    return result;
}
async function select(id, play) {
    if (pending || expired) return;
    if (current === id && audio.src && play) {
        if (!audio.paused) { audio.pause(); return; }
        try { await audio.play(); } catch { $('playback-status').textContent = 'Press play on the audio controls to listen.'; }
        return;
    }
    pending = true; render();
    $('playback-status').textContent = 'Preparing your song…';
    try {
        // Renew short-lived URLs on each song selection; never expose the full catalog.
        await resolve();
        const track = tracks.find(t => t.id === id);
        if (!track) throw new Error('This song is unavailable.');
        current = id; audio.src = track.url;
        $('now-title').textContent = track.title;
        $('private-player').hidden = false;
        $('playback-status').textContent = '';
        if (play) {
            try { await audio.play(); } catch { $('playback-status').textContent = 'Press play on the audio controls to listen.'; }
        }
    } catch (error) { unavailable(error.message); }
    finally { pending = false; render(); }
}
audio.addEventListener('play', render);
audio.addEventListener('pause', render);
audio.addEventListener('ended', () => {
    const next = tracks[tracks.findIndex(t => t.id === current) + 1];
    if (next) select(next.id, true);
    else render();
});
audio.addEventListener('error', () => {
    if (!expired && audio.getAttribute('src')) {
        $('playback-status').textContent = 'Playback interrupted. Select the song again to reconnect.';
        current = null; render();
    }
});
window.addEventListener('hashchange', () => location.reload());
// Revalidate access when returning to an idle page.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !expired && tracks.length) resolve().then(render).catch(error => unavailable(error.message));
});
try {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Open the full private link you were sent to listen.');
    await resolve();
    $('room-status').hidden = true; $('room').hidden = false;
    // Prepare the first track without autoplay.
    await select(tracks[0].id, false);
} catch (error) { unavailable(error.message); }
