// Profile Page Script

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"; // Added signOut for header/dropdown
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- CORE PROFILE DATA FETCHING & POPULATION ---

async function fetchRealUserData(user) {
    if (!user) return null;

    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            console.log("Document data successfully fetched:", docSnap.data());
            return docSnap.data();
        } else {
            console.log("No user profile document found for UID:", user.uid);
            return null;
        }
    } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
        return null;
    }
}

function extractRegNumFromEmail(email) {
    if (!email || typeof email !== 'string') {
        return 'N/A (Invalid Email)';
    }

    // Finds the part between the first dot and the '@'
    const afterDot = email.substring(email.indexOf('.') + 1);
    const regNum = afterDot.substring(0, afterDot.indexOf('@'));

    if (regNum && /^\d+$/.test(regNum)) {
        return regNum;
    } else {
        return 'N/A (Extraction Failed)';
    }
}

function populateProfile(data) {
    
    // Ensure email is always available for fallbacks
    const userEmail = data.email || (auth.currentUser ? auth.currentUser.email : 'N/A');

    const userData = {
        name: data.name || 'User Name N/A',
        dob: data.dateOfBirth || 'N/A', 
        block: data.block || 'N/A',
        phone: data.mobile || 'N/A', 
        room: data.room || 'N/A',
        mail: userEmail, // Use corrected email
        
        regNum: extractRegNumFromEmail(userEmail), 
        
        year: data.year || 'N/A', 
        branch: data.branch || 'N/A', 
        about: data.about || 'This user has not set an "About Me" bio yet.' 
    };

    document.getElementById('user-name-main').textContent = userData.name;
    
    document.getElementById('user-name').textContent = userData.name;
    document.getElementById('user-year').textContent = userData.year;
    document.getElementById('user-reg-num').textContent = userData.regNum;
    document.getElementById('user-branch').textContent = userData.branch;
    document.getElementById('user-dob').textContent = userData.dob;
    document.getElementById('user-block').textContent = userData.block;
    document.getElementById('user-phone').textContent = userData.phone;
    document.getElementById('user-room').textContent = userData.room;
    document.getElementById('user-mail').textContent = userData.mail;
    
    document.getElementById('user-about').textContent = userData.about;
}

const mainContent = document.querySelector('.profile-content');
mainContent.style.opacity = 0; 

// --- MAIN PROFILE AUTH CHECK ---
// NOTE: This runs immediately and handles page access/main content loading.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User is logged in. UID:", user.uid);
        
        const profileData = await fetchRealUserData(user);
        
        if (profileData) {
             populateProfile({ ...profileData, email: user.email }); // Pass the auth email as fallback
        } else {
             populateProfile({ email: user.email, name: user.email.split('@')[0] || 'New User' });
        }

    } else {
        console.log("No user is logged in. Redirecting...");
        // Ensure the path to your login page is correct
        window.location.href = '../login-pages/welcomelogin.html'; 
        return; 
    }
    
    // Show main content only after data is loaded and authentication is confirmed
    mainContent.classList.add('content-visible');
    mainContent.style.opacity = 1; 
});


// --- DOMContentLoaded & Component Setup ---

document.addEventListener('DOMContentLoaded', () => {

    function loadHTMLComponent(url, placeholderId) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                const placeholder = document.getElementById(placeholderId);
                if (placeholder) {
                    placeholder.innerHTML = html;
                    console.log(`${placeholderId} loaded successfully.`);
                    // Dispatch the event that the navbar/footer scripts listen for
                    const event = new CustomEvent(`${placeholderId}Loaded`);
                    document.dispatchEvent(event);
                } else {
                    console.error(`Placeholder element with ID '${placeholderId}' not found.`);
                }
            })
            .catch(error => {
                console.error(`Error loading component ${url}:`, error);
                const placeholder = document.getElementById(placeholderId);
                if (placeholder) {
                    placeholder.innerHTML = `<p style="color:red;">Error loading ${placeholderId}.</p>`;
                }
            });
    }

    loadHTMLComponent('../footer/footer.html', 'footer-placeholder');


    // --- Profile Editing and UI Logic ---
    const editBioButton = document.getElementById('edit-bio-btn');
    const saveButton = document.getElementById('save-details-btn');
    const detailsGrid = document.getElementById('details-grid');
    // ... (rest of your editing, save, toggle, and delete logic is fine here) ...

    editBioButton.addEventListener('click', () => {
        const fields = detailsGrid.querySelectorAll('.detail-value');

        fields.forEach(field => {
            // Note: You should handle read-only fields like Reg. Number and Mail differently
            if (field.id === 'user-reg-num' || field.id === 'user-mail') return;
            
            const currentValue = field.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue;
            input.className = 'detail-value-input';
            input.id = field.id;

            field.parentNode.replaceChild(input, field);
        });

        saveButton.style.display = 'block';
        editBioButton.style.display = 'none';
    });

    saveButton.addEventListener('click', () => {
        const inputs = detailsGrid.querySelectorAll('.detail-value-input');
        const newData = {};

        inputs.forEach(input => {
            const newValue = input.value;
            const span = document.createElement('span');
            span.textContent = newValue;
            span.className = 'detail-value';
            span.id = input.id;

            newData[input.id] = newValue;

            input.parentNode.replaceChild(span, input);
        });

        saveButton.style.display = 'none';
        editBioButton.style.display = 'block';

        console.log('Saving new data to backend:', newData);
        alert('Profile Updated!');

        if (newData['user-name']) {
            document.getElementById('user-name-main').textContent = newData['user-name'];
        }
        
        // TODO: ADD FIRESTORE UPDATE LOGIC HERE using auth.currentUser.uid and newData
    });

    const mailToggle = document.getElementById('mail-notifications-toggle');
    mailToggle.addEventListener('change', () => {
        console.log(`Mail notifications turned ${mailToggle.checked ? 'ON' : 'OFF'}`);
    });


    const deleteButton = document.getElementById('delete-account-btn');
    const modalOverlay = document.getElementById('delete-modal-overlay');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    deleteButton.addEventListener('click', () => {
        modalOverlay.classList.add('visible');
    });

    cancelDeleteBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('visible');
        console.log('Account deletion cancelled.');
    });

    confirmDeleteBtn.addEventListener('click', () => {
        console.log('Deleting account...');
        modalOverlay.classList.remove('visible');
        alert('Account deletion initiated.');
        // TODO: ADD FIRESTORE/AUTH ACCOUNT DELETION LOGIC HERE
    });

    const editProfileButton = document.getElementById('edit-profile-btn');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const userAvatarImg = document.getElementById('user-avatar');

    editProfileButton.addEventListener('click', () => {
        avatarUploadInput.click();
    });

    avatarUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
                userAvatarImg.src = e.target.result;
                console.log('New avatar selected:', file.name);
                // TODO: ADD FIRESTORE STORAGE UPLOAD LOGIC HERE
            };

            reader.readAsDataURL(file);
        }
        avatarUploadInput.value = null;
    });
    
});

// ----------------------------------------------------------------------
// 💡 FIX: NAVBAR DROPDOWN AUTH LOGIC
// ----------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
    // This is the CRITICAL block: run the dropdown logic only after the navbar is inserted.
    document.addEventListener("navbarLoaded", function () {
        
        // --- Selectors for Header/Dropdown UI ---
        const profileBtn = document.getElementById("profileBtn");
        const profileMenu = document.getElementById("profileMenu");
        const profileName = document.querySelector("#profileMenu .user-info strong");
        const profileEmail = document.querySelector("#profileMenu .user-info span");
        const loginLinksContainer = document.querySelector(".nav-auth");
        const signOutLink = document.querySelector('#profileMenu a[href="index.html"]'); 
        
        // --- INSTANT UI UPDATE FROM LOCALSTORAGE ---
        const cachedAuthState = localStorage.getItem('campusHubAuthState');
        const cachedUserData = localStorage.getItem('campusHubUserData');
        
        if (cachedAuthState === 'loggedIn' && cachedUserData) {
            if (loginLinksContainer) {
                loginLinksContainer.classList.remove("show");
                loginLinksContainer.style.display = "none";
            }
            if (profileBtn) profileBtn.style.display = "inline-flex";
            
            try {
                const userData = JSON.parse(cachedUserData);
                if (profileName) profileName.textContent = userData.name || "Student";
                if (profileEmail) profileEmail.textContent = userData.email || "Loading...";
            } catch (e) {
                console.error("Error parsing cached user data:", e);
            }
        } else if (cachedAuthState === 'loggedOut') {
            if (loginLinksContainer) loginLinksContainer.classList.add("show");
            if (profileBtn) profileBtn.style.display = "none";
        }
        
        // --- 1. Firebase Auth State Observer for NAVBAR ---
        // This keeps the navbar profile status updated globally.
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Logged in: Hide login/signup and show profile button
                if (loginLinksContainer) {
                    loginLinksContainer.classList.remove("show");
                    loginLinksContainer.style.display = "none";
                }
                if (profileBtn) profileBtn.style.display = "inline-flex";

                // Fetch data for the dropdown user info
                const userData = await fetchRealUserData(user); 

                if (userData) {
                    if (profileName) profileName.textContent = userData.name || "Student";
                    if (profileEmail) profileEmail.textContent = userData.email || user.email;
                    
                    // Save to localStorage
                    localStorage.setItem('campusHubAuthState', 'loggedIn');
                    localStorage.setItem('campusHubUserData', JSON.stringify({
                        name: userData.name || "Student",
                        email: userData.email || user.email
                    }));
                } else {
                    // Fallback to Firebase Auth object
                    if (profileName) profileName.textContent = user.email.split('@')[0];
                    if (profileEmail) profileEmail.textContent = user.email;
                    
                    // Save to localStorage
                    localStorage.setItem('campusHubAuthState', 'loggedIn');
                    localStorage.setItem('campusHubUserData', JSON.stringify({
                        name: user.email.split('@')[0],
                        email: user.email
                    }));
                }

            } else {
                // Not logged in: Show login/signup and hide profile button
                if (loginLinksContainer) loginLinksContainer.classList.add("show");
                if (profileBtn) profileBtn.style.display = "none";
                if (profileMenu && profileMenu.classList.contains("show")) {
                    profileMenu.classList.remove("show");
                }
                
                // Clear localStorage
                localStorage.setItem('campusHubAuthState', 'loggedOut');
                localStorage.removeItem('campusHubUserData');
            }
        });
        
        // --- 2. Sign Out Listener for NAVBAR ---
        if (signOutLink) {
            signOutLink.addEventListener("click", async (e) => {
                e.preventDefault();
                try {
                    await signOut(auth);
                    // Redirect to the food ordering homepage after sign out
                    window.location.href = "/Outlet-Website- Food Homepage/HomePage.html";
                } catch (err) {
                    console.error("Sign Out Error:", err);
                }
            });
        }
        
        // --- 3. Profile Menu Toggle Logic (Your Original Code) ---
        if (profileBtn && profileMenu) {
            profileBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                profileMenu.classList.toggle("show");
            });
        }

        window.addEventListener("click", function (event) {
            if (profileMenu && profileMenu.classList.contains("show")) {
                if (!profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
                    profileMenu.classList.remove("show");
                }
            }
        });
        
        // --- 4. Header Search Redirect ---
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