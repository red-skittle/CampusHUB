// mobile-nav/mobile-nav.js

document.addEventListener('DOMContentLoaded', () => {
    // Path to the HTML file. 
    // This assumes 'mobile-nav' folder is at the root of your site.
    const navPath = '/public/mobile-nav/mobile-nav.html';

    // Find the placeholder div
    const placeholder = document.getElementById('mobile-nav-placeholder');

    if (placeholder) {
        // Fetch the nav HTML
        fetch(navPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(data => {
                // Inject the HTML into the placeholder
                placeholder.innerHTML = data;

                // Now that the HTML is loaded, run the logic to set the active link
                activateMobileNavLinks();
            })
            .catch(error => {
                console.error('Error fetching mobile nav:', error);
                placeholder.innerHTML = '<p style="color:red; text-align:center;">Could not load mobile nav.</p>';
            });
    }

    function activateMobileNavLinks() {
        // Get the current page's URL path
        const currentPath = window.location.pathname;

        // Select all the icons in the mobile nav
        // We query from 'placeholder' to make sure we're getting the newly-added icons
        const navIcons = placeholder.querySelectorAll('.dynamic-island-nav .nav-icon');

        navIcons.forEach(icon => {
            // Get the clean path from the icon's link
            const iconPath = new URL(icon.href).pathname;

            // If the icon's path matches the current page's path, add 'active'
            if (currentPath === iconPath) {
                icon.classList.add('active');
            }
        });
    }
});