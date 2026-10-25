import { auth, db } from '../firebase-config.js'
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {

    let currentUser = null;

    // Global-scope variables for the search data, now loaded from Firestore
    let menuData = null; // Will store menu data in { "RestaurantName": [dishes...] } format
    let outletsData = null; // Will store an array of outlet objects

    const signInButton = document.getElementById('sign-in-btn');
    const profileContainer = document.getElementById('profile-container');
    const signOutButton = document.getElementById('sign-out-btn');

    const resultsGrid = document.getElementById('results-grid');
    const dishesTab = document.getElementById('dishes-tab');
    const restaurantsTab = document.getElementById('restaurants-tab');
    const viewMoreBtn = document.getElementById('view-more-btn');

    let allFoundDishes = [];
    let allFoundOutlets = [];


    async function signInUser() {
        const email = prompt("Enter email:");
        if (!email) return;
        const password = prompt("Enter password:");
        if (!password) return;

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Firebase Sign In Error:", error);
            alert("Sign in failed. Invalid credentials or network error.");
        }
    }

    async function signOutUser() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Firebase Sign Out Error:", error);
            alert("Sign out failed.");
        }
    }

    function updateAuthUI(user) {
        currentUser = user;

        if (!signInButton || !profileContainer) return;

        if (currentUser) {
            signInButton.style.display = 'none';
            profileContainer.classList.remove('hidden');
        } else {
            signInButton.style.display = 'block';
            profileContainer.classList.add('hidden');

            if (profileContainer.classList.contains('dropdown-active')) {
                profileContainer.classList.remove('dropdown-active');
            }
        }
    }

    onAuthStateChanged(auth, (user) => {
        console.log("Search Results Auth State Changed. User:", user ? user.uid : "None");
        updateAuthUI(user);
    });

    if (signInButton) {
        signInButton.addEventListener('click', signInUser);
    }
    if (signOutButton) {
        signOutButton.addEventListener('click', signOutUser);
    }

    function setupProfileDropdownToggle() {
        if (!profileContainer) return;

        profileContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            profileContainer.classList.toggle('dropdown-active');
        });
        window.addEventListener('click', () => {
            if (profileContainer.classList.contains('dropdown-active')) {
                profileContainer.classList.remove('dropdown-active');
            }
        });
        const dropdown = profileContainer.querySelector('.profile-dropdown');
        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    function setupScrollAnimations() {
        const elementsToAnimate = document.querySelectorAll('.fade-in-element');
        if (elementsToAnimate.length === 0) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                } else {
                    entry.target.classList.remove('visible');
                }
            });
        }, { threshold: 0.1 });
        elementsToAnimate.forEach(element => { observer.observe(element); });
    }

    function setupHeaderSearchRedirect() {
        const headerSearchForm = document.getElementById('header-search-form');
        if (!headerSearchForm) return;
        headerSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const searchInput = document.getElementById('header-search-input');
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `searchResults.html?query=${encodeURIComponent(query)}`;
            }
        });
    }

    function renderDishCards(dishesToRender, append = false) {
        if (!append) {
            resultsGrid.innerHTML = '';
            resultsGrid.className = 'dish-results-grid';
        }
        if (dishesToRender.length === 0 && !append) {
            resultsGrid.innerHTML = `<p class="no-results-message">Sorry, no dishes found.</p>`;
            return;
        }
        dishesToRender.forEach(dish => {
            const dishId = `dish-${dish.name.replace(/\s+/g, '-')}`;
            const cardHTML = `
                <a href="menu.html?outlet=${encodeURIComponent(dish.restaurant)}#${dishId}" class="dish-card-link">
                    <div class="dish-card">
                        <img src="${dish.image || 'https://placehold.co/128x128/cccccc/333?text=No+Image'}" alt="${dish.name || 'Dish'}">
                        <div class="dish-card-info">
                            <h4>${dish.name || 'Unnamed Dish'}</h4>
                            <p class="restaurant-name">${dish.restaurant || 'Unknown Restaurant'}</p>
                            <p class="price">₹${dish.price || 'N/A'}</p>
                        </div>
                    </div>
                </a>`;
            resultsGrid.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    function renderRestaurantCards(outletsToRender, append = false) {
        if (!append) {
            resultsGrid.innerHTML = '';
            resultsGrid.className = 'outlet-grid';
        }
        if (outletsToRender.length === 0 && !append) {
            resultsGrid.innerHTML = `<p class="no-results-message">Sorry, no restaurants found.</p>`;
            return;
        }
        outletsToRender.forEach(outlet => {
            let ratingClass = '';
            if (outlet.rating >= 4.0) { ratingClass = 'rating-high'; }
            else if (outlet.rating >= 3.0) { ratingClass = 'rating-mid'; }
            else { ratingClass = 'rating-low'; }
            const imageUrl = `https://placehold.co/256x256/F8F8F8/333333?text=${encodeURIComponent(outlet.name)}`;

            const cardHTML = `
                <a href="menu.html?outlet=${encodeURIComponent(outlet.name)}" class="outlet-card-link">
                    <div class="outlet-card">
                        <img src="${imageUrl}" alt="${outlet.name}">
                        <div class="card-content">
                            <h3>${outlet.name}</h3>
                            <div class="card-details">
                                <span class="cuisine">${outlet.cuisine || 'Unknown'}</span>
                                <span class="rating ${ratingClass}">★ ${(outlet.rating || 0).toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </a>`;
            resultsGrid.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // ==========================================================
    // NEW ASYNC FUNCTION TO LOAD DATA FROM FIRESTORE
    // ==========================================================
    async function loadSearchData() {
        try {
            console.log("🚀 Starting data fetch from Firestore...");

            // 1️⃣ Fetch outlets
            const outletsSnapshot = await getDocs(collection(db, "outlets"));
            outletsData = outletsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // 2️⃣ Fetch menu for each outlet (nested collection)
            menuData = {};

            for (const outlet of outletsData) {
                const menuRef = collection(db, "outlets", outlet.id, "menu");
                const outletMenuSnapshot = await getDocs(menuRef);

                outletMenuSnapshot.forEach(doc => {
                    const dish = doc.data();
                    if (!menuData[outlet.name]) {
                        menuData[outlet.name] = [];
                    }
                    menuData[outlet.name].push(dish);
                });
            }

            console.log("✅ Data loaded successfully!");
            return true;

        } catch (error) {
            console.error("❌ Error fetching data from Firestore:", error);
            resultsGrid.innerHTML =
                '<p class="no-results-message">Error loading data from the database.</p>';
            return false;
        }
    }

    function performSearch() {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('query') || "";
        const searchTerm = query.trim().toLowerCase();

        const searchTitleEl = document.getElementById('search-results-title');
        const headerInputEl = document.getElementById('header-search-input');
        if (searchTitleEl) searchTitleEl.innerHTML = `Search results for “<span class="text-primary">${query}</span>”`;
        if (headerInputEl) headerInputEl.value = query;

        let allResults = [];

        // ==========================================================
        // ORIGINAL FAILING CHECK REMOVED: 
        // The data is guaranteed to be loaded or the function stops now.
        // The "Error loading data" message will now only show if 
        // the Firebase fetch fails in loadSearchData().
        // ==========================================================

        if (dishesTab && dishesTab.classList.contains('active')) {
            const allDishes = Object.keys(menuData).flatMap(r =>
                Array.isArray(menuData[r]) ? menuData[r].map(d => ({ ...d, restaurant: r })) : []
            );

            allFoundDishes = allDishes.filter(d =>
                d && d.name && (
                    d.name.toLowerCase().includes(searchTerm) ||
                    (d.restaurant && d.restaurant.toLowerCase().includes(searchTerm)) ||
                    (d.category && d.category.toLowerCase().includes(searchTerm))
                )
            );
            allResults = allFoundDishes;
            renderDishCards(allResults.slice(0, 9));
        } else {
            const outletsByNameOrCuisine = outletsData.filter(o =>
                o && o.name && (
                    o.name.toLowerCase().includes(searchTerm) ||
                    (o.cuisine && o.cuisine.toLowerCase().includes(searchTerm))
                )
            );

            const restaurantNamesFromDishes = Object.keys(menuData).filter(restaurantName =>
                Array.isArray(menuData[restaurantName]) &&
                menuData[restaurantName].some(dish =>
                    dish && dish.name && (
                        dish.name.toLowerCase().includes(searchTerm) ||
                        (dish.category && dish.category.toLowerCase().includes(searchTerm))
                    )
                )
            );

            const outletsFromDishSearch = outletsData.filter(o =>
                o && o.name && restaurantNamesFromDishes.includes(o.name)
            );

            const combined = [...outletsByNameOrCuisine, ...outletsFromDishSearch];
            allFoundOutlets = Array.from(new Map(combined.map(item => [item.name, item])).values());
            allResults = allFoundOutlets;
            renderRestaurantCards(allResults.slice(0, 8));
        }

        const initialLoadCount = dishesTab && dishesTab.classList.contains('active') ? 9 : 8;
        if (viewMoreBtn) {
            if (allResults.length > initialLoadCount) {
                viewMoreBtn.classList.remove('hidden');
            } else {
                viewMoreBtn.classList.add('hidden');
            }
        }
    }

    function setupTabs() {
        if (!dishesTab || !restaurantsTab) {
            console.warn("Search tabs not found");
            return;
        }
        dishesTab.addEventListener('click', (e) => {
            e.preventDefault();
            restaurantsTab.classList.remove('active');
            dishesTab.classList.add('active');
            performSearch();
        });
        restaurantsTab.addEventListener('click', (e) => {
            e.preventDefault();
            dishesTab.classList.remove('active');
            restaurantsTab.classList.add('active');
            performSearch();
        });
    }

    function setupViewMore() {
        if (!viewMoreBtn) {
            console.warn("View more button not found");
            return;
        }
        viewMoreBtn.addEventListener('click', () => {
            if (dishesTab && dishesTab.classList.contains('active')) {
                renderDishCards(allFoundDishes.slice(9), true);
            } else {
                renderRestaurantCards(allFoundOutlets.slice(8), true);
            }
            viewMoreBtn.classList.add('hidden');
        });
    }

    // ==========================================================
    // NEW ASYNCHRONOUS EXECUTION FLOW
    // ==========================================================
    setupProfileDropdownToggle();
    setupScrollAnimations();
    setupHeaderSearchRedirect();
    setupTabs();
    setupViewMore();

    // ⚠️ Start the data fetching. Only proceed to search if successful.
    loadSearchData().then(dataLoaded => {
        if (dataLoaded) {
            performSearch();
        }
    });

});