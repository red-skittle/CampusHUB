// import { auth, db } from './js/firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvIrk1TWKjOumhNJFeMafBry8151eB3Gw",
  authDomain: "campushub-muj2.firebaseapp.com",
  projectId: "campushub-muj2",
  storageBucket: "campushub-muj2.firebasestorage.app",
  messagingSenderId: "1041313599870",
  appId: "1:1041313599870:web:039738bd5602fbf643e32f",
  measurementId: "G-QSSJ1KVLMK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
  const profileDropdown = document.querySelector(".profile-dropdown");
  const profileName = document.querySelector(".user-info strong");
  const profileEmail = document.querySelector(".user-info span");
  const loginLinksContainer = document.querySelector(".nav-auth");
  const signOutLink = document.querySelector('.dropdown-menu a[href="index.html"]');
  const manageEventsLink = document.getElementById("manage-events-link");

  // --- INSTANT UI UPDATE FROM LOCALSTORAGE ---
  const cachedAuthState = localStorage.getItem('campusHubAuthState');
  const cachedUserData = localStorage.getItem('campusHubUserData');

  if (cachedAuthState === 'loggedIn' && cachedUserData) {
    // Show profile button immediately
    if (loginLinksContainer) {
      loginLinksContainer.classList.remove('show');
      loginLinksContainer.style.display = 'none';
    }
    if (profileDropdown) profileDropdown.style.display = 'inline-block';

    // Load cached user data
    try {
      const userData = JSON.parse(cachedUserData);
      if (profileName) profileName.textContent = userData.name || "Student";
      if (profileEmail) profileEmail.textContent = userData.email || "Loading...";
    } catch (e) {
      console.error("Error parsing cached user data:", e);
    }
  } else if (cachedAuthState === 'loggedOut') {
    // Show login/signup immediately
    if (loginLinksContainer) loginLinksContainer.classList.add('show');
    if (profileDropdown) profileDropdown.style.display = 'none';
  }

  // Auth state observer
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Hide login/signup links
      if (loginLinksContainer) {
        loginLinksContainer.classList.remove("show");
        loginLinksContainer.style.display = "none";
      }

      // Show profile dropdown
      profileDropdown.style.display = "inline-block";

      try {
        // Get user document from Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        let userData;
        if (userSnap.exists()) {
          userData = userSnap.data();
          profileName.textContent = userData.name || "Student";
          profileEmail.textContent = userData.email || user.email;

          if (userData.isAdmin) {
            manageEventsLink.style.display = "block";
          }

        } else {
          // Fallback if no document exists
          userData = {
            name: user.email.split('@')[0],
            email: user.email
          };
          profileName.textContent = userData.name;
          profileEmail.textContent = userData.email;
        }

        // Save to localStorage
        localStorage.setItem('campusHubAuthState', 'loggedIn');
        localStorage.setItem('campusHubUserData', JSON.stringify({
          name: userData.name || user.email.split('@')[0],
          email: userData.email || user.email
        }));

      } catch (err) {
        console.error("Error fetching user data:", err);
        // Still save basic auth state
        localStorage.setItem('campusHubAuthState', 'loggedIn');
        localStorage.setItem('campusHubUserData', JSON.stringify({
          name: user.email.split('@')[0],
          email: user.email
        }));
      }

    } else {
      // Not logged in
      if (loginLinksContainer) loginLinksContainer.classList.add("show");
      profileDropdown.style.display = "none";

      // Clear localStorage
      localStorage.setItem('campusHubAuthState', 'loggedOut');
      localStorage.removeItem('campusHubUserData');
    }
  });

  // Sign out
  signOutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      location.reload();
    } catch (err) {
      console.error(err);
    }
  });
});

// Wait for the page to load
document.addEventListener("DOMContentLoaded", function () {

  // --- Configuration ---
  const headlineElement = document.getElementById("typing-headline");

  // Check if the element actually exists on this page
  if (!headlineElement) {
    // If you see this error, the ID is wrong in your HTML
    console.error("Error: Could not find element with id 'typing-headline'");
    return;
  }

  // This line clears any accidental whitespace or text
  headlineElement.textContent = "";

  const lines = [
    "Simplify your campus life",
    "everything you need, all in one place."
  ];
  const typingSpeed = 40; // Milliseconds per character
  const linePause = 400;  // Milliseconds to pause between lines
  // --- End Configuration ---


  // Create the cursor element
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  headlineElement.appendChild(cursor);

  let lineIndex = 0;
  let charIndex = 0;

  function type() {
    if (lineIndex >= lines.length) {
      // All lines are typed, make cursor stop blinking
      cursor.style.display = "none";
      return;
    }

    const currentLine = lines[lineIndex];

    if (charIndex < currentLine.length) {
      // Insert the next character *before* the cursor
      cursor.insertAdjacentText('beforebegin', currentLine.charAt(charIndex));
      charIndex++;
      setTimeout(type, typingSpeed);
    } else {
      // This line is finished
      lineIndex++;
      charIndex = 0;

      // If there's another line, add a <br> and pause
      if (lineIndex < lines.length) {
        headlineElement.insertBefore(document.createElement("br"), cursor);
        setTimeout(type, linePause);
      } else {
        // This was the last line
        type(); // Call again to trigger the "stop" condition
      }
    }
  }

  // Start the animation
  type();
});

async function fetchEvents() {
  try {
    const eventsCollection = collection(db, 'events');
    const eventsSnapshot = await getDocs(eventsCollection);
    return eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate ? data.startDate.toDate() : null,
      };
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

function createEventCard(event) {
  const card = document.createElement('div');
  card.classList.add('event-card');
  card.style.cursor = 'pointer';

  const eventDate = event.startDate ? event.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "Date TBA";

  card.innerHTML = `
        <img src="${event.bannerImage || 'https://via.placeholder.com/300x150'}" alt="${event.title}">
        <div class="event-details">
            <p class="event-date">${eventDate}</p>
            <h3 class="event-title">${event.title}</h3>
            <p class="event-description">${event.description || 'No description available.'}</p>
        </div>
    `;

  // Make card clickable - redirect to events page with event ID
  card.addEventListener('click', () => {
    window.location.href = `./events-page/index.html?eventId=${event.id}`;
  });

  return card;
}

document.addEventListener('DOMContentLoaded', async () => {
  const eventsContainer = document.querySelector('.events-container');
  const scrollLeftButton = document.querySelector('.scroll-left');
  const scrollRightButton = document.querySelector('.scroll-right');
  const eventsCarousel = document.querySelector('.events-carousel');

  const events = await fetchEvents();

  if (events.length > 0) {
    events.forEach(event => {
      const card = createEventCard(event);
      eventsContainer.appendChild(card);
    });
  } else {
    eventsContainer.innerHTML = '<p>No upcoming events found.</p>';
  }


  let scrollSpeed = 1; // pixels per frame (adjust for speed)
  let isPaused = false;

  // Clone child elements for infinite loop
  const cards = Array.from(eventsContainer.children);
  cards.forEach((card, index) => {
    const clone = card.cloneNode(true);
    // Re-attach click event to cloned card
    const originalEvent = events[index];
    if (originalEvent) {
      clone.style.cursor = 'pointer';
      clone.addEventListener('click', () => {
        window.location.href = `./events-page/index.html?eventId=${originalEvent.id}`;
      });
    }
    eventsContainer.appendChild(clone);
  });

  // Smooth auto-scroll loop
  function smoothScroll() {
    if (!isPaused) {
      eventsContainer.scrollLeft += scrollSpeed;
      if (eventsContainer.scrollLeft >= eventsContainer.scrollWidth / 2) {
        eventsContainer.scrollLeft = 0; // reset when half scrolled
      }
    }
    requestAnimationFrame(smoothScroll);
  }

  // Manual scroll buttons
  scrollLeftButton.addEventListener('click', () => {
    eventsContainer.scrollLeft -= 300;
  });

  scrollRightButton.addEventListener('click', () => {
    eventsContainer.scrollLeft += 300;
  });

  // Pause on hover
  eventsCarousel.addEventListener('mouseenter', () => isPaused = true);
  eventsCarousel.addEventListener('mouseleave', () => isPaused = false);

  smoothScroll(); // start the animation
});


document.addEventListener("DOMContentLoaded", function () {

  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");


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

});



// ========================
// WISHLIST/SAVED EVENTS FUNCTIONALITY
// ========================

import { displaySavedEvents } from "./shared/wishlist-logic.js";

// Wishlist sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function () {
  const wishlistTrigger = document.getElementById('wishlist-trigger');
  const wishlistContainer = document.getElementById('wishlist-container');
  const closeButton = document.getElementById('close-wishlist');

  if (wishlistTrigger && wishlistContainer) {
    wishlistTrigger.addEventListener('click', async function (event) {
      event.preventDefault();

      // When showing, add 'show' class and load events
      wishlistContainer.classList.add('show');

      // Load saved events when sidebar opens
      await displaySavedEvents(auth, db);
    });
  }

  if (closeButton && wishlistContainer) {
    closeButton.addEventListener('click', function () {
      // When hiding, remove 'show' class
      wishlistContainer.classList.remove('show');
    });
  }

  // Close when clicking outside the wishlist container
  document.addEventListener('click', function (event) {
    if (wishlistContainer && wishlistContainer.classList.contains('show') &&
      !wishlistContainer.contains(event.target) &&
      !wishlistTrigger.contains(event.target)) {
      wishlistContainer.classList.remove('show');
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {

  // Find the new icon and the search bar form
  const mobileSearchTrigger = document.getElementById('mobile-search-trigger');
  const searchBarForm = document.getElementById('header-search-form');

  if (mobileSearchTrigger && searchBarForm) {
    // Add click listener to the icon
    mobileSearchTrigger.addEventListener('click', function (event) {
      event.preventDefault(); // Stop the '#' link from jumping

      // This adds/removes the "mobile-active" class
      searchBarForm.classList.toggle('mobile-active');
    });
  }

  // OPTIONAL (but recommended): Close search bar when clicking outside of it
  document.addEventListener('click', function (event) {
    // Check if the search bar is active AND if the click was
    // NOT on the search bar itself AND NOT on the trigger icon
    if (searchBarForm.classList.contains('mobile-active') &&
      !searchBarForm.contains(event.target) &&
      !mobileSearchTrigger.contains(event.target)) {

      searchBarForm.classList.remove('mobile-active');
    }
  });

});