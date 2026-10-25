// nav-bar/nav.js

document.addEventListener("DOMContentLoaded", function () {

    // --- Fetch and Inject Navbar ---
    fetch('../nav-bar/nav.html') // Ensure this path is correct
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.text();
        })
        .then(data => {
            const placeholder = document.getElementById('navbar-placeholder');
            if (placeholder) {
                // 1. Inject the navbar HTML
                placeholder.innerHTML = data;
                console.log("nav.js: Navbar HTML injected.");

                // *** SETUP LISTENERS *AFTER* INJECTION ***
                setupWishlistListeners();
                setupGlobalMobileSearch(); // <-- ADDED THIS CALL

                // 2. Announce that the navbar is ready
                console.log("nav.js: Fired 'navbarLoaded' event.");
                document.dispatchEvent(new Event('navbarLoaded'));

                const profileDropdown = document.querySelector('#profileBtn');
                profileDropdown.addEventListener('click', () => {
                    document.querySelector(".dropdown-menu").classList.toggle("show")
                })

            } else {
                console.error("nav.js: Navbar placeholder element not found!");
            }
        })
        .catch(error => {
            console.error('nav.js: Error fetching or injecting navbar:', error);
            const placeholder = document.getElementById('navbar-placeholder');
            if (placeholder) {
                placeholder.innerHTML = '<p style="color:red; text-align:center;">Failed to load navigation.</p>';
            }
        });
});

/**
 * Finds wishlist elements and adds necessary event listeners.
 */
function setupWishlistListeners() {
    const wishlistTrigger = document.getElementById('wishlist-trigger');
    const wishlistContainer = document.getElementById('wishlist-container');
    const closeButton = document.getElementById('close-wishlist');

    if (wishlistTrigger && wishlistContainer && closeButton) {
        console.log("nav.js: Setting up wishlist listeners.");
        wishlistTrigger.addEventListener('click', function (event) {
            event.preventDefault();
            wishlistContainer.classList.add('show');
        });
        closeButton.addEventListener('click', function () {
            wishlistContainer.classList.remove('show');
        });
        document.addEventListener('click', function (event) {
            if (wishlistContainer && wishlistContainer.classList.contains('show') &&
                !wishlistContainer.contains(event.target) &&
                !wishlistTrigger.contains(event.target)) {
                wishlistContainer.classList.remove('show');
            }
        });
    } else {
        console.warn("nav.js: Could not set up wishlist listeners. Missing elements.");
    }
}

/**
 * --- NEW GLOBAL FUNCTION ---
 * Finds mobile search icon and adds smart click listener.
 */
function setupGlobalMobileSearch() {
    const mobileSearchTrigger = document.getElementById('mobile-search-trigger');
    const searchBarForm = document.getElementById('header-search-form');

    if (mobileSearchTrigger && searchBarForm) {
        console.log("nav.js: Setting up GLOBAL mobile search listener.");

        mobileSearchTrigger.addEventListener('click', function (event) {
            event.preventDefault(); // Always prevent default for a div

            const currentPath = window.location.pathname;
            const onEventsPage = currentPath.includes('/events-page/');

            if (onEventsPage) {
                // ON Events Page: Just toggle the bar
                searchBarForm.classList.toggle('mobile-active');
                console.log("nav.js (Global): Toggled mobile search bar on Events page.");
                if (searchBarForm.classList.contains('mobile-active')) {
                    document.getElementById('header-search-input')?.focus();
                }
            } else {
                // ON ANY OTHER Page: Redirect
                console.log("nav.js (Global): Not on events page. Redirecting.");

                // Determine redirect path
                let redirectPath;
                const pathSegments = currentPath.split('/').filter(segment => segment && segment !== 'public');
                if (pathSegments.length <= 1) { // Root page (e.g., / or /index.html)
                    redirectPath = 'events-page/index.html';
                } else { // Subpage (e.g., /contact-page/index.html)
                    redirectPath = '../events-page/index.html';
                }
                window.location.href = redirectPath;
            }
        });

        // Global "click outside" to close
        document.addEventListener('click', function (event) {
            if (searchBarForm.classList.contains('mobile-active') &&
                !searchBarForm.contains(event.target) &&
                !mobileSearchTrigger.contains(event.target)) {
                searchBarForm.classList.remove('mobile-active');
                console.log("nav.js (Global): Closed mobile search via outside click.");
            }
        });

    } else {
        console.warn("nav.js: Could not find mobile trigger or search form for GLOBAL setup.");
    }
}