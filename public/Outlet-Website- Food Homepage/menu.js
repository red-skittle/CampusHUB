import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { getGroupedCart, setupCartDropdownToggle } from './func.js';

document.addEventListener('DOMContentLoaded', function () {

    let currentUser = null;
    let currentOutletId = null;
    let currentOutletData = null;
    let allMenuItems = [];
    let cart = {};
    let favoriteOutlets = [];
    let favoriteItems = [];
    let isCallOnly = false;
    let currentOutletPrettyName = null; 
    let callOnlyNumber = null;

    const restaurantNameEl = document.getElementById('restaurant-name');
    const restaurantCuisineEl = document.getElementById('restaurant-cuisine');
    const restaurantRatingEl = document.getElementById('restaurant-rating');
    const restaurantImageEl = document.getElementById('restaurant-image');
    const restaurantDeliveryTimeEl = document.getElementById('restaurant-delivery-time');
    const restaurantCostEl = document.getElementById('restaurant-cost');
    const offersBoxEl = document.querySelector('.offers-box');
    const restaurantOfferEl = document.getElementById('restaurant-offer');

    const categoryListEl = document.getElementById('category-list');
    const menuItemsContainer = document.getElementById('menu-items-container');
    const dishSearchInput = document.getElementById('dish-search-input');
    const favoriteOutletBtn = document.getElementById('filter-favorites-btn');

    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTitleEl = document.getElementById('cart-title');
    const subtotalContainer = document.getElementById('subtotal-container');
    const subtotalPriceEl = document.getElementById('subtotal-price');
    const checkoutLink = document.getElementById('checkout-link');
    const cartLink = document.getElementById('js-cartlink')
    const cartLinkContainer = document.querySelector('.cart-link-container')
    const cartLinkContainerA = document.querySelector('.cart-link-container a')
    const cartDropdown = cartLinkContainer ? cartLinkContainer.querySelector('.cart-link-dropdown') : null

    const checkoutbtn = document.querySelector('#checkout-btn')

    const signInButton = document.getElementById('sign-in-btn');
    const profileContainer = document.getElementById('profile-container');
    const signOutButton = document.getElementById('sign-out-btn');

    const mobileCartBar = document.getElementById('mobile-cart-bar');
    const mobileCartTextEl = document.getElementById('mobile-cart-text');
    const mobileCartImageEl = document.getElementById('mobile-cart-image');

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const categoryModalOverlay = document.getElementById('category-modal-overlay');
    const categoryModal = document.getElementById('category-modal');
    const closeCategoryModalBtn = document.querySelector('.close-modal-btn');
    const modalCategoryList = document.getElementById('modal-category-list');
    const modalRestaurantNameTitle = document.getElementById('modal-restaurant-name-title');
    // --- End Mobile Selectors ---

    // --- NEW: Call-Only Outlet Data ---
    // !! REPLACE with your actual outlet IDs (lowercase, no spaces) and phone numbers !!
    const CALL_ONLY_OUTLETS = {
    'italianoven': '91-890-546-4595',
    'letsgolive': '91-734-058-8261',
    'tasteofindia': '91-729-701-7744',
    'selective': '91-876-926-8261',
    'zaika': '7300075420',
    'chatkara':'8905962406',
    'chillingpoint': '8005571405',
    'chinatown': '9571645721',
    'cookhouse': '9116966635',
    'crazychef': '9521099336',
    'devsweets': '9358387779',
    'havmor': '8058255863',
    'kitchenandcurry': '7073991323',
    'minimeals': '8112257659',
    'pizzabakers': '7300042778',
    'saras': '7357549601',
    'soyachaapcorner': '8306512244',
    'stardom': '9928884373',
    'subway': '7742306976',
    'teatradition': '8690779004',
    'zerodegree': '8233673311',
    'dialogcafe': '9660344966'
};


// REPLACE this entire function in menu.js

function displayCarts() {
        const groupedCart = getGroupedCart();
        let cartsHtml = '';
        const urlParams = new URLSearchParams(window.location.search);
        
        // 1. Get the "pretty" name from the URL (e.g., "Chilling Point")
        const outletName = urlParams.get('outlet'); 
    
        // 2. SET BOTH LINKS TO THE SAME "PRETTY" NAME.
        // This fixes the bug where phone and laptop links were different.
        if (mobileCartBar) mobileCartBar.href = `checkout.html?outlet=${outletName}`;
        if (cartLinkContainerA) cartLinkContainerA.href = `checkout.html?outlet=${outletName}`;

        // 3. (The broken 'if' block is GONE)

        // 4. This part builds the dropdown menu
        Object.entries(groupedCart).forEach(([restaurant, items]) => {
            cartsHtml += `<a href='checkout.html?outlet=${restaurant}'><button id="restorant-cart-btn" class="btn btn-dark btn-small">${restaurant}</button></a>`;
        });
        
        if (cartDropdown) cartDropdown.innerHTML = cartsHtml;
    } 

    function initializePage() {
        const params = new URLSearchParams(window.location.search);
        const rawOutletId = params.get('outlet');
        currentOutletPrettyName = rawOutletId;
        currentOutletId = rawOutletId ? rawOutletId.toLowerCase().replace(/\s+/g, '').replace(/'/g, '') : null; 
        displayCarts();

        if (!currentOutletId) {
            showError("No outlet specified in URL");
            return;
        }

        loadCart();
        loadFavoriteOutlets();

        setupAuthListeners();
        setupEventHandlers();
        setupModalEventHandlers(); 
        setupScrollAnimations();
        setupHeaderSearchRedirect();
        setupProfileDropdownToggle();

        setupCartDropdownToggle(cartLinkContainer, cartDropdown);

        fetchOutletAndMenu(currentOutletId);
    }

    function loadCart() {
        try {
            const storedCart = localStorage.getItem('userCart');

            cart = storedCart ? JSON.parse(storedCart) : {};
            console.log(cart)
        } catch {
            cart = {};
        }
    }

    function saveCart() {
        localStorage.setItem('userCart', JSON.stringify(cart));
    }

    function loadFavoriteOutlets() {
        try {
            const storedFavorites = localStorage.getItem('userFavoriteOutlets');
            favoriteOutlets = storedFavorites ? JSON.parse(storedFavorites) : [];
        } catch {
            favoriteOutlets = [];
        }
    }

    function saveFavoriteOutlets() {
        localStorage.setItem('userFavoriteOutlets', JSON.stringify(favoriteOutlets));
    }

    function toggleFavoriteOutlet(outletName) {
        if (!outletName) return;
        const index = favoriteOutlets.indexOf(outletName);
        if (index > -1) favoriteOutlets.splice(index, 1);
        else favoriteOutlets.push(outletName);
        saveFavoriteOutlets();
        updateFavoriteButtonState();
    }

    function updateFavoriteButtonState() {
        if (!favoriteOutletBtn || !currentOutletData) return;
        const isFavorited = favoriteOutlets.includes(currentOutletData.name);
        favoriteOutletBtn.classList.toggle('active', isFavorited);
        favoriteOutletBtn.textContent = isFavorited ? '★ Favorited' : '⭐ Add Favourite';
    }

    async function loadFavoriteItems() {
        if (!currentUser) {
            favoriteItems = [];
            return;
        }
        
        try {
            const userDocRef = doc(db, "users", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                favoriteItems = userData.favoriteItems || [];
            } else {
                favoriteItems = [];
            }
        } catch (error) {
            favoriteItems = [];
        }
    }

    async function toggleFavoriteItem(itemId, itemData) {
        
        if (!currentUser) {
            alert("Please sign in to add items to favorites");
            return;
        }

        const userDocRef = doc(db, "users", currentUser.uid);
        
        try {
            const isFavorited = favoriteItems.includes(itemId);
            if (isFavorited) {
                await updateDoc(userDocRef, {
                    favoriteItems: arrayRemove(itemId)
                });
                favoriteItems = favoriteItems.filter(id => id !== itemId);
            } else {
                const userDocSnap = await getDoc(userDocRef);
                
                if (!userDocSnap.exists()) {
                    await setDoc(userDocRef, {
                        favoriteItems: [itemId],
                        email: currentUser.email
                    });
                } else {
                    await updateDoc(userDocRef, {
                        favoriteItems: arrayUnion(itemId)
                    });
                }
                favoriteItems.push(itemId);
            }
            displayMenu(dishSearchInput?.value.trim() || "");
        } catch (error) {
            alert("Failed to update favorites. Please try again.");
        }
    }

    const cachedAuthState = localStorage.getItem('campusHubAuthState');
    
    if (cachedAuthState === 'loggedIn') {
        if (signInButton) signInButton.style.display = 'none';
        if (profileContainer) profileContainer.classList.remove('hidden');
    } else if (cachedAuthState === 'loggedOut') {
        if (signInButton) signInButton.style.display = 'block';
        if (profileContainer) profileContainer.classList.add('hidden');
    }

    function updateAuthUI(user) {
        currentUser = user;
        if (!signInButton || !profileContainer) return;

        if (user) {
            signInButton.style.display = 'none';
            profileContainer.classList.remove('hidden');
            
            localStorage.setItem('campusHubAuthState', 'loggedIn');
        } else {
            signInButton.style.display = 'block';
            profileContainer.classList.add('hidden');
            
            localStorage.setItem('campusHubAuthState', 'loggedOut');
            localStorage.removeItem('campusHubUserData');
        }
    }

    function setupAuthListeners() {
        onAuthStateChanged(auth, async (user) => {
            console.log("Auth State Changed:", user ? user.uid : "None");
            updateAuthUI(user);
            await loadFavoriteItems();
            displayMenu(dishSearchInput?.value.trim() || "");
        });

        if (signOutButton) {
            signOutButton.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                } catch {
                    alert("Sign out failed. Try again.");
                }
            });
        }

        if (signInButton) {
            signInButton.addEventListener('click', () => {
                window.location.href = '../login-pages/welcomelogin.html';
            });
        }
    }

    /**
     * Parses prices map or single price.
     */
    function getItemPrice(pricesData, priceData) {
        // 1. Check for a valid 'prices' map (object, not array)
        if (pricesData && typeof pricesData === 'object' && !Array.isArray(pricesData) && Object.keys(pricesData).length > 0) {
            const numericPrices = Object.values(pricesData).map(p => parseFloat(p)).filter(p => !isNaN(p));
            
            if (numericPrices.length > 0) {
                return { 
                    displayPrice: Math.min(...numericPrices), // The "Starting from" price
                    priceMap: pricesData, // The full map, e.g., {small: 100, medium: 150}
                    hasVariants: true 
                };
            }
        }
        
        // 2. No map, check for a single 'price' field
        const singlePrice = parseFloat(priceData);
        if (!isNaN(singlePrice)) {
            return { 
                displayPrice: singlePrice, 
                priceMap: { default: singlePrice }, // Standardize the map
                hasVariants: false 
            };
        }

        // 3. Handle arrays (from old code, good to keep)
        if (Array.isArray(pricesData) && pricesData.length > 0) {
            const numericPrices = pricesData.map(p => parseFloat(p)).filter(p => !isNaN(p));
            if (numericPrices.length > 0) {
                return { 
                    displayPrice: Math.min(...numericPrices), 
                    priceMap: { default: Math.min(...numericPrices) }, // Treat as single price
                    hasVariants: false // An array of prices isn't variants
                };
            }
        }
        
        // 4. No price
        return { displayPrice: null, priceMap: {}, hasVariants: false };
    }


    async function fetchOutletAndMenu(outletId) {
        showLoading();

        try {
            const outletDocRef = doc(db, "outlets", outletId);
            const outletDocSnap = await getDoc(outletDocRef);

            if (!outletDocSnap.exists()) {
                showError("Outlet not found in database");
                return;
            }

            const data = outletDocSnap.data();
            currentOutletData = { id: outletDocSnap.id, name: outletDocSnap.id, ...data };

            //checkot cart link
            // console.log(currentOutletData.name)


            // --- NEW: Set modal title (from old code) ---
            if (modalRestaurantNameTitle) {
                modalRestaurantNameTitle.textContent = currentOutletData.name;
            }

            displayRestaurantHeader();
            updateFavoriteButtonState();

            let categories = [];
            if (Array.isArray(data.categories)) {
                categories = data.categories;
            } else if (data.categories && typeof data.categories === "object") {
                categories = Object.entries(data.categories).map(([name, value]) => ({
                    name,
                    items: Array.isArray(value.items)
                        ? value.items
                        : [{
                            name,
                            description: value.description || "",
                            prices: value.prices,
                            price: value.price,
                            imageURL: value.imageUrl || "https://placehold.co/160x160/cccccc/333333?text=No+Image"
                        }]
                }));
            }

            allMenuItems = [];
            categories.forEach(category => {
                const categoryName = category.name || 'Uncategorized';
                const items = Array.isArray(category.items) ? category.items : [];
                items.forEach(item => {
                    // --- FIX: Make 'item.name' safe before calling .replace() ---
                    const safeName = (item.name || '').toString(); 
                    const itemId = item.id || safeName.replace(/\s+/g, '-') || `item_${Date.now()}_${Math.random()}`;
                    
                    allMenuItems.push({
                        id: itemId,
                        name: item.name || 'Unnamed Item',
                        price: getItemPrice(item.prices, item.price),
                        description: item.description || '',
                        category: categoryName,
                        image: item.imageURL || 'https://placehold.co/160x160/cccccc/333333?text=No+Image',
                        restaurant: currentOutletData.name
                    });
                });
            });

            displayMenu();
            displayCart();

        } catch (error) {
            console.error("Error fetching menu: ", error);
            showError("Failed to load menu. Please check your internet connection.");
        }
    }


    function showLoading() {
        if (restaurantNameEl) restaurantNameEl.textContent = "Loading...";
        if (menuItemsContainer)
            menuItemsContainer.innerHTML = '<p class="loading-message">Fetching menu data...</p>';
    }

    function showError(message) {
        if (restaurantNameEl) restaurantNameEl.textContent = "Error";
        if (menuItemsContainer)
            menuItemsContainer.innerHTML = `<p class="error-message">${message}</p>`;
        if (favoriteOutletBtn) favoriteOutletBtn.disabled = true;
    }

    function displayRestaurantHeader() {
        if (!currentOutletData) return;
        restaurantNameEl.textContent = currentOutletData.name;
        restaurantCuisineEl.textContent = Array.isArray(currentOutletData.cuisineTypes)
            ? currentOutletData.cuisineTypes.join(', ')
            : (currentOutletData.cuisine || 'Cuisine');
        restaurantRatingEl.textContent = (currentOutletData.rating || 0).toFixed(1);
        restaurantImageEl.src = currentOutletData.imageUrl ||
            `https://placehold.co/254x169/cccccc/333333?text=${encodeURIComponent(currentOutletData.name)}`;

        if (restaurantDeliveryTimeEl) restaurantDeliveryTimeEl.textContent = currentOutletData.deliveryTime || '30';
        if (restaurantCostEl) restaurantCostEl.textContent = currentOutletData.costForTwo || '200';

        if (currentOutletData.offer && offersBoxEl && restaurantOfferEl) {
            restaurantOfferEl.textContent = currentOutletData.offer;
            offersBoxEl.classList.remove('hidden');
        } else if (offersBoxEl) {
            offersBoxEl.classList.add('hidden');
        }
    }

    function displayMenu(searchTerm = "") {
        if (!menuItemsContainer || !categoryListEl) return;

        const openCategories = Array.from(
            menuItemsContainer.querySelectorAll('.menu-category-title')
        )
            .filter(title => title.nextElementSibling?.classList.contains('show'))
            .map(title => title.textContent.trim().replace(/[▲▼]/g, '').trim());

        const filteredMenu = allMenuItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        menuItemsContainer.innerHTML = '';
        categoryListEl.innerHTML = '';
        if (modalCategoryList) modalCategoryList.innerHTML = '';


        if (filteredMenu.length === 0) {
            menuItemsContainer.innerHTML =
                `<p class="cart-empty-message" style="padding: 40px 0;">No menu items available</p>`;
            return;
        }

        // Get favorite items from this outlet
        const favoritedItemsFromOutlet = filteredMenu.filter(item => favoriteItems.includes(item.id));
        
        const categories = [...new Set(filteredMenu.map(i => i.category || 'Uncategorized'))].sort();

        if (favoritedItemsFromOutlet.length > 0) {
            const favCategoryId = 'category-Favorites';
            
            const favLink = document.createElement('li');
            favLink.innerHTML = `<a href="#${favCategoryId}" style="color: var(--primary-color); font-weight: 600;">❤️ Favorites</a>`;
            categoryListEl.appendChild(favLink);

            if (modalCategoryList) {
                const favLi = document.createElement('li');
                favLi.innerHTML = `<a href="#${favCategoryId}" data-category-id="${favCategoryId}" style="color: var(--primary-color); font-weight: 600;">❤️ Favorites</a> <span>${favoritedItemsFromOutlet.length}</span>`;
                modalCategoryList.appendChild(favLi);
            }
        }

        categories.forEach(category => {
            // --- FIX: Add a guard to skip undefined categories ---
            if (!category) {
                console.warn("Skipping an undefined menu category.");
                return; // Skips this loop iteration
            }
            // --- END FIX ---

            const categoryId = `category-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;

            // 1. Desktop List
            const link = document.createElement('li');
            link.innerHTML = `<a href="#${categoryId}">${category}</a>`;
            categoryListEl.appendChild(link);

            if (modalCategoryList) {
                const itemsInCategory = filteredMenu.filter(item => (item.category || 'Uncategorized') === category);
                const itemCount = itemsInCategory.length;

                const li = document.createElement('li');
                li.innerHTML = `<a href="#${categoryId}" data-category-id="${categoryId}">${category}</a> <span>${itemCount}</span>`;
                modalCategoryList.appendChild(li);
            }
        });

        if (favoritedItemsFromOutlet.length > 0) {
            const favCategoryId = 'category-Favorites';
            const favTitle = document.createElement('h3');
            favTitle.className = 'menu-category-title';
            favTitle.id = favCategoryId;
            favTitle.innerHTML = `❤️ Favorites <span class='menu-item-title-arrow'>▼</span>`;
            menuItemsContainer.appendChild(favTitle);

            const favGridWrapper = document.createElement('div');
            favGridWrapper.className = 'menu-items-grid';

            favoritedItemsFromOutlet.forEach(item => {
                favGridWrapper.appendChild(createMenuItemCard(item));
            });

            menuItemsContainer.appendChild(favGridWrapper);

            if (openCategories.includes('❤️ Favorites')) {
                favGridWrapper.classList.add('show');
                favTitle.innerHTML = `❤️ Favorites <span class='menu-item-title-arrow'>▲</span>`;
            }

            favTitle.addEventListener('click', () => {
                const nextEl = favTitle.nextElementSibling;
                nextEl.classList.toggle('show');

                if (nextEl.classList.contains('show')) {
                    favTitle.innerHTML = `❤️ Favorites <span class='menu-item-title-arrow'>▲</span>`;
                } else {
                    favTitle.innerHTML = `❤️ Favorites <span class='menu-item-title-arrow'>▼</span>`;
                }
            });
        }

        categories.forEach(category => {
            // --- FIX: Add a guard to skip undefined categories ---
            if (!category) {
                return; // Skips this loop iteration
            }
            // --- END FIX ---
            
            const itemsInCategory = filteredMenu.filter(i => i.category === category);
            const categoryId = `category-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;

            const title = document.createElement('h3');
            title.className = 'menu-category-title';
            title.id = categoryId; 
            title.innerHTML = `${category} <span class='menu-item-title-arrow'>▼</span>`;
            menuItemsContainer.appendChild(title);

            const gridWrapper = document.createElement('div');
            gridWrapper.className = 'menu-items-grid';

            itemsInCategory.forEach(item => {
                gridWrapper.appendChild(createMenuItemCard(item));
            });

            menuItemsContainer.appendChild(gridWrapper);

            if (openCategories.includes(category)) {
                gridWrapper.classList.add('show');
                title.innerHTML = `${category} <span class='menu-item-title-arrow'>▲</span>`;
            }


            title.addEventListener('click', () => {
                const nextEl = title.nextElementSibling;
                nextEl.classList.toggle('show');

                if (nextEl.classList.contains('show')) {
                    title.innerHTML = `${category} <span class='menu-item-title-arrow'>▲</span>`;
                } else {
                    title.innerHTML = `${category} <span class='menu-item-title-arrow'>▼</span>`;
                }
            });

        });
    }

    /**
     * Creates item card, checks cart for the *default variant*
     * to set the initial button state.
     */
    function createMenuItemCard(item) {
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        card.id = item.id; // The card's ID is still the base ID

        // --- Price Text Logic (Unchanged) ---
        let priceText = '';
        if (item.price.displayPrice === null) {
            priceText = '<span class="price-unavailable">Price not available</span>';
        } else if (item.price.hasVariants) {
            priceText = `Starting from ₹${item.price.displayPrice.toFixed(0)}`;
        } else {
            priceText = `₹${item.price.displayPrice.toFixed(0)}`;
        }

        // --- Dynamic Size Tab Logic (Unchanged) ---
        let sizeTabsHtml = '';
        if (item.price.hasVariants) {
            sizeTabsHtml = '<div class="size-tabs-container">';
            let isFirstTab = true;
            for (const variantName in item.price.priceMap) {
                const price = item.price.priceMap[variantName];
                const displayName = variantName.charAt(0).toUpperCase() + variantName.slice(1);
                
                sizeTabsHtml += `<button class="size-tab ${isFirstTab ? 'active' : ''}" data-size="${variantName}" data-price="${price}">
                    ${displayName}
                </button>`;
                isFirstTab = false;
            }
            sizeTabsHtml += '</div>';
        }

        // --- MODIFIED: Action Button Logic ---
        let actionButtonHtml = '';
        if (item.price.displayPrice !== null && !isCallOnly) {
            let compositeId;
            // Determine the ID to check in the cart
            if (item.price.hasVariants) {
                // Get the default (first) variant to set the initial button state
                const defaultVariantName = Object.keys(item.price.priceMap)[0];
                compositeId = `${item.id}_${defaultVariantName}`;
            } else {
                // Item has no variants, use its base ID
                compositeId = item.id;
            }

            // Check if this specific item/variant is in the cart
            const itemInCart = cart[compositeId];
            
            if (itemInCart) {
                actionButtonHtml = `<div class="item-quantity-controls">
                     <button class="quantity-btn decrease-btn" data-item-id="${compositeId}">-</button>
                     <span class="quantity-display">${itemInCart.quantity}</span>
                     <button class="quantity-btn increase-btn" data-item-id="${compositeId}">+</button>
                   </div>`;
            } else {
                actionButtonHtml = `<button class="btn-add" data-item-id="${compositeId}">Add +</button>`;
            }
        }

        const isFavorited = favoriteItems.includes(item.id);
        const heartIcon = isFavorited ? '❤️' : '🤍';

        card.innerHTML = `
            <div class="menu-item-info">
                <h4>${item.name}</h4>
                <p class="price">${priceText}</p> 
                <p class="item-description">${item.description || ''}</p>
                
                ${sizeTabsHtml}

                <button class="favorite-heart-btn ${isFavorited ? 'favorited' : ''}" data-item-id="${item.id}" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
                    ${heartIcon}
                </button>
            </div>
            <div class="menu-item-action">
                <img src="${item.image}" alt="${item.name}">
                ${actionButtonHtml}
            </div>
        `;
        return card;
    }
    

    /**
     * Displays desktop cart (filtered) AND mobile cart bar (global)
     */
    function displayCart() {
        if (!cartItemsContainer || !subtotalContainer || !checkoutLink || !cartTitleEl || !subtotalPriceEl) return;

        // --- 1. Get Cart Info ---
        cartItemsContainer.innerHTML = '';
        let subtotal = 0, totalItemsThisOutlet = 0;

        // --- 1. DESKTOP CART LOGIC (Filtered) ---
        const itemsForThisOutlet = Object.values(cart).filter(c =>
           c.item && c.item.restaurant === currentOutletData?.name
        );

        if (itemsForThisOutlet.length === 0) {
            cartItemsContainer.innerHTML = '<p class="cart-empty-message">Your cart for this outlet is empty</p>';
            subtotalContainer.classList.add('hidden');
        } else {
            itemsForThisOutlet.forEach(({ item, quantity }) => {
                totalItemsThisOutlet += quantity;
                // Use displayPrice for calculation
                if (item.price.displayPrice !== null) {
                    subtotal += item.price.displayPrice * quantity;
                }

                // Use new create element method for security
                const div = document.createElement('div');
                div.className = 'cart-item';
                // Note: The "from" text was in the new code, keeping it.
                div.innerHTML = `
                    <p class="cart-item-from">from <span class="text-primary">${item.restaurant}</span></p>
                    <div class="cart-item-main">
                        <div class="cart-item-desc">
                            <p>${item.name}</p>
                            <p>₹${(item.price && typeof item.price.displayPrice === 'number') ? item.price.displayPrice.toFixed(0) : 'N/A'}</p>
                        </div>
                        <div class="cart-item-controls">
                            <button class="cart-btn" data-item-id="${item.id}" data-action="decrease">−</button>
                            <span>${quantity}</span>
                            <button class="cart-btn" data-item-id="${item.id}" data-action="increase">+</button>
                        </div>
                    </div>`;
                cartItemsContainer.appendChild(div);
       });
            subtotalContainer.classList.remove('hidden');
        }

        // Update desktop totals
        subtotalPriceEl.textContent = `₹${subtotal.toFixed(0)}`;
        cartTitleEl.innerHTML = `<span class="cart-title-text">Cart</span><span class="cart-item-count">(${totalItemsThisOutlet} ${totalItemsThisOutlet > 1 ? 'Items' : 'Item'})</span>`;

        // --- 2. GLOBAL CHECKOUT & MOBILE BAR LOGIC (from Old Code) ---
        let globalTotalItems = 0;
        let firstItemImage = "https://placehold.co/40x40/cccccc/333?text=C";
        const allCartItems = Object.values(cart); // Get all items from all outlets

        allCartItems.forEach(({ item, quantity }) => {
            if (item && item.price.displayPrice !== null) {
                globalTotalItems += quantity;
            }
        });

                // Show/Hide checkout link based on GLOBAL cart
        if (globalTotalItems === 0) {
            checkoutLink.classList.add('hidden');
        } else {
            checkoutLink.classList.remove('hidden');
            // --- FIX: Use the global 'currentOutletPrettyName' variable ---
            if (checkoutLink) checkoutLink.href = `checkout.html?outlet=${currentOutletPrettyName}`; 
        }

        // Mobile bar logic
        if (mobileCartBar && mobileCartTextEl && mobileCartImageEl && mobileMenuBtn) {
            const firstItemWithImage = allCartItems.find(c => c.item && c.item.image);
            if (firstItemWithImage) {
                firstItemImage = firstItemWithImage.item.image;
            }

            if (globalTotalItems === 0) {
                mobileCartBar.classList.remove("visible");
                mobileMenuBtn.style.bottom = '15px'; // Default position
            } else {
                mobileCartTextEl.textContent = `${globalTotalItems} ${globalTotalItems === 1 ? "item" : "items"} added`;
                mobileCartImageEl.src = firstItemImage;
                mobileCartImageEl.alt = firstItemWithImage ? firstItemWithImage.item.name : "cart item";
                mobileCartBar.classList.add("visible");
                mobileMenuBtn.style.bottom = '95px'; // Move menu button UP
            }
        }
    }

    // --- EVENT HANDLERS ---

    /**
     * Includes event handler for size tabs that
     * also updates the add/remove buttons.
     */
    function setupEventHandlers() {
        if (dishSearchInput) dishSearchInput.addEventListener('input', () => {
            displayMenu(dishSearchInput.value.trim());
        });

        if (favoriteOutletBtn) favoriteOutletBtn.addEventListener('click', () => {
            if (currentOutletData) toggleFavoriteOutlet(currentOutletData.name);
        });

        if (menuItemsContainer) menuItemsContainer.addEventListener('click', (e) => {
            
            // --- MODIFIED: Handle size tab clicks ---
            const sizeTab = e.target.closest('.size-tab');
            if (sizeTab) {
                const card = sizeTab.closest('.menu-item-card');
                const container = sizeTab.closest('.size-tabs-container');
                if (!card || !container) return;

                // 1. Update Active Tab
                container.querySelectorAll('.size-tab').forEach(tab => tab.classList.remove('active'));
                sizeTab.classList.add('active');

                // 2. Update Visual Price
                const priceEl = card.querySelector('.price');
                const newPrice = parseFloat(sizeTab.dataset.price);
                if (priceEl && !isNaN(newPrice)) {
                    priceEl.textContent = `₹${newPrice.toFixed(0)}`;
                }

                // --- NEW: 3. Update Action Buttons ---
                const actionDiv = card.querySelector('.menu-item-action');
                if (!actionDiv) return;

                // Get the new composite ID from the clicked tab
                const baseItemId = card.id;
                const variantName = sizeTab.dataset.size;
                const compositeId = `${baseItemId}_${variantName}`;

                // Check cart for this specific variant
                const itemInCart = cart[compositeId];
                let newButtonHtml = '';

                if (itemInCart) {
                    // This variant is in cart, show +/-
                    newButtonHtml = `<div class="item-quantity-controls">
                         <button class="quantity-btn decrease-btn" data-item-id="${compositeId}">-</button>
                         <span class="quantity-display">${itemInCart.quantity}</span>
                         <button class="quantity-btn increase-btn" data-item-id="${compositeId}">+</button>
                       </div>`;
                } else {
                    // This variant is not in cart, show Add
                    newButtonHtml = `<button class="btn-add" data-item-id="${compositeId}">Add +</button>`;
                }

                // Replace old buttons (Add or +/-) with the new buttons
                const oldButtons = actionDiv.querySelector('.btn-add, .item-quantity-controls');
                if (oldButtons) {
                    oldButtons.remove();
                }
                // Add the new HTML to the end of the actionDiv
                actionDiv.insertAdjacentHTML('beforeend', newButtonHtml);

                return; // Stop processing, it was just a tab click
            }
            // --- END OF MODIFIED BLOCK ---

            const favoriteBtn = e.target.closest('.favorite-heart-btn');
            if (favoriteBtn) {;
                const itemId = favoriteBtn.dataset.itemId; // This is still the base item ID
                const item = allMenuItems.find(i => i.id === itemId);
                if (item) {
                    toggleFavoriteItem(itemId, item);
                }
                return;
            }

            // This button's data-item-id is now a compositeId (e.g., "pizza-1_small")
            const button = e.target.closest('button[data-item-id]');
            if (!button || button.classList.contains('favorite-heart-btn')) return;

            // 'itemId' is now the compositeId
            const compositeId = button.dataset.itemId;
            
            // We need to find the base item to create the cart entry
            const baseItemId = compositeId.split('_')[0];
            const baseItem = allMenuItems.find(i => i.id === baseItemId);
            
            if (baseItem) {
                // Pass the compositeId and the baseItem
                handleMenuItemAction(button, compositeId, baseItem);
            }
            displayCarts()
        });

        if (cartItemsContainer) cartItemsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.cart-btn');
            if (!button) return;
            // This already works, as the cart buttons will also have the compositeId
            handleCartAction(button.dataset.itemId, button.dataset.action);
        });

        const checkoutBtn = document.getElementById("proceed-to-payment-btn");
        if (checkoutBtn) {
            checkoutBtn.addEventListener("click", () => {
                window.location.href = "checkout.html";
            });
        }
    }

    /**
     * Handles adding the *specific variant* to the cart
     * using the compositeId.
     */
    function handleMenuItemAction(button, compositeId, baseItem) {
        if (isCallOnly) return;

        // If 'btn-add' was clicked, we need to create the cart entry
        if (button.classList.contains('btn-add')) {
            // Check if it's a variant or a single item
            let cartItem;
            
            if (compositeId.includes('_')) {
                // It's a variant (e.g., "pizza-1_small")
                const [baseItemId, variantName] = compositeId.split('_');
                const variantPrice = parseFloat(baseItem.price.priceMap[variantName]);
                const variantDisplayName = variantName.charAt(0).toUpperCase() + variantName.slice(1);

                // Create a new item object specifically for the cart
                cartItem = {
                    ...baseItem, // Copy all base properties (like image, restaurant, description)
                    id: compositeId, // Set the ID to the composite ID
                    name: `${baseItem.name} (${variantDisplayName})`, // e.g., "Margherita Pizza (Small)"
                    price: { // Create a new, simple price object
                        displayPrice: variantPrice,
                        hasVariants: false,
                        priceMap: { [variantName]: variantPrice }
                    }
                };
            } else {
                // It's a single item (no variants)
                cartItem = baseItem;
            }
            
            // Add the new item to the cart
            cart[compositeId] = { item: cartItem, quantity: 1 };

        } else if (button.classList.contains('increase-btn')) {
            // The item must exist in the cart
            if (cart[compositeId]) {
                cart[compositeId].quantity++;
            }
        } else if (button.classList.contains('decrease-btn')) {
            // The item must exist in the cart
            if (cart[compositeId]) {
                cart[compositeId].quantity--;
                if (cart[compositeId].quantity <= 0) {
                    delete cart[compositeId];
                }
            }
        }

        saveCart();
        // Re-display menu to update the button (it will be replaced by +/-)
        displayMenu(dishSearchInput?.value.trim() || "");
        displayCart(); 
    }

    function handleCartAction(itemId, action) {
        if (!cart[itemId]) return;
        if (action === 'increase') cart[itemId].quantity++;
        else if (action === 'decrease') {
            cart[itemId].quantity--;
            if (cart[itemId].quantity <= 0) delete cart[itemId];
        }
        saveCart();
        displayMenu(dishSearchInput?.value.trim() || "");
        displayCart();
    }


    function setupModalEventHandlers() {
        if (mobileMenuBtn && categoryModalOverlay && closeCategoryModalBtn && modalCategoryList) {
            mobileMenuBtn.addEventListener('click', openCategoryModal);
            closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
            categoryModalOverlay.addEventListener('click', (e) => {
                if (e.target === categoryModalOverlay) {
                    closeCategoryModal();
                }
            });
            modalCategoryList.addEventListener('click', handleModalCategoryClick);
        }
    }

    function openCategoryModal() {
        if (categoryModalOverlay && mobileMenuBtn && categoryModal) {
            const menuBtnBottom = parseInt(window.getComputedStyle(mobileMenuBtn).bottom, 10);
            const menuBtnHeight = mobileMenuBtn.offsetHeight;
            const modalBottomPosition = menuBtnBottom + menuBtnHeight + 10;
            categoryModal.style.bottom = `${modalBottomPosition}px`;
            categoryModalOverlay.classList.remove('hidden');
            document.body.classList.add('no-scroll');
        }
    }

    function closeCategoryModal() {
        if (categoryModalOverlay && categoryModal) {
            categoryModalOverlay.classList.add('hidden');
            document.body.classList.remove('no-scroll');
            categoryModal.style.bottom = '0px';
        }
    }

    function handleModalCategoryClick(e) {
        const link = e.target.closest('a[data-category-id]');
        if (!link) return;

        e.preventDefault();
        const categoryId = link.dataset.categoryId;
        const targetElement = document.getElementById(categoryId);

        if (targetElement) {
            const header = document.querySelector('.main-header');
            const headerHeight = header ? header.offsetHeight : 0;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
        closeCategoryModal();
    }


    // --- UTILITY FUNCTIONS ---
    function setupProfileDropdownToggle() {
        if (!profileContainer) return;
        profileContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            profileContainer.classList.toggle('dropdown-active');
        });
        window.addEventListener('click', () => profileContainer.classList.remove('dropdown-active'));
    }

    function setupScrollAnimations() {
        const elements = document.querySelectorAll('.fade-in-element');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => e.isIntersecting && e.target.classList.add('visible'));
        }, { threshold: 0.1 });
        elements.forEach(el => observer.observe(el));
    }

    function setupHeaderSearchRedirect() {
        const form = document.getElementById('header-search-form');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = document.getElementById('header-search-input').value.trim();
            if (q) window.location.href = `searchResults.html?query=${encodeURIComponent(q)}`;
        });
    }

    initializePage();
});