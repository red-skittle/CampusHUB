
import { collection, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ========================
// WISHLIST/SAVED EVENTS FUNCTIONALITY
// ========================

// Function to fetch saved events from Firestore
export async function fetchSavedEvents(auth, db) {
    const user = auth.currentUser;

    if (!user) {
        console.log("No user logged in");
        return [];
    }

    try {
        const savedEventsRef = collection(db, `users/${user.uid}/savedEvents`);
        const savedEventsSnapshot = await getDocs(savedEventsRef);

        return savedEventsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startDate: data.startDate ? data.startDate.toDate() : null,
                endDate: data.endDate ? data.endDate.toDate() : null,
                registrationDeadline: data.registrationDeadline ? data.registrationDeadline.toDate() : null,
            };
        });
    } catch (error) {
        console.error("Error fetching saved events:", error);
        return [];
    }
}

// Function to remove event from saved events
export async function removeSavedEvent(auth, db, eventId) {
    const user = auth.currentUser;

    if (!user) {
        alert("Please login to manage saved events.");
        return false;
    }

    try {
        const savedEventRef = doc(db, `users/${user.uid}/savedEvents`, eventId);
        await deleteDoc(savedEventRef);
        console.log("Event removed from saved events");
        return true;
    } catch (error) {
        console.error("Error removing saved event:", error);
        alert("Failed to remove event. Please try again.");
        return false;
    }
}

// Function to create a saved event card for the wishlist sidebar
export function createSavedEventCard(event) {
    const card = document.createElement('div');
    card.classList.add('saved-event-card');
    card.dataset.eventId = event.id;

    const eventDate = event.startDate
        ? event.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : "Date TBA";

    // Determine correct path to events page based on current location
    // If we are deep in structure, we might need absolute path.
    // Assuming the site structure is consistent:
    const eventsPagePath = "/events-page/index.html";

    card.innerHTML = `
    <div class="saved-event-image">
      <img src="${event.bannerImage || 'https://via.placeholder.com/150x100'}" alt="${event.title || 'Event'}">
    </div>
    <div class="saved-event-info">
      <h4>${event.title || 'Untitled Event'}</h4>
      <p class="saved-event-club">${event.clubName || 'N/A'}</p>
      <p class="saved-event-date">
        <i class="fas fa-calendar"></i> ${eventDate}
      </p>
      <p class="saved-event-venue">
        <i class="fas fa-map-marker-alt"></i> ${event.venue || 'TBA'}
      </p>
    </div>
    <div class="saved-event-actions">
      <button class="remove-saved-btn" data-event-id="${event.id}" title="Remove from saved">
        <i class="fas fa-trash"></i>
      </button>
      <a href="${eventsPagePath}?eventId=${event.id}" class="view-event-btn" title="View event details">
        <i class="fas fa-arrow-right"></i>
      </a>
    </div>
  `;

    return card;
}

// Function to display saved events in the wishlist container
export async function displaySavedEvents(auth, db) {
    const wishlistContainer = document.getElementById('wishlist-container');
    if (!wishlistContainer) {
        console.warn("Wishlist container not found in DOM");
        return;
    }


    // Find or create the events list container
    let eventsListContainer = wishlistContainer.querySelector('.saved-events-list');
    if (!eventsListContainer) {
        eventsListContainer = document.createElement('div');
        eventsListContainer.classList.add('saved-events-list');
        wishlistContainer.appendChild(eventsListContainer);
    }

    // Show loading state
    eventsListContainer.innerHTML = '<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Loading saved events...</p>';

    const user = auth.currentUser;

    if (!user) {
        eventsListContainer.innerHTML = `
      <div class="empty-wishlist">
        <i class="fas fa-heart"></i>
        <p>Please login to view your saved events</p>
        <a href="/login-pages/welcomelogin.html" class="login-btn">Login</a>
      </div>
    `;
        return;
    }

    const savedEvents = await fetchSavedEvents(auth, db);

    if (savedEvents.length === 0) {
        eventsListContainer.innerHTML = `
      <div class="empty-wishlist">
        <i class="fas fa-heart-broken"></i>
        <p>No saved events yet</p>
        <p class="small-text">Browse events and save your favorites!</p>
        <a href="/events-page/index.html" class="browse-btn">Browse Events</a>
      </div>
    `;
        return;
    }

    // Clear and display saved events
    eventsListContainer.innerHTML = '';
    savedEvents.forEach(event => {
        const card = createSavedEventCard(event);
        eventsListContainer.appendChild(card);
    });

    // Add event listeners to remove buttons
    const removeButtons = eventsListContainer.querySelectorAll('.remove-saved-btn');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventId = btn.dataset.eventId;

            if (confirm('Remove this event from saved events?')) {
                const removed = await removeSavedEvent(auth, db, eventId);
                if (removed) {
                    // Remove the card from the UI
                    const card = btn.closest('.saved-event-card');
                    card.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => {
                        card.remove();
                        // Check if there are no more events
                        if (eventsListContainer.children.length === 0) {
                            displaySavedEvents(auth, db); // Refresh to show empty state
                        }
                    }, 300);
                }
            }
        });
    });
}

// Function to attach listener to trigger
export function initWishlist(auth, db) {
    // We delegate the click to document or wait for navbar to load
    // But simplest is to just expose a function to call when trigger is clicked
    // Or attach to the trigger if it exists.

    // Actually, allowing manual call is best. But we can also try to attach.

    const attach = () => {
        const trigger = document.getElementById('wishlist-trigger');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.preventDefault(); // allow nav.js to handle the .show toggle
                displaySavedEvents(auth, db);
            });
        }
    };

    // If navbar is already there (landing page)
    if (document.getElementById('wishlist-trigger')) {
        attach();
    } else {
        // Wait for navbarLoaded event (events page)
        document.addEventListener('navbarLoaded', attach);
    }
}
