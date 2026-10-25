// --- NAVBAR AUTH & LOGIC SCRIPT (Updated) ---
// This script waits for 'navbarLoaded' and then attaches all logic.

// 1. Import Firebase modules
// 💡 IMPORTANT: Make sure this path to your config is correct!
// We now import 'db' as well, to fetch user details.
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { initWishlist } from '../shared/wishlist-logic.js'; // Import Wishlist Logic

// 2. Wait for the 'navbarLoaded' event
document.addEventListener('navbarLoaded', () => {
    console.log("navbar-auth.js: Heard 'navbarLoaded' event. Initializing auth...");
    initializeNavbarAuth();
    initWishlist(auth, db); // Initialize Wishlist
});

/**
 * Finds navbar elements (now that they exist) and attaches auth logic.
 */
function initializeNavbarAuth() {

    // --- 3. Find Elements (Selectors updated to match nav.html) ---
    const authLinksContainer = document.querySelector('.nav-auth'); // The <ul> holding login/signup
    const profileDropdown = document.querySelector('.profile-dropdown'); // The whole profile div
    const profileBtn = document.getElementById('profileBtn'); // The profile icon button
    const profileMenu = document.getElementById('profileMenu'); // The dropdown menu

    // Check if critical elements exist
    if (!authLinksContainer || !profileDropdown || !profileBtn || !profileMenu) {
        console.error("Navbar Auth Error: Could not find all required navbar elements. Check selectors like '.nav-auth' and '#profileBtn'.");
        return;
    }

    // Find elements *inside* the dropdown
    const profileNameEl = profileMenu.querySelector('.user-info strong');
    const profileEmailEl = profileMenu.querySelector('.user-info span');
    // Find the sign-out link by its href
    const signOutLink = profileMenu.querySelector('a[href="../index.html"]');

    if (!profileNameEl || !profileEmailEl || !signOutLink) {
        console.error("Navbar Auth Error: Could not find user info or sign-out link inside the dropdown.");
        return;
    }

    // --- INSTANT UI UPDATE FROM LOCALSTORAGE ---
    // Check localStorage to show correct UI immediately (before Firebase responds)
    const cachedAuthState = localStorage.getItem('campusHubAuthState');
    const cachedUserData = localStorage.getItem('campusHubUserData');

    if (cachedAuthState === 'loggedIn' && cachedUserData) {
        // Show profile button immediately
        authLinksContainer.classList.remove('show');
        authLinksContainer.style.display = 'none';
        profileDropdown.style.display = 'inline-block';

        // Load cached user data
        try {
            const userData = JSON.parse(cachedUserData);
            profileNameEl.textContent = userData.name || "Student";
            profileEmailEl.textContent = userData.email || "Loading...";
        } catch (e) {
            console.error("Error parsing cached user data:", e);
        }
    } else if (cachedAuthState === 'loggedOut') {
        // Show login/signup immediately
        authLinksContainer.classList.add('show');
        profileDropdown.style.display = 'none';
    }
    // If no cached state, keep both hidden until Firebase responds

    // --- 4. Auth UI Update Function (Merged with logic from your working script) ---
    /**
     * Shows/hides UI and fetches user data based on login state.
     * @param {object | null} user - The Firebase user object or null.
     */
    async function updateAuthUI(user) {
        if (user) {
            // User is signed in
            authLinksContainer.classList.remove('show');
            authLinksContainer.style.display = 'none';
            profileDropdown.style.display = 'inline-block'; // Show profile button

            try {
                // Get user document from Firestore
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);

                let userData;
                if (userSnap.exists()) {
                    userData = userSnap.data();
                    profileNameEl.textContent = userData.name || "Student";
                    profileEmailEl.textContent = userData.email || user.email;
                } else {
                    // Fallback if no document exists
                    userData = {
                        name: user.email.split('@')[0],
                        email: user.email
                    };
                    profileNameEl.textContent = userData.name;
                    profileEmailEl.textContent = userData.email;
                }

                // Save to localStorage for instant load next time
                localStorage.setItem('campusHubAuthState', 'loggedIn');
                localStorage.setItem('campusHubUserData', JSON.stringify({
                    name: userData.name || user.email.split('@')[0],
                    email: userData.email || user.email
                }));

            } catch (err) {
                console.error("Error fetching user data:", err);
                profileNameEl.textContent = "Student";
                profileEmailEl.textContent = "Welcome";

                // Still save basic auth state
                localStorage.setItem('campusHubAuthState', 'loggedIn');
                localStorage.setItem('campusHubUserData', JSON.stringify({
                    name: "Student",
                    email: user.email || "Welcome"
                }));
            }

        } else {
            // User is signed out
            authLinksContainer.classList.add('show'); // Show login/signup with proper styling
            profileDropdown.style.display = 'none'; // Hide profile button
            profileMenu.classList.remove("show"); // Ensure menu is closed

            // Clear localStorage
            localStorage.setItem('campusHubAuthState', 'loggedOut');
            localStorage.removeItem('campusHubUserData');
        }
    }

    // --- 5. Attach Event Listeners ---

    // Sign Out Button
    signOutLink.addEventListener('click', async (e) => {
        e.preventDefault(); // Stop the link from navigating immediately
        try {
            await signOut(auth);
            // onAuthStateChanged will handle the UI update
            console.log("User signed out.");
            // Reload or redirect to home
            window.location.href = '../index.html';
        } catch (error) {
            console.error("Sign Out Error:", error);
            alert("Failed to sign out. Please try again.");
        }
    });

    // Profile Dropdown Toggle
    profileBtn.addEventListener('click', (e) => {
        // Stop the click from closing the menu immediately
        e.stopPropagation();
        profileMenu.classList.toggle('show');
    });

    // --- 6. Attach Global Listeners ---

    // Close dropdown if user clicks anywhere else on the window
    window.addEventListener('click', (e) => {
        if (profileMenu.classList.contains('show')) {
            // Check if the click was *outside* the button and the menu
            if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
                profileMenu.classList.remove('show');
            }
        }
    });

    // --- 7. Start the Firebase Auth Listener ---
    // This runs once on load and any time the user signs in or out.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Auth State: Signed In", user.uid);
        } else {
            console.log("Auth State: Signed Out");
        }
        // Call our new async function to update the UI
        updateAuthUI(user);
    });
}

