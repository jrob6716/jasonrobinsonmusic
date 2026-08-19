// ===================================
// Mobile Navigation Toggle
// ===================================

document.body.classList.add('motion-ready');
requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add('loaded'));
});

const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

// Toggle mobile menu
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// ===================================
// Smooth Scrolling for Navigation Links
// ===================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===================================
// Header Background on Scroll
// ===================================

const header = document.querySelector('.header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
// Mark the compact header state when scrolled
    if (currentScroll > 50) {
        header.classList.add('is-scrolled');
    } else {
        header.classList.remove('is-scrolled');
    }
    
    lastScroll = currentScroll;
});

// ===================================
// Intersection Observer for Fade-in Animations
// ===================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe elements for animation
const animateElements = document.querySelectorAll('.section-heading, .section-intro, .playlist-container, .production-stats, .catalog-player, .music-stats, .portfolio-group-title, .sync-video-card, .contact-content');
animateElements.forEach((el, index) => {
    el.classList.add('reveal-item');
    el.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
    observer.observe(el);
});

// ===================================
// Active Navigation Link on Scroll
// ===================================

const sections = document.querySelectorAll('section[id]');

function highlightNavigation() {
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLink?.classList.add('active');
        } else {
            navLink?.classList.remove('active');
        }
    });
}

window.addEventListener('scroll', highlightNavigation);

// ===================================
// Lazy Loading for Iframes
// ===================================

const iframes = document.querySelectorAll('iframe');

const iframeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const iframe = entry.target;
            if (iframe.dataset.src) {
                iframe.src = iframe.dataset.src;
                iframe.removeAttribute('data-src');
            }
            iframeObserver.unobserve(iframe);
        }
    });
}, { rootMargin: '50px' });

iframes.forEach(iframe => {
    // Uncomment below to enable lazy loading
    // if (iframe.src) {
    //     iframe.dataset.src = iframe.src;
    //     iframe.src = '';
    // }
    // iframeObserver.observe(iframe);
});

// ===================================
// Console Welcome Message
// ===================================

console.log('%c🎵 Music Portfolio Website', 'font-size: 20px; font-weight: bold; color: #d4a574;');
console.log('%cBuilt with HTML, CSS, and JavaScript', 'font-size: 14px; color: #b0b0b0;');
console.log('%cCustomize this template with your own content!', 'font-size: 12px; color: #808080;');

// ===================================
// Performance Optimization
// ===================================

// Debounce function for scroll events
function debounce(func, wait = 10) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll-heavy functions
window.addEventListener('scroll', debounce(highlightNavigation, 10));

// ===================================
// Accessibility Enhancements
// ===================================

// Skip to main content
const skipLink = document.createElement('a');
skipLink.href = '#discography';
skipLink.className = 'skip-link';
skipLink.textContent = 'Skip to main content';
document.body.insertBefore(skipLink, document.body.firstChild);

const currentYear = document.getElementById('current-year');
if (currentYear) currentYear.textContent = new Date().getFullYear();

// ===================================
// Grammy Video Dialog
// ===================================

const awardTrigger = document.querySelector('.hero-award-trigger');
const awardDialog = document.getElementById('grammy-video-dialog');

if (awardTrigger && awardDialog) {
    const awardVideo = awardDialog.querySelector('video');
    const closeAwardDialog = awardDialog.querySelector('.award-dialog-close');

    awardTrigger.addEventListener('click', () => {
        awardDialog.showModal();
        awardVideo.play().catch(() => {
            // The player remains visible if the browser blocks autoplay.
        });
    });

    closeAwardDialog.addEventListener('click', () => awardDialog.close());

    awardDialog.addEventListener('click', (event) => {
        const bounds = awardDialog.getBoundingClientRect();
        const clickedBackdrop = event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (clickedBackdrop) awardDialog.close();
    });

    awardDialog.addEventListener('close', () => {
        awardVideo.pause();
        awardVideo.currentTime = 0;
    });
}

