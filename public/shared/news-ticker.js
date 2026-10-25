(function () {
    // Initialize ticker when nav is ready or DOM content loaded
    function initTicker() {
        const ticker = document.getElementById('news-ticker');
        if (!ticker) return;

        const track = ticker.querySelector('.ticker-track');
        if (!track) return;

        // Duplicate track content so animation can scroll continuously
        // We'll ensure there's at least two copies by appending cloned nodes
        const items = Array.from(track.children);
        if (items.length === 0) return;

        // Clear any previous duplicates
        // If we already duplicated, avoid duplicating again
        if (track.dataset.duplicated) return;

        // Clone once to ensure continuous flow
        items.forEach(node => {
            const clone = node.cloneNode(true);
            track.appendChild(clone);
        });
        track.dataset.duplicated = '1';

        // After next paint, measure width and set duration
        requestAnimationFrame(() => {
            const totalWidth = Array.from(track.children).reduce((w, el) => w + el.getBoundingClientRect().width, 0);
            const containerWidth = ticker.getBoundingClientRect().width;

            // We animate half the track (since we duplicated items)
            const travel = totalWidth / 2;

            // Duration: pixels / speed (px per sec). Choose 80 px/sec as pleasant speed.
            const speed = 80; // px per second
            const durationSec = Math.max(8, travel / speed);

            track.style.setProperty('--ticker-duration', durationSec + 's');
            // Add class to start CSS animation
            track.classList.add('scrolling');

            // Accessibility: pause on hover
            ticker.addEventListener('mouseenter', () => track.style.animationPlayState = 'paused');
            ticker.addEventListener('mouseleave', () => track.style.animationPlayState = 'running');
        });
    }

    // Try immediate init and also on 'navbarLoaded' (for injected nav)
    document.addEventListener('DOMContentLoaded', initTicker);
    document.addEventListener('navbarLoaded', initTicker);
})();
