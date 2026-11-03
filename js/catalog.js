(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const audio = $('audio');
    const config = window.catalogConfig || {};
    const connected = Boolean(config.supabaseUrl && config.supabaseKey);
    const folder = 'https://www.dropbox.com/scl/fo/aviu5ocm8b88pjhx2qwmi/ADe644YSV9D3_doFdfgQFnY?rlkey=h3wdz9jqjolwkn8jkal05mupm';
    const clean = (file) => file.replace(/\.(mp3|m4a|wav)$/i, '').replace(/^\d+\s+/, '').replace(/_/g, ' ').replace(/\s+REF(?:\s+JR)?\s*$/i, '').replace(/\s+2025\s+NEW\s*$/i, '').replace(/\s+/g, ' ').trim();
    const tracks = window.musicCatalog.flatMap(({category, files}) => files.map((entry) => {
        const file = typeof entry === 'string' ? entry : entry.file;
        const id = `${category}/${file}`;
        return {id, category, title: typeof entry === 'string' ? clean(file) : entry.title, src: `${folder}&preview=${encodeURIComponent(id)}&raw=1`};
    }));
    let favorites;
    try { favorites = new Set(JSON.parse(localStorage.getItem('df-favorites') || '[]')); } catch { favorites = new Set(); }
    let visitor;
    try { visitor = localStorage.getItem('df-listener'); } catch {}
    visitor ||= crypto.randomUUID();
    try { localStorage.setItem('df-listener', visitor); } catch {}
    let category = 'All tracks';
    let current = null;
    let queue = [...tracks];
    let totals = {};
    let counted = false;
    let listened = 0;
    let lastTime = 0;
    let toastTimer;
    const pendingHearts = new Set();
    const format = (seconds) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
    const number = (n) => new Intl.NumberFormat('en', {notation:'compact', maximumFractionDigits:1}).format(n);
    const rpc = async (name, body) => {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {method:'POST', headers:{'Content-Type':'application/json', apikey:config.supabaseKey, ...(config.supabaseKey.startsWith('eyJ') ? {Authorization:`Bearer ${config.supabaseKey}`} : {})}, body:JSON.stringify(body)});
        if (!response.ok) throw new Error('Activity service unavailable');
        return response.json();
    };
    const toast = (message) => { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); };
    function visible() {
        const query = $('search').value.trim().toLowerCase();
        return tracks.filter(t => (category === 'All tracks' || (category === 'Favorites' ? favorites.has(t.id) : t.category === category)) && `${t.title} ${t.category}`.toLowerCase().includes(query));
    }
    function renderCategories() {
        $('categories').replaceChildren();
        ['All tracks', ...window.musicCatalog.map(c => c.category), 'Favorites'].forEach(name => {
            const button = document.createElement('button');
            button.className = `category${category === name ? ' active' : ''}`;
            button.setAttribute('aria-pressed', String(category === name));
            button.append(document.createTextNode(name === 'Favorites' ? '♡ Favorites' : name));
            const count = document.createElement('span');
            count.textContent = String(name === 'All tracks' ? tracks.length : name === 'Favorites' ? tracks.filter(t => favorites.has(t.id)).length : tracks.filter(t => t.category === name).length).padStart(2, '0');
            button.append(count);
            button.onclick = () => { category = name; renderCategories(); render(); };
            $('categories').append(button);
        });
    }
    function heartLabel(track) { return `${favorites.has(track.id) ? 'Remove' : 'Add'} ${track.title} ${favorites.has(track.id) ? 'from' : 'to'} favorites`; }
    function render() {
        const focused = document.activeElement;
        const focusedTrack = focused?.closest('.track')?.dataset.id;
        const focusedControl = focused?.classList.contains('heart') ? '.heart' : focused?.classList.contains('track-info') ? '.track-info' : '.track-play';
        const filtered = visible();
        $('list-title').textContent = category;
        $('result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'TRACK' : 'TRACKS'}`;
        $('empty').hidden = filtered.length > 0;
        $('track-list').replaceChildren();
        filtered.forEach((track, index) => {
            const row = document.createElement('div'); row.className = `track${current?.id === track.id ? ' active' : ''}`; row.dataset.id = track.id;
            const play = document.createElement('button'); play.className = 'track-play'; play.textContent = current?.id === track.id && !audio.paused ? 'Ⅱ' : String(index + 1).padStart(2, '0'); play.setAttribute('aria-label', `${current?.id === track.id && !audio.paused ? 'Pause' : 'Play'} ${track.title}`);
            const info = document.createElement('button'); info.className = 'track-info'; const title = document.createElement('strong'); title.textContent = track.title; const genre = document.createElement('small'); genre.textContent = track.category; info.append(title, genre); info.setAttribute('aria-label', `Play ${track.title}`);
            play.onclick = info.onclick = () => { if (current?.id === track.id) toggle(); else { queue = [...filtered]; load(track, true); } };
            const plays = document.createElement('span'); plays.className = 'plays'; plays.textContent = totals[track.id] ? `▷ ${number(totals[track.id].plays)}` : '▷ —'; plays.title = totals[track.id] ? `${totals[track.id].plays} plays` : 'Play counts unavailable';
            const heart = document.createElement('button'); heart.className = `heart${favorites.has(track.id) ? ' liked' : ''}`; heart.setAttribute('aria-label', heartLabel(track)); heart.setAttribute('aria-pressed', String(favorites.has(track.id))); heart.disabled = pendingHearts.has(track.id); heart.append(document.createTextNode(favorites.has(track.id) ? '♥' : '♡'));
            if (totals[track.id]) { const count = document.createElement('small'); count.textContent = number(totals[track.id].hearts); heart.append(count); }
            heart.onclick = () => favorite(track);
            row.append(play, info, plays, heart); $('track-list').append(row);
        });
        updateCurrentHeart();
        if (focusedTrack) Array.from($('track-list').children).find(row => row.dataset.id === focusedTrack)?.querySelector(focusedControl)?.focus({preventScroll:true});
    }
    function updateCurrentHeart() {
        $('now-heart').disabled = !current || pendingHearts.has(current.id);
        if (!current) return;
        $('now-heart').textContent = favorites.has(current.id) ? '♥' : '♡';
        $('now-heart').classList.toggle('liked', favorites.has(current.id));
        $('now-heart').setAttribute('aria-label', heartLabel(current));
        $('now-heart').setAttribute('aria-pressed', String(favorites.has(current.id)));
    }
    async function favorite(track) {
        if (pendingHearts.has(track.id)) return;
        const liked = !favorites.has(track.id);
        if (connected) {
            pendingHearts.add(track.id); render();
            try {
                const result = await rpc('catalog_heart', {track_id:track.id, listener_id:visitor, liked});
                totals[track.id] = result;
            } catch { toast('Could not save your heart. Please try again.'); return; }
            finally { pendingHearts.delete(track.id); render(); }
        }
        liked ? favorites.add(track.id) : favorites.delete(track.id);
        try { localStorage.setItem('df-favorites', JSON.stringify([...favorites])); } catch { toast('Favorites will last for this visit. Browser storage is unavailable.'); }
        renderCategories(); render();
        if (!connected && liked) toast('Saved to favorites on this device.');
    }
    function state() { $('play').textContent = audio.paused ? '▶' : 'Ⅱ'; $('play').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); render(); }
    async function startPlayback() { $('status').textContent = ''; try { await audio.play(); } catch { $('status').textContent = 'Playback could not start. Tap play to try again.'; } }
    function load(track, autoplay) {
        if (!track) return;
        current = track; counted = false; listened = 0; lastTime = 0;
        audio.src = track.src; audio.load();
        $('now-title').textContent = track.title; $('now-category').textContent = track.category.toUpperCase();
        $('elapsed').textContent = $('duration').textContent = '0:00'; $('seek').value = 0; $('status').textContent = '';
        const url = new URL(location.href); url.searchParams.set('track', track.id); history.replaceState(null, '', url);
        if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({title:track.title, artist:'Jason Robinson', album:`Dirtyfreqs Media / ${track.category}`, artwork:[{src:new URL('../images/catalog-photo.jpg', location.href).href, sizes:'512x512', type:'image/jpeg'}]});
        state(); if (autoplay) startPlayback();
    }
    function toggle() { if (!current) { queue = visible(); load(queue[0], true); } else if (audio.paused) startPlayback(); else audio.pause(); }
    function skip(direction) { if (!queue.length) queue = [...tracks]; const i = queue.findIndex(t => t.id === current?.id); load(queue[(i + direction + queue.length) % queue.length], true); }
    async function share(trackOnly) {
        const url = new URL(location.href); url.search = ''; url.hash = '';
        if (trackOnly && current) url.searchParams.set('track', current.id);
        const data = {title: trackOnly && current ? `${current.title} — Dirtyfreqs Media` : 'Listen — Dirtyfreqs Media', url:url.href};
        try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast('Link copied. Ready to share.'); } } catch (error) { if (error.name !== 'AbortError') toast('Copy the page address from your browser to share.'); }
    }
    $('search').oninput = render; $('play').onclick = toggle; $('start').onclick = () => { queue = visible(); load(queue[0], true); }; $('previous').onclick = () => skip(-1); $('next').onclick = () => skip(1); $('now-heart').onclick = () => current && favorite(current);
    $('share').onclick = () => share(false); $('share-track').onclick = () => share(true);
    $('volume').oninput = () => { audio.volume = Number($('volume').value); };
    $('seek').oninput = () => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number($('seek').value) / 100 * audio.duration; lastTime = audio.currentTime; } };
    audio.addEventListener('play', state); audio.addEventListener('pause', state);
    audio.addEventListener('loadedmetadata', () => { $('duration').textContent = format(audio.duration); });
    audio.addEventListener('seeking', () => { lastTime = audio.currentTime; });
    audio.addEventListener('timeupdate', () => {
        $('elapsed').textContent = format(audio.currentTime); $('seek').value = audio.duration ? audio.currentTime / audio.duration * 100 : 0;
        const delta = audio.currentTime - lastTime; if (!audio.paused && delta > 0 && delta < 2) listened += delta; lastTime = audio.currentTime;
        if (connected && !counted && listened >= Math.min(30, audio.duration / 2)) {
            counted = true; const id = current.id;
            rpc('catalog_play', {track_id:id, listener_id:visitor}).then(result => { totals[id] = result; render(); }).catch(() => { $('stats-note').textContent = 'Shared activity is temporarily unavailable.'; });
        }
    });
    audio.addEventListener('ended', () => skip(1));
    audio.addEventListener('error', () => { $('status').textContent = 'This track could not load. Tap play to retry, or choose another track.'; });
    if ('mediaSession' in navigator) { navigator.mediaSession.setActionHandler('play', startPlayback); navigator.mediaSession.setActionHandler('pause', () => audio.pause()); navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1)); navigator.mediaSession.setActionHandler('nexttrack', () => skip(1)); }
    renderCategories(); render();
    const requested = new URL(location.href).searchParams.get('track'); load(tracks.find(t => t.id === requested) || tracks[0], false);
    $('stats-note').textContent = connected ? 'Plays count after 30 seconds of listening, or halfway through shorter tracks.' : 'Favorites are saved on this device. Shared activity is not connected yet.';
    if (connected) rpc('catalog_totals', {}).then(result => { totals = Object.fromEntries(result.map(t => [t.track_id, t])); render(); }).catch(() => { $('stats-note').textContent = 'Shared activity is temporarily unavailable. Please refresh to retry.'; });
})();