// ===================================
// Music Catalog Player
// ===================================

const catalogPlayer = document.querySelector('[data-catalog-player]');

if (catalogPlayer && Array.isArray(window.musicCatalog)) {
    const dropboxCatalogUrl = 'https://www.dropbox.com/scl/fo/aviu5ocm8b88pjhx2qwmi/ADe644YSV9D3_doFdfgQFnY?rlkey=h3wdz9jqjolwkn8jkal05mupm';
    const audio = catalogPlayer.querySelector('#catalog-audio');
    const categoryTabs = catalogPlayer.querySelector('[data-category-tabs]');
    const previousCategoryButton = catalogPlayer.querySelector('[data-category-previous]');
    const nextCategoryButton = catalogPlayer.querySelector('[data-category-next]');
    const tracklist = catalogPlayer.querySelector('[data-tracklist]');
    const searchInput = catalogPlayer.querySelector('[data-catalog-search]');
    const categoryName = catalogPlayer.querySelector('[data-category-name]');
    const visibleCount = catalogPlayer.querySelector('[data-visible-count]');
    const emptyState = catalogPlayer.querySelector('[data-catalog-empty]');
    const playButton = catalogPlayer.querySelector('[data-play]');
    const previousButton = catalogPlayer.querySelector('[data-previous]');
    const nextButton = catalogPlayer.querySelector('[data-next]');
    const progress = catalogPlayer.querySelector('[data-progress]');
    const currentTime = catalogPlayer.querySelector('[data-current-time]');
    const duration = catalogPlayer.querySelector('[data-duration]');
    const trackTitle = catalogPlayer.querySelector('[data-track-title]');
    const trackCategory = catalogPlayer.querySelector('[data-track-category]');
    const trackIndex = catalogPlayer.querySelector('[data-track-index]');
    const playerStatus = catalogPlayer.querySelector('[data-player-status]');
    const waveform = catalogPlayer.querySelector('[data-catalog-waveform]');
    let selectedCategory = window.musicCatalog[0].category;
    let tracks = [];
    let activeTrack = 0;

    if (waveform) {
        for (let index = 0; index < 48; index += 1) {
            const bar = document.createElement('span');
            bar.style.setProperty('--bar-index', index);
            bar.style.setProperty('--bar-height', `${7 + ((index * 7) % 17)}px`);
            waveform.appendChild(bar);
        }
    }

    const updateCategoryNavigation = () => {
        const maxScroll = categoryTabs.scrollWidth - categoryTabs.clientWidth;
        const hasOverflow = maxScroll > 2;
        previousCategoryButton.hidden = !hasOverflow || categoryTabs.scrollLeft <= 2;
        nextCategoryButton.hidden = !hasOverflow || categoryTabs.scrollLeft >= maxScroll - 2;
    };

    const scrollCategoryTabs = (direction) => {
        const firstTab = categoryTabs.querySelector('.catalog-category');
        const distance = firstTab ? firstTab.getBoundingClientRect().width + 1 : categoryTabs.clientWidth * .8;
        categoryTabs.scrollBy({ left: distance * direction, behavior: 'smooth' });
    };

    const cleanTitle = (filename) => filename
        .replace(/\.(mp3|m4a|wav)$/i, '')
        .replace(/^\d+\s+/, '')
        .replace(/_/g, ' ')
        .replace(/\s+REF(?:\s+JR)?\s*$/i, '')
        .replace(/\s+2025\s+NEW\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const catalogTracks = window.musicCatalog.flatMap(({ category, files }) => files.map((track) => {
        const file = typeof track === 'string' ? track : track.file;

        return {
            category,
            file,
            title: typeof track === 'string' ? cleanTitle(file) : track.title,
            src: `${dropboxCatalogUrl}&preview=${encodeURIComponent(`${category}/${file}`)}&raw=1`
        };
    }));

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
    };

    const updatePlayState = () => {
        const isPlaying = !audio.paused;
        catalogPlayer.classList.toggle('is-playing', isPlaying);
        waveform?.classList.toggle('is-playing', isPlaying);
        playButton.textContent = isPlaying ? 'Pause' : 'Play';
        const current = tracks[activeTrack];
        playButton.disabled = !current;
        previousButton.disabled = !current;
        nextButton.disabled = !current;
        playButton.setAttribute('aria-label', current ? `${isPlaying ? 'Pause' : 'Play'} ${current.title}` : 'No track selected');
        tracklist.querySelectorAll('.catalog-track').forEach((track, index) => {
            track.querySelector('.track-action').textContent = index === activeTrack && isPlaying ? 'Pause' : 'Play';
        });
    };

    const loadTrack = (index, autoplay = false) => {
        if (!tracks.length) return;
        activeTrack = (index + tracks.length) % tracks.length;
        const selectedTrack = tracks[activeTrack];
        audio.src = selectedTrack.src;
        trackTitle.textContent = selectedTrack.title;
        trackCategory.textContent = `${selectedTrack.category} / Dirtyfreqs Media`;
        trackIndex.textContent = `${String(activeTrack + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
        currentTime.textContent = '0:00';
        duration.textContent = '0:00';
        progress.value = 0;
        playerStatus.textContent = '';

        tracklist.querySelectorAll('.catalog-track').forEach((track, index) => {
            const isActive = index === activeTrack;
            track.classList.toggle('is-active', isActive);
            track.setAttribute('aria-pressed', String(isActive));
        });

        audio.load();
        if (autoplay) {
            audio.play().catch(() => {
                playerStatus.textContent = 'Select play to begin listening.';
                updatePlayState();
            });
        }
        updatePlayState();
    };

    const renderTracks = () => {
        const query = searchInput.value.trim().toLowerCase();
        tracks = catalogTracks.filter((track) => track.category === selectedCategory && track.title.toLowerCase().includes(query));
        tracklist.replaceChildren();
        categoryName.textContent = selectedCategory;
        visibleCount.textContent = `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`;
        emptyState.hidden = tracks.length !== 0;

        tracks.forEach((track, index) => {
            const button = document.createElement('button');
            button.className = 'catalog-track';
            button.type = 'button';
            button.setAttribute('role', 'listitem');
            button.setAttribute('aria-pressed', 'false');
            button.innerHTML = `<span class="track-order">${String(index + 1).padStart(2, '0')}</span><span class="track-name"></span><span class="track-action">Play</span>`;
            button.querySelector('.track-name').textContent = track.title;
            button.addEventListener('click', () => {
                if (index === activeTrack && audio.src === track.src) {
                    audio.paused ? audio.play() : audio.pause();
                } else {
                    loadTrack(index, true);
                }
            });
            tracklist.appendChild(button);
        });

        if (tracks.length) {
            loadTrack(0);
        } else {
            audio.pause();
            audio.removeAttribute('src');
            trackTitle.textContent = 'No Results';
            trackCategory.textContent = `${selectedCategory} / Dirtyfreqs Media`;
            trackIndex.textContent = '00 / 00';
            currentTime.textContent = '0:00';
            duration.textContent = '0:00';
            progress.value = 0;
            updatePlayState();
        }
    };

    window.musicCatalog.forEach(({ category, files }, index) => {
        const button = document.createElement('button');
        button.className = `catalog-category${index === 0 ? ' is-active' : ''}`;
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(index === 0));
        button.innerHTML = `<span></span><small>${String(files.length).padStart(2, '0')}</small>`;
        button.querySelector('span').textContent = category;
        button.addEventListener('click', () => {
            selectedCategory = category;
            searchInput.value = '';
            categoryTabs.querySelectorAll('.catalog-category').forEach((tab) => {
                const isActive = tab === button;
                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
            });
            renderTracks();
            if (window.matchMedia('(max-width: 720px)').matches) {
                const centeredPosition = button.offsetLeft - (categoryTabs.clientWidth - button.offsetWidth) / 2;
                categoryTabs.scrollTo({ left: centeredPosition, behavior: 'smooth' });
            }
        });
        categoryTabs.appendChild(button);
    });

    previousCategoryButton.addEventListener('click', () => scrollCategoryTabs(-1));
    nextCategoryButton.addEventListener('click', () => scrollCategoryTabs(1));
    categoryTabs.addEventListener('scroll', updateCategoryNavigation, { passive: true });
    window.addEventListener('resize', updateCategoryNavigation);
    searchInput.addEventListener('input', renderTracks);

    playButton.addEventListener('click', () => {
        if (!tracks.length) return;
        audio.paused ? audio.play() : audio.pause();
    });
    previousButton.addEventListener('click', () => loadTrack(activeTrack - 1, true));
    nextButton.addEventListener('click', () => loadTrack(activeTrack + 1, true));

    audio.addEventListener('play', updatePlayState);
    audio.addEventListener('pause', updatePlayState);
    audio.addEventListener('loadedmetadata', () => {
        duration.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
        currentTime.textContent = formatTime(audio.currentTime);
        progress.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    });
    audio.addEventListener('ended', () => loadTrack(activeTrack + 1, true));
    audio.addEventListener('error', () => {
        playerStatus.textContent = 'This track could not be loaded. Please try again.';
        updatePlayState();
    });
    progress.addEventListener('input', () => {
        if (audio.duration) audio.currentTime = (progress.value / 100) * audio.duration;
    });

    renderTracks();
    requestAnimationFrame(updateCategoryNavigation);
}

// Keyboard navigation for mobile menu
navToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navToggle.click();
    }
});


// ===================================
// Exclusive Media Playback
// ===================================

function initExclusiveMediaPlayback() {
    const mediaPlayers = Array.from(document.querySelectorAll('audio, video'));

    mediaPlayers.forEach(player => {
        player.addEventListener('play', () => {
            mediaPlayers.forEach(otherPlayer => {
                if (otherPlayer !== player && !otherPlayer.paused) {
                    otherPlayer.pause();
                }
            });
        });
    });
}

// ===================================
// Production Credits Service Switcher
// ===================================

function initPlaylistServiceSwitcher() {
    const tabs = Array.from(document.querySelectorAll('[data-playlist-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-playlist-panel]'));
    const links = Array.from(document.querySelectorAll('[data-playlist-link]'));

    if (!tabs.length) return;

    const selectService = (service) => {
        panels.forEach(panel => {
            const isActive = panel.dataset.playlistPanel === service;

            if (!isActive && !panel.hidden) {
                const iframe = panel.querySelector('iframe');
                if (iframe) iframe.src = iframe.src;
            }

            panel.hidden = !isActive;
            panel.classList.toggle('is-active', isActive);
        });

        tabs.forEach(tab => {
            const isActive = tab.dataset.playlistTab === service;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });

        links.forEach(link => {
            link.hidden = link.dataset.playlistLink !== service;
        });
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectService(tab.dataset.playlistTab));
        tab.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const direction = event.key === 'ArrowRight' ? 1 : -1;
            const nextTab = tabs[(index + direction + tabs.length) % tabs.length];
            selectService(nextTab.dataset.playlistTab);
            nextTab.focus();
        });
    });
}

// ===================================
// Initialize on DOM Load
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Prevent overlapping audio from the catalog and video players
    initExclusiveMediaPlayback();

    // Let visitors choose their preferred production credits playlist
    initPlaylistServiceSwitcher();
    
    // Log page load time
    if (window.performance) {
        const loadTime = window.performance.timing.domContentLoadedEventEnd -
                        window.performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
    }
});
