// ===================================
// Mobile Navigation Toggle
// ===================================

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
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
const animateElements = document.querySelectorAll('.playlist-container, .stat-item, .catalog-player, .sync-video-card, .contact-content');
animateElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
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
// Music Catalog Player
// ===================================

const catalogPlayer = document.querySelector('[data-catalog-player]');

if (catalogPlayer) {
    const audio = catalogPlayer.querySelector('#catalog-audio');
    const tracks = [...catalogPlayer.querySelectorAll('.catalog-track')];
    const playButton = catalogPlayer.querySelector('[data-play]');
    const previousButton = catalogPlayer.querySelector('[data-previous]');
    const nextButton = catalogPlayer.querySelector('[data-next]');
    const progress = catalogPlayer.querySelector('[data-progress]');
    const currentTime = catalogPlayer.querySelector('[data-current-time]');
    const duration = catalogPlayer.querySelector('[data-duration]');
    const trackTitle = catalogPlayer.querySelector('[data-track-title]');
    const trackIndex = catalogPlayer.querySelector('[data-track-index]');
    const playerStatus = catalogPlayer.querySelector('[data-player-status]');
    let activeTrack = 0;

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
    };

    const updatePlayState = () => {
        const isPlaying = !audio.paused;
        playButton.textContent = isPlaying ? 'Pause' : 'Play';
        playButton.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Play'} ${tracks[activeTrack].dataset.title}`);
        tracks.forEach((track, index) => {
            track.querySelector('.track-action').textContent = index === activeTrack && isPlaying ? 'Pause' : 'Play';
        });
    };

    const loadTrack = (index, autoplay = false) => {
        activeTrack = (index + tracks.length) % tracks.length;
        const selectedTrack = tracks[activeTrack];
        audio.src = selectedTrack.dataset.src;
        trackTitle.textContent = selectedTrack.dataset.title;
        trackIndex.textContent = `${String(activeTrack + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`;
        currentTime.textContent = '0:00';
        duration.textContent = '0:00';
        progress.value = 0;
        playerStatus.textContent = '';

        tracks.forEach((track, index) => {
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

    tracks.forEach((track, index) => {
        track.addEventListener('click', () => {
            if (index === activeTrack) {
                audio.paused ? audio.play() : audio.pause();
            } else {
                loadTrack(index, true);
            }
        });
    });

    playButton.addEventListener('click', () => {
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

    loadTrack(0);
}

// Keyboard navigation for mobile menu
navToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navToggle.click();
    }
});


// ===================================
// Email Protection
// ===================================

function initEmailProtection() {
    const emailLink = document.getElementById('email-link');
    if (!emailLink) return;
    
    // Obfuscated email parts (reversed and encoded)
    const user = 'ofni'.split('').reverse().join('');
    const domain = 'moc.sqerfytrid'.split('').reverse().join('');
    const email = user + '@' + domain;
    
    // Create the protected email link
    emailLink.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Double-check this is a real user interaction
        if (e.isTrusted) {
            // Reveal the email
            this.textContent = email;
            this.href = 'mailto:' + email;
            this.style.pointerEvents = 'none';
            this.style.cursor = 'text';
            
            // Add copy functionality
            setTimeout(() => {
                this.addEventListener('click', function(e) {
                    e.preventDefault();
                    navigator.clipboard.writeText(email).then(() => {
                        const originalText = this.textContent;
                        this.textContent = 'Email copied!';
                        setTimeout(() => {
                            this.textContent = originalText;
                        }, 2000);
                    }).catch(() => {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = email;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        
                        const originalText = this.textContent;
                        this.textContent = 'Email copied!';
                        setTimeout(() => {
                            this.textContent = originalText;
                        }, 2000);
                    });
                });
                this.style.pointerEvents = 'auto';
                this.style.cursor = 'pointer';
            }, 100);
        }
    });
    
    // Add hover effect
    emailLink.addEventListener('mouseenter', function() {
        if (this.textContent === 'Click to reveal email') {
            this.textContent = 'Click to show contact email';
        }
    });
    
    emailLink.addEventListener('mouseleave', function() {
        if (this.textContent === 'Click to show contact email') {
            this.textContent = 'Click to reveal email';
        }
    });
}

// ===================================
// Initialize on DOM Load
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Add loaded class to body for CSS animations
    document.body.classList.add('loaded');
    
    // Initialize email protection
    initEmailProtection();
    
    // Log page load time
    if (window.performance) {
        const loadTime = window.performance.timing.domContentLoadedEventEnd -
                        window.performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
    }
});
