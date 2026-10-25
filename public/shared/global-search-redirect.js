// shared/global-search-redirect.js

/**
 * Redirects to the events page when the search input gains focus,
 * unless already on the events page.
 */
function setupSearchFocusRedirect() {
    const searchInput = document.getElementById('header-search-input');

    if (searchInput) {
        console.log("[Global Redirect] Search input found. Adding focus listener.");

        // Inside shared/global-search-redirect.js -> setupSearchFocusRedirect() function

        // Inside shared/global-search-redirect.js -> setupSearchFocusRedirect() function

        searchInput.addEventListener('focus', () => {
            console.log("[Global Redirect] Search input focused.");
            const currentPath = window.location.pathname; // e.g., /public/ or /public/contact-page/index.html or /public/contact-page/
            const onEventsPage = currentPath.includes('/events-page/');
            console.log("[Global Redirect] On events page?", onEventsPage, "Current path:", currentPath);

            if (!onEventsPage) {
                console.log("[Global Redirect] Not on events page. Determining redirect path...");

                // --- REFINED PATH LOGIC ---
                let redirectPath;
                // Check if the current path is essentially the root directory
                // It could be "/", "/index.html", "/public/", or "/public/index.html" depending on the server setup
                // Let's consider anything directly inside 'public/' (or the root if 'public' isn't shown) as the root level.
                const pathSegments = currentPath.split('/').filter(segment => segment !== '' && segment !== 'public'); // Split path and remove empty/public parts

                if (pathSegments.length <= 1) {
                    // If 0 segments (root '/') or 1 segment (like 'index.html'), assume root level
                    redirectPath = 'events-page/index.html'; // Path relative to root
                    console.log("[Global Redirect] Path segments <= 1, assuming root page, using path:", redirectPath, "Segments:", pathSegments);
                } else {
                    // If more than 1 segment (like ['contact-page', 'index.html']), assume subpage
                    redirectPath = '../events-page/index.html'; // Go up one level
                    console.log("[Global Redirect] Path segments > 1, assuming subpage, using path:", redirectPath, "Segments:", pathSegments);
                }
                // --- END REFINED PATH LOGIC ---

                console.log("[Global Redirect] Redirecting now to:", redirectPath);
                window.location.href = redirectPath;
            } else {
                console.log("[Global Redirect] Already on events page. No redirect needed.");
            }
        });
    } else {
        console.warn("[Global Redirect] Search input (#header-search-input) not found on initial check.");
    }
}

// --- Initialization Logic ---
// We need to wait until the navbar HTML exists.

// Option 1: If using dynamic navbar loading (navbar-placeholder + nav.js)
if (document.getElementById('navbar-placeholder')) {
    console.log("[Global Redirect] Found navbar placeholder. Waiting for 'navbarLoaded' event.");
    document.addEventListener('navbarLoaded', setupSearchFocusRedirect, { once: true });
}
// Option 2: If the navbar HTML is static (already in the page's HTML file)
else if (document.getElementById('header-search-input')) {
    console.log("[Global Redirect] Found search input directly. Setting up on DOMContentLoaded.");
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSearchFocusRedirect, { once: true });
    } else {
        console.log("[Global Redirect] DOM already loaded, calling setup directly.");
        setupSearchFocusRedirect();
    }
}
// Fallback
else {
    console.warn("[Global Redirect] Cannot detect navbar reliably. Attempting setup on DOMContentLoaded.");
    document.addEventListener('DOMContentLoaded', setupSearchFocusRedirect, { once: true });
}