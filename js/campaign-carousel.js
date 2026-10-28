document.querySelectorAll('[data-campaign-carousel]').forEach((carousel) => {
    const video = carousel.querySelector('video');
    const source = video.querySelector('source');
    const position = carousel.querySelector('[data-campaign-position]');
    const total = 6;
    let current = 0;

    const showVideo = (direction) => {
        video.pause();
        current = (current + direction + total) % total;
        const number = String(current + 1).padStart(2, '0');
        video.poster = `media/campaigns/murcielago/campaign-${number}.jpg`;
        source.src = `media/campaigns/murcielago/campaign-${number}.mp4`;
        video.setAttribute('aria-label', `Murciélago Tequila — campaign video ${current + 1}`);
        video.load();
        position.textContent = `Video ${current + 1} of ${total}`;
    };

    carousel.querySelector('[data-campaign-previous]').addEventListener('click', () => showVideo(-1));
    carousel.querySelector('[data-campaign-next]').addEventListener('click', () => showVideo(1));
});
