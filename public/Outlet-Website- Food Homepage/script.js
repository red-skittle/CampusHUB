import { auth, db } from '../firebase-config.js'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"; 
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getGroupedCart, setupCartDropdownToggle } from './func.js';

document.addEventListener('DOMContentLoaded', function() {

    let currentUser = null; 
    let allOutletsData = []; 
    
    const signInButton = document.getElementById('sign-in-btn');
    const profileContainer = document.getElementById('profile-container');
    const cartLinkContainer = document.querySelector('.cart-link-container')
    const signOutButton = document.getElementById('sign-out-btn');
    const profileIcon = document.getElementById('profile-icon');
    const dropdown = profileContainer ? profileContainer.querySelector('#profile-dropdown') : null;
    const cartDropdown = cartLinkContainer?cartLinkContainer.querySelector('.cart-link-dropdown') : null
    const outletGrid = document.querySelector('.outlets-section .outlet-grid');
    const outletTagsContainer = document.querySelector('.outlet-tags');
    const searchInput = document.getElementById('banner-search');
    const cartLinkContainerA = document.querySelector('.cart-link-container a')

    async function signInUser() {
    }

    function displayCarts(){
        const groupedCart = getGroupedCart()
        let cartsHtml = ''
        let urlParams = new URLSearchParams(window.location.search);
        let outletName = urlParams.get('outlet');
        if((Object.keys(getGroupedCart()).length <= 1)){
            if (Object.keys(getGroupedCart()).length == 1) outletName = Object.entries(groupedCart)[0][0];
            cartLinkContainerA.href = `checkout.html?outlet=${outletName}`
        }
        
        Object.entries(groupedCart).forEach(([restaurant, items]) => {
            cartsHtml += `<a href='checkout.html?outlet=${restaurant}' <button id="restorant-cart-btn" class="btn btn-dark btn-small">${restaurant}</button></a>`
      });
      cartDropdown.innerHTML = cartsHtml
    }
    displayCarts()

    async function signOutUser() {
        try {
            await signOut(auth);
        } catch (error) {
            alert("Sign out failed. Please try again.");
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

        if (currentUser) {
            signInButton.style.display = 'none';
            profileContainer.classList.remove('hidden');
            localStorage.setItem('campusHubAuthState', 'loggedIn');
        } else {
            signInButton.style.display = 'block';
            profileContainer.classList.add('hidden');
            if (profileContainer.classList.contains('dropdown-active')) {
                profileContainer.classList.remove('dropdown-active');
            }
            localStorage.setItem('campusHubAuthState', 'loggedOut');
            localStorage.removeItem('campusHubUserData');
        }
    }
    
    if (signInButton) signInButton.addEventListener('click', signInUser);
    if (signOutButton) signOutButton.addEventListener('click', signOutUser);
    
    onAuthStateChanged(auth, (user) => {
        updateAuthUI(user);
    });
    
    async function fetchAllOutlets() {
        if (outletGrid) {
            outletGrid.innerHTML = '<p>Loading outlets from CampusHUB...</p>';
        }

        try {
            const outletsRef = collection(db, "outlets");
            const snapshot = await getDocs(outletsRef);
            
            snapshot.forEach(doc => {
                const data = doc.data();
                allOutletsData.push({
                    id: doc.id,
                    name: doc.id, 
                    ...data
                });
            });

            allOutletsData.sort((a, b) => {
                const aIsDialog = a.id.trim().toLowerCase() === 'dialogcafe';
                const bIsDialog = b.id.trim().toLowerCase() === 'dialogcafe';

                if (aIsDialog && !bIsDialog) {
                    return -1;
                } else if (!aIsDialog && bIsDialog) {
                    return 1;
                } else {
                    return 0;
                }
            });

            if (allOutletsData.length > 0) {
                renderOutletCards(allOutletsData);
            } else {
                if (outletGrid) {
                    outletGrid.innerHTML = '<p>No outlets found. Add documents to the "OutletsMenu" collection.</p>';
                }
            }

        } catch (error) {
            if (outletGrid) {
                outletGrid.innerHTML = '<p>Failed to load outlets. Check your **Firestore Security Rules** (must allow public read access) and network connection.</p>';
            }
        }
    }

    function renderOutletCards(outletsToRender) {
        if (!outletGrid) return;
        outletGrid.innerHTML = '';
        
        if (outletsToRender.length === 0) {
            outletGrid.innerHTML = `<p class="no-results-message">Sorry, no outlets found matching your search.</p>`;
            return;
        }

        outletsToRender.forEach(outlet => {
            let rating = (outlet.rating || 0).toFixed(1);
            let ratingClass = rating >= 4.0 ? 'rating-high' : rating >= 3.0 ? 'rating-mid' : 'rating-low';
            
            const cuisineDisplay = (Array.isArray(outlet.cuisineTypes) && outlet.cuisineTypes.length > 0) ? 
                                   outlet.cuisineTypes[0] : (outlet.cuisine || 'N/A');

            const imageUrl = (outlet.imageUrl && !outlet.imageUrl.toLowerCase().includes('placeholder')) 
                ? outlet.imageUrl 
                : `https://placehold.co/256x256/F8F8F8/333333?text=${encodeURIComponent(outlet.name.replace(/ /g, '+'))}`;
            
            const cardHTML = `
                <a href="menu.html?outlet=${encodeURIComponent(outlet.name)}" class="outlet-card-link">
                    <div class="outlet-card">
                        <img src="${imageUrl}" alt="${outlet.name}">
                        <div class="card-content">
                            <h3>${outlet.name}</h3>
                            <div class="card-details">
                                <span class="cuisine">${cuisineDisplay}</span>
                                <span class="rating ${ratingClass}">★ ${rating}</span>
                            </div>
                        </div>
                    </div>
                </a>
            `;
            outletGrid.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    document.getElementById('sign-in-btn').addEventListener('click', () => {
        window.location.href = "../login-pages/welcomelogin.html";
    })

    function setupSearchFilter() {
        const searchInput = document.getElementById('banner-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', () => {
            if (allOutletsData.length === 0) return;
            
            const searchTerm = searchInput.value.trim().toLowerCase();
            const filteredOutlets = allOutletsData.filter(outlet => {
                if (outlet.name.toLowerCase().includes(searchTerm)) return true;
                
                if (Array.isArray(outlet.cuisineTypes)) {
                    return outlet.cuisineTypes.some(cuisine => 
                        cuisine.toLowerCase().includes(searchTerm)
                    );
                }
                
                return false; 
            });
            renderOutletCards(filteredOutlets);
        });
    }

    function setupSearchSubmit() {
        const searchForm = document.querySelector('.banner-search-form');
        if (!searchForm) return;

        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (searchInput) {
                searchInput.dispatchEvent(new Event('input'));
            }
        });
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
        if (dropdown) {
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation(); 
            });
        }
    }

    setupCartDropdownToggle(cartLinkContainer,cartDropdown);

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

    function setupScrollAnimations() {
        const elementsToAnimate = document.querySelectorAll('.fade-in-element');
        if (elementsToAnimate.length === 0) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                } 
            });
        }, { threshold: 0.1 });
        elementsToAnimate.forEach(element => { observer.observe(element); });
    }

    function setupSlowScroll() {
        const getStartedBtn = document.querySelector('.hero-content .btn');
        const targetSection = document.getElementById('search-banner-section');
        if (!getStartedBtn || !targetSection) return;
        getStartedBtn.addEventListener('click', (event) => {
            event.preventDefault();
            const targetPosition = targetSection.getBoundingClientRect().top + window.scrollY;
            const startPosition = window.scrollY;
            const distance = targetPosition - startPosition;
            const duration = 1500;
            let startTime = null;
            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
                window.scrollTo(0, run);
                if (timeElapsed < duration) requestAnimationFrame(animation);
            }
            function easeInOutQuad(t, b, c, d) {
                t /= d / 2;
                if (t < 1) return c / 2 * t * t + b;
                t--;
                return -c / 2 * (t * (t - 2) - 1) + b;
            };
            requestAnimationFrame(animation);
        });
    }

    function setupImagePositioning() {
        const images = document.querySelectorAll('.hero-images img');
        if (images.length !== 3) return;
        images[0].classList.add('pos-1');
        images[1].classList.add('pos-2');
        images[2].classList.add('pos-3');
        setInterval(() => {
            const pos1_img = document.querySelector('.pos-1');
            const pos2_img = document.querySelector('.pos-2');
            const pos3_img = document.querySelector('.pos-3');
            if(!pos1_img || !pos2_img || !pos3_img) return;
            images.forEach(img => {
                img.classList.remove('pos-1', 'pos-2', 'pos-3');
            });
            pos2_img.classList.add('pos-1');
            pos1_img.classList.add('pos-3');
            pos3_img.classList.add('pos-2');
        }, 4000);
    }
    
    setupProfileDropdownToggle();
    setupCartDropdownToggle()
    setupHeaderSearchRedirect();
    setupScrollAnimations();
    setupSlowScroll();
    setupImagePositioning();
    setupSearchFilter(); 
    setupSearchSubmit(); 
    fetchAllOutlets();
});