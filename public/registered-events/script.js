// Registered Events Page Script

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
// 💡 Added 'signOut' for the navbar logout functionality
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"; 
// 💡 Added 'doc' and 'getDoc' to fetch user name/email for the navbar dropdown
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBvIrk1TWKjOumhNJFeMafBry8151eB3Gw",
  authDomain: "campushub-muj2.firebaseapp.com",
  projectId: "campushub-muj2",
  storageBucket: "campushub-muj2.firebasestorage.app",
  messagingSenderId: "1041313599870",
  appId: "1:1041313599870:web:039738bd5602fbf643e32f",
  measurementId: "G-QSSJ1KVLMK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const eventsContainer = document.querySelector('.events-container');

// --- Helper Functions for User Data (Copied from Profile page for consistency) ---

async function fetchRealUserData(user) {
    if (!user) return null;
    const userRef = doc(db, "users", user.uid);
    try {
        const docSnap = await getDoc(userRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
        return null;
    }
}

// ✅ Fetch registered events for the logged-in user
onAuthStateChanged(auth, user => {
  if (user) {
    displayRegisteredEvents(user.uid);
  } else {
    // Redirect non-logged-in users from this restricted page
    window.location.href = '../login-pages/welcomelogin.html'; 
  }
});

async function fetchRegisteredEvents(userId) {
  try {
    const registeredEventsCollection = collection(db, `users/${userId}/registeredEvents`);
    const snapshot = await getDocs(registeredEventsCollection);

    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      // Use eventId from data if available, otherwise use document ID
      const eventId = data.eventId || data.id || doc.id;
      return {
        id: eventId,
        ...data,
        startDate: data.startDate?.toDate ? data.startDate.toDate() : null,
        registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : null,
        registrationDate: data.registrationDate?.toDate ? data.registrationDate.toDate() : null,
      };
    });

    return events;
  } catch (error) {
    console.error("Error fetching registered events:", error);
    return [];
  }
}
// ✅ Create event card
function createEventCard(event) {
  const card = document.createElement('div');
  card.classList.add('event-card');

  const eventDate = event.startDate
    ? event.startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : "Date TBA";
  const eventTime = event.startDate
    ? event.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : "Time TBA";
  const eventLocation = event.venue || "Location TBA";

  card.innerHTML = `
    <img src="${event.bannerImage || 'https://via.placeholder.com/300x150'}" alt="${event.title}" class="event-banner">
    <div class="event-info">
      <h3 class="event-name">${event.title}</h3>
      <div class="event-meta"><i class="ri-calendar-line"></i><span>${eventDate}</span></div>
      <div class="event-meta"><i class="ri-time-line"></i><span>${eventTime}</span></div>
      <div class="event-meta"><i class="ri-map-pin-line"></i><span>${eventLocation}</span></div>
    </div>
    <div class="event-actions">
      <button class="btn view-qr">View QR</button>
      <button class="btn view-details">View Event Details</button>
    </div>
  `;

  // Event button listeners
  const qrButton = card.querySelector('.view-qr');
  if (qrButton) {
    qrButton.addEventListener('click', () => showQrCode(event));
  }

  const detailsButton = card.querySelector('.view-details');
  if (detailsButton) {
    detailsButton.addEventListener('click', () => viewEventDetails(event.id, event.qrCode));
  }

  return card;
}


// ✅ Display all registered events
async function displayRegisteredEvents(userId) {
  eventsContainer.innerHTML = '';
  const events = await fetchRegisteredEvents(userId);

  if (events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="no-events-message">
        <p>You have not registered for any events yet. To register for events, visit the events page.</p>
        <a href="../events-page/index.html" class="btn">Go to Events</a>
      </div>
    `;
    return;
  }

  events.forEach(event => {
    const card = createEventCard(event);
    eventsContainer.appendChild(card);
  });
}

// ✅ Show stored QR code from Firestore
function showQrCode(event) {
  if (!event.qrCode) {
    alert("No QR code found for this event.");
    return;
  }

  const modalOverlay = document.createElement('div');
  modalOverlay.classList.add('modal-overlay');

  modalOverlay.innerHTML = `
    <div class="modal-content">
      <h2>Scan for Event Entry</h2>
      <img src="${event.qrCode}" alt="Event QR Code" class="qr-large">
      <p>Show this QR code at the event for check-in.</p>
      <button class="close-modal">Close</button>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Close button
  modalOverlay.querySelector('.close-modal').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });

  // Click outside to close
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      document.body.removeChild(modalOverlay);
    }
  });
}

// Modal elements
const modal = document.getElementById('event-modal');
const closeButton = document.querySelector('.close-button');

// Modal functions
function openModal(eventData) {
  if (!modal) return;
  populateModal(eventData);
  modal.classList.add('modal-open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
}

function populateModal(event) {
  if (!modal || !event) {
    console.error("populateModal failed: Modal or event data missing.");
    return;
  }
  
  try {
    modal.querySelector('.modal-banner').src = event.bannerImage || 'https://via.placeholder.com/800x400';
    modal.querySelector('.modal-banner').alt = event.title || 'Event Banner';
    modal.querySelector('.modal-event-name').textContent = event.title || 'Event Details';
    modal.querySelector('.modal-organizer').textContent = `Organized by: ${event.clubName || "N/A"}`;
    
    // Date & Time Formatting
    const startDate = event.startDate;
    const endDate = event.endDate;
    let dateTimeString = "Date & Time TBA";
    
    if (startDate instanceof Date && endDate instanceof Date) {
      dateTimeString = `${startDate.toLocaleString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      })} – ${endDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      })}`;
    } else if (startDate instanceof Date) {
      dateTimeString = startDate.toLocaleString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    }
    modal.querySelector('.modal-date-time').textContent = dateTimeString;
    
    // Basic Event Info
    modal.querySelector('.modal-location').textContent = event.venue || "Location TBA";
    modal.querySelector('.modal-fee-prize').textContent = `Fee: ₹${event.entryFee || 0} / Prize: ₹${event.prizePool || 0}`;
    modal.querySelector('.modal-team-size').textContent = event.teamSize || "N/A";
    modal.querySelector('.modal-mode').textContent = event.mode || "N/A";
    
    // Registration Deadline
    const deadline = event.registrationDeadline;
    modal.querySelector('.modal-deadline').textContent = deadline instanceof Date
      ? deadline.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : "Deadline TBA";
    
    // Eligibility & Registration Link
    modal.querySelector('.modal-eligibility').textContent = event.eligibility || "N/A";
    const regLink = modal.querySelector('.modal-reg-link');
    regLink.href = event.registrationLink || "#";
    regLink.textContent = event.registrationLink ? 'Register Now' : 'Registration Closed/NA';
    
    // Description
    modal.querySelector('.modal-description').textContent = event.description || "No description available.";
    
    // Highlights
    const highlightsContainer = modal.querySelector('.highlights-container');
    highlightsContainer.innerHTML = '';
    if (event.highlights && Array.isArray(event.highlights)) {
      event.highlights.forEach(h => {
        if (typeof h === 'string' && h.trim()) {
          const badge = document.createElement('span');
          badge.className = 'highlight-badge';
          badge.textContent = h;
          highlightsContainer.appendChild(badge);
        }
      });
    }
    
    // View QR Button in modal footer
    const modalQrBtn = modal.querySelector('.modal-view-qr-btn');
    modalQrBtn.onclick = () => {
      closeModal();
      showQrCode(event);
    };
    
  } catch (error) {
    console.error("Error populating modal:", error);
  }
}

async function viewEventDetails(eventId, qrCode) {
  console.log("Viewing details for event:", eventId);
  
  try {
    // Handle composite ID format (userId_eventId) - extract just the eventId
    let actualEventId = eventId;
    if (eventId.includes('_')) {
      const parts = eventId.split('_');
      actualEventId = parts[parts.length - 1]; // Get the last part (eventId)
      console.log("Extracted eventId from composite:", actualEventId);
    }
    
    // Fetch full event details from main events collection
    const eventRef = doc(db, 'events', actualEventId);
    const eventSnap = await getDoc(eventRef);
    
    if (eventSnap.exists()) {
      const eventData = eventSnap.data();
      // Convert Firestore timestamps to Date objects
      const event = {
        id: eventSnap.id,
        ...eventData,
        qrCode: qrCode, // Add QR code from registered event
        startDate: eventData.startDate?.toDate ? eventData.startDate.toDate() : null,
        endDate: eventData.endDate?.toDate ? eventData.endDate.toDate() : null,
        registrationDeadline: eventData.registrationDeadline?.toDate ? eventData.registrationDeadline.toDate() : null,
      };
      openModal(event);
    } else {
      console.error("Event not found with ID:", actualEventId);
      alert("Event details not found. The event may have been removed.");
    }
  } catch (error) {
    console.error("Error fetching event details:", error);
    alert("Failed to load event details. Please try again.");
  }
}

// Close modal event listeners
if (closeButton) {
  closeButton.addEventListener('click', closeModal);
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}


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

        window.addEventListener("click", function (event) {
            if (profileMenu.classList.contains("show")) {
                if (!profileBtn.contains(event.target) && !profileMenu.contains(event.target)) {
                    profileMenu.classList.remove("show");
                }
            }
        });
    }
    
    // --- 4. Header Search Redirect (If applicable) ---
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