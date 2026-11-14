import { request } from './private-api.js';
import { mergeRanges, heardSeconds, listenDelta } from './private-listening.js';
const $ = id => document.getElementById(id);
const audio = $('private-audio');
const token = location.hash.slice(1);
let tracks = [];
let current = null;
let pending = false;
let expired = false;
let expiryTimer;
const sessionId = crypto.randomUUID();
let visitPromise;
function ensureVisit() {
    if (!visitPromise) visitPromise = request('visit',{ token,sessionId }).catch(error => { visitPromise = null; throw error; });
    return visitPromise;
}
const listens = new Map();
let activeListen;
let anchorTime = 0;
let anchorPosition = 0;
let isPlaying = false;
let listenQueue = Promise.resolve();
function sample() {
    const now = performance.now();
    if (activeListen && isPlaying) activeListen.seconds += listenDelta(anchorPosition, audio.currentTime, (now-anchorTime)/1000, audio.playbackRate);
    anchorTime = now; anchorPosition = audio.currentTime;
    if (activeListen) {
        const ranges = [];
        for (let i=0;i<audio.played.length;i++) ranges.push([audio.played.start(i),audio.played.end(i)]);
        activeListen.ranges = mergeRanges([...activeListen.ranges,...ranges]);
    }
}
function report(keepalive = false) {
    if (!activeListen?.started) return;
    const item = activeListen;
    const values = { token,sessionId,trackId:item.trackId,versionId:item.versionId,seconds:item.seconds,coverage:heardSeconds(item.ranges),duration:Number.isFinite(audio.duration)?audio.duration:0 };
    item.lastReport = performance.now();
    // Metrics must never interrupt playback; duplicate/retried cumulative reports are idempotent.
    const send = async () => { await ensureVisit(); await request('listen',values,false,keepalive); };
    if (keepalive) { send().catch(() => {}); return; }
    listenQueue = listenQueue.catch(() => {}).then(send).catch(() => {});
}
function attachListening(track) {
    activeListen = null; isPlaying = false;
    if (!track.versionId) return;
    if (!listens.has(track.versionId)) listens.set(track.versionId,{ trackId:track.id,versionId:track.versionId,seconds:0,ranges:[],started:false,lastReport:0,milestone:0 });
    activeListen = listens.get(track.versionId);
    anchorPosition = 0; anchorTime = performance.now();
}
function render() {
    const focused = document.activeElement?.closest('.private-track')?.dataset.id;
    $('private-tracks').replaceChildren();
    tracks.forEach((track, index) => {
        const button = document.createElement('button');
        button.dataset.id = track.id;
        button.className = `private-track${current === track.id ? ' active' : ''}`;
        button.disabled = expired || pending;
        button.setAttribute('aria-label', `${current === track.id && !audio.paused ? 'Pause' : 'Play'} ${track.title}`);
        const icon = document.createElement('span');
        icon.textContent = current === track.id && !audio.paused ? 'Ⅱ' : current === track.id ? '▶' : String(index+1).padStart(2,'0');
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
    if (focused) Array.from($('private-tracks').children).find(row => row.dataset.id === focused)?.focus({ preventScroll:true });
    updateControls();
}
const format = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}` : '0:00';
function updateControls() {
    const index = tracks.findIndex(track => track.id === current);
    const playing = !audio.paused && !audio.ended;
    $('listen-play').classList.toggle('is-playing',playing);
    $('listen-play').setAttribute('aria-label',playing ? 'Pause song' : 'Play song');
    $('listen-play').disabled = expired || pending || index<0;
    $('listen-previous').disabled = expired || pending || index<=0;
    $('listen-next').disabled = expired || pending || index<0 || index>=tracks.length-1;
    $('custom-controls').classList.toggle('single-song',tracks.length===1);
    $('queue-position').textContent = tracks.length===1 ? 'ONE SONG. JUST FOR YOU.' : `TRACK ${String(index+1).padStart(2,'0')} OF ${String(tracks.length).padStart(2,'0')}`;
    $('listen-elapsed').textContent = format(audio.currentTime);
    $('listen-duration').textContent = format(audio.duration);
    const duration = audio.duration;
    const position = Number.isFinite(duration) && duration>0 ? Math.min(100,audio.currentTime/duration*100) : 0;
    $('listen-seek').disabled = !Number.isFinite(duration) || duration<=0 || expired;
    $('listen-seek').value = position;
    $('listen-seek').style.setProperty('--progress',`${position}%`);
    $('listen-seek').setAttribute('aria-valuetext',`${format(audio.currentTime)} of ${format(duration)}`);
}
$('listen-play').onclick = () => { if (current) select(current,true); };
$('listen-previous').onclick = () => { const index=tracks.findIndex(t=>t.id===current); if(index>0) select(tracks[index-1].id,true); };
$('listen-next').onclick = () => { const index=tracks.findIndex(t=>t.id===current); if(index>=0 && tracks[index+1]) select(tracks[index+1].id,true); };
$('listen-seek').oninput = event => {
    if (Number.isFinite(audio.duration) && audio.duration>0) audio.currentTime = Number(event.target.value)/100*audio.duration;
    updateControls();
};
for (const event of ['loadedmetadata','durationchange','timeupdate','emptied']) audio.addEventListener(event,updateControls);
// Retain native audio controls as a fallback until the custom controls are initialized.
$('custom-controls').hidden = false;
audio.controls = false;
audio.classList.add('enhanced-audio');
function unavailable(message) {
    sample(); report(true); isPlaying = false;
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
    $('share-personal-message').textContent = result.message || '';
    $('share-personal-message').hidden = !result.message;
    document.body.classList.toggle('has-playlist',tracks.length>1);
    $('queue-title').textContent = tracks.length===1 ? 'Your song' : 'The selection';
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
        try { await audio.play(); } catch { $('playback-status').textContent = 'Tap the play button to listen.'; }
        return;
    }
    pending = true; render();
    $('playback-status').textContent = 'Preparing your song…';
    try {
        // Renew short-lived URLs on each song selection; never expose the full catalog.
        await resolve();
        const track = tracks.find(t => t.id === id);
        if (!track) throw new Error('This song is unavailable.');
        sample(); report(); isPlaying = false; activeListen = null;
        current = id; audio.src = track.url; attachListening(track);
        $('now-title').textContent = track.title;
        $('now-subtitle').textContent = track.subtitle || 'Jason Robinson';
        $('private-player').hidden = false;
        $('playback-status').textContent = '';
        if (play) {
            try { await audio.play(); } catch { $('playback-status').textContent = 'Tap the play button to listen.'; }
        }
    } catch (error) { unavailable(error.message); }
    finally { pending = false; render(); }
}
audio.addEventListener('play', render);
audio.addEventListener('playing', () => {
    anchorTime = performance.now(); anchorPosition = audio.currentTime; isPlaying = true;
    if (activeListen && !activeListen.started) { activeListen.started = true; report(); }
    render();
});
audio.addEventListener('timeupdate', () => {
    sample();
    if (!activeListen?.started) return;
    const progress = audio.duration > 0 ? heardSeconds(activeListen.ranges)/audio.duration : 0;
    const milestone = [0.25,0.5,0.75,0.9].filter(value => progress >= value).length;
    if (performance.now()-activeListen.lastReport>=15000 || milestone>activeListen.milestone) { activeListen.milestone=milestone; report(); }
});
for (const event of ['pause','waiting','seeking','ended']) audio.addEventListener(event, () => { sample(); isPlaying = false; report(); render(); });
audio.addEventListener('ratechange', () => { anchorTime=performance.now();anchorPosition=audio.currentTime; });
window.addEventListener('pagehide', () => { sample(); report(true); });
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
    if (document.hidden) { sample(); report(true); }
    if (!document.hidden && !expired && tracks.length) resolve().then(render).catch(error => unavailable(error.message));
});
try {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Open the full private link you were sent to listen.');
    await resolve();
    ensureVisit().catch(() => {});
    $('room-status').hidden = true; $('room').hidden = false;
    // Prepare the first track without autoplay.
    await select(tracks[0].id, false);
} catch (error) { unavailable(error.message); }
