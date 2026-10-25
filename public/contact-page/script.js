document.addEventListener("DOMContentLoaded", function () {

    // The core fix: Wait for the dynamic navbar content to be inserted.
    document.addEventListener("navbarLoaded", function () {
        
        // --- 5. Header Search Redirect (If applicable) ---
        const headerSearchForm = document.getElementById('header-search-form');
        if (headerSearchForm) {
            headerSearchForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const searchInput = document.getElementById('header-search-input');
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `../searchResults.html?query=${encodeURIComponent(query)}`; 
                }
            });
        }
    });
});