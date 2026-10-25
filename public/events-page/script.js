// Events Page Script with Advanced Filtering AND Local Search Handling

import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { initWishlist } from "../shared/wishlist-logic.js";
// Global variables
let allEvents = [];
let filteredEvents = [];
let currentFilters = {
    status: '', // Start showing all
    club: '',
    mode: '',
    fee: '',
    dateFrom: '',
    dateTo: '',
    searchTerm: '' // Search term state
};
let sortAscending = true;

const eventsContainer = document.querySelector('.events-container');
const modal = document.getElementById('event-modal');

// --- Function to check URL for search query on load ---
/**
 * Checks the URL for a 'search' query parameter when the page loads.
 * If found, updates filters and attempts to update the search bar input value.
 */
function checkForURLSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    console.log("Events page: Checking URL for search query. Found:", searchQuery);
    if (searchQuery) {
        currentFilters.searchTerm = searchQuery;
        // Update input value after navbar loads (if dynamic) or immediately (if static)
        const updateInput = () => {
            const searchInput = document.getElementById('header-search-input');
            if (searchInput) {
                searchInput.value = searchQuery;
                console.log("Events page: Updated search input from URL.");
            } else {
                console.warn("Events page: Search input not found when trying to update from URL.");
            }
        };
        if (document.getElementById('navbar-placeholder')) { // Checks if navbar is loaded dynamically
            document.addEventListener('navbarLoaded', updateInput, { once: true });
        } else { // Assumes navbar HTML is static in this page
            updateInput();
        }
    }
}

// --- Function to check URL for eventId and open modal ---
/**
 * Checks the URL for an 'eventId' query parameter when the page loads.
 * If found, automatically opens the event modal for that event.
 */
async function checkForURLEventId() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    console.log("Events page: Checking URL for eventId. Found:", eventId);

    if (eventId) {
        // Wait a bit for events to load
        setTimeout(async () => {
            // Find the event in allEvents array
            const event = allEvents.find(e => e.id === eventId);

            if (event) {
                console.log("Events page: Opening modal for event:", event.title);
                openModal(event);
            } else {
                // If not found in filtered list, try fetching directly from Firestore
                console.log("Events page: Event not in list, fetching from Firestore...");
                try {
                    const eventRef = doc(db, 'events', eventId);
                    const eventSnap = await getDoc(eventRef);

                    if (eventSnap.exists()) {
                        const eventData = eventSnap.data();
                        const event = {
                            id: eventSnap.id,
                            ...eventData,
                            startDate: eventData.startDate?.toDate ? eventData.startDate.toDate() : null,
                            endDate: eventData.endDate?.toDate ? eventData.endDate.toDate() : null,
                            registrationDeadline: eventData.registrationDeadline?.toDate ? eventData.registrationDeadline.toDate() : null,
                        };
                        openModal(event);
                    } else {
                        console.warn("Events page: Event not found with ID:", eventId);
                    }
                } catch (error) {
                    console.error("Events page: Error fetching event:", error);
                }
            }
        }, 500); // Wait 500ms for events to load
    }
}


// --- Wishlist/Save Event Functions ---
async function toggleSaveEvent(eventId) {
    const user = auth.currentUser;

    // Check if user is logged in
    if (!user) {
        alert("Please login first to save events.");
        window.location.href = '../login-pages/welcomelogin.html';
        return;
    }

    try {
        const savedEventRef = doc(db, `users/${user.uid}/savedEvents`, eventId);
        const savedEventSnap = await getDoc(savedEventRef);

        if (savedEventSnap.exists()) {
            // Event is already saved, remove it
            await deleteDoc(savedEventRef);
            console.log("Event removed from saved events");
            return false; // Return false to indicate unsaved
        } else {
            // Save the event
            const event = allEvents.find(e => e.id === eventId);
            if (!event) {
                console.error("Event not found in allEvents array");
                return;
            }

            // Prepare event data for Firestore (convert Dates to Timestamps)
            const eventDataForFirestore = { ...event };
            for (const key of ['startDate', 'endDate', 'registrationDeadline', 'createdAt', 'updatedAt']) {
                if (eventDataForFirestore[key] instanceof Date) {
                    eventDataForFirestore[key] = Timestamp.fromDate(eventDataForFirestore[key]);
                } else {
                    delete eventDataForFirestore[key];
                }
            }
            eventDataForFirestore.savedAt = Timestamp.now();

            await setDoc(savedEventRef, eventDataForFirestore);
            console.log("Event saved successfully");
            return true; // Return true to indicate saved
        }
    } catch (error) {
        console.error("Error toggling save event:", error);
        alert("Failed to save event. Please try again.");
    }
}

async function checkIfEventSaved(eventId) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const savedEventRef = doc(db, `users/${user.uid}/savedEvents`, eventId);
        const savedEventSnap = await getDoc(savedEventRef);
        return savedEventSnap.exists();
    } catch (error) {
        console.error("Error checking if event is saved:", error);
        return false;
    }
}
// --- Function to Setup Search Submit Listener (Specific to Events Page) ---
/**
 * Finds the search form and adds a submit event listener
 * specifically for when the user searches *on* the events page.
 */


function setupLocalSearchSubmit() {
    const searchForm = document.getElementById('header-search-form');
    const searchInput = document.getElementById('header-search-input');

    if (searchForm && searchInput) {
        console.log("Events page: Setting up LOCAL search form submit listener.");
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Stop page reload
            const searchTerm = searchInput.value.trim();
            console.log("Events page: LOCAL search submitted. Term:", searchTerm);

            currentFilters.searchTerm = searchTerm; // Update filter state

            // Clear status filter visually and logically when searching
            currentFilters.status = '';
            document.querySelectorAll('.status-filter').forEach(b => b.classList.remove('active'));

            applyFilters(); // Apply all filters including the new search term
            updateActiveFilters(); // Update the display of active filter tags
        });
    } else {
        // This might happen if the navbar isn't loaded yet when this runs
        console.error("Events page: CRITICAL - Could not find search form/input to set up LOCAL submit listener!");
    }
}


// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    console.log("Events page: DOM loaded.");
    checkForURLSearchQuery(); // Check for incoming search term from redirect
    checkForURLEventId(); // Check for eventId parameter to open modal
    initializeFilters(); // Initializes UI filters (dropdowns, buttons etc.)
    fetchAndDisplayEvents(); // Fetches data and applies initial filters (including URL search term)
    initWishlist(auth, db); // <--- Initialize Wishlist Logic (Added)

    const setupNavListeners = () => {
        console.log("Events page: setupNavListeners called.");
        setupLocalSearchSubmit();       // Handles form submission

    };

    // Set up the search submit listener AFTER the navbar is potentially loaded
    if (document.getElementById('navbar-placeholder')) {
        // If navbar is loaded dynamically, wait for the 'navbarLoaded' event
        console.log("Events page: Waiting for 'navbarLoaded' to set up local search listener.");
        document.addEventListener('navbarLoaded', setupLocalSearchSubmit, { once: true });
    } else {
        // If navbar is static (part of this HTML file), set up listener now
        console.log("Events page: Assuming static navbar, setting up local search listener now.");
        setupLocalSearchSubmit();
    }
});


// --- Helper Functions ---

async function fetchEvents() {
    console.log("Events page: Fetching events from Firestore...");
    try {
        const eventsCollection = collection(db, 'events');
        const eventsSnapshot = await getDocs(eventsCollection);
        console.log(`Events page: Fetched ${eventsSnapshot.docs.length} documents.`);
        return eventsSnapshot.docs.map(doc => {
            const data = doc.data();
            const convertTimestamp = (timestamp) => {
                if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate();
                return null;
            };
            return {
                id: doc.id, ...data,
                startDate: convertTimestamp(data.startDate),
                endDate: convertTimestamp(data.endDate),
                registrationDeadline: convertTimestamp(data.registrationDeadline),
                // Add ALL fields from Firestore that you might need later
                title: data.title, clubName: data.clubName, mode: data.mode, entryFee: data.entryFee, venue: data.venue, bannerImage: data.bannerImage, description: data.description, registrationLink: data.registrationLink, prizePool: data.prizePool, teamSize: data.teamSize, eligibility: data.eligibility, highlights: data.highlights
                // createdAt: convertTimestamp(data.createdAt), updatedAt: convertTimestamp(data.updatedAt) // Add if needed
            };
        }).filter(event => event.startDate instanceof Date); // Filter out events with invalid start dates
    } catch (error) {
        console.error("Events page: Error fetching events:", error);
        if (eventsContainer) eventsContainer.innerHTML = '<p style="text-align: center; color: red;">Could not load events.</p>';
        return [];
    }
}

function initializeFilters() {
    console.log("Events page: Initializing filters UI.");
    // Status filter buttons
    const statusButtons = document.querySelectorAll('.status-filter');
    statusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const newStatus = btn.dataset.status;
            if (btn.classList.contains('active')) { // Toggle off
                btn.classList.remove('active');
                currentFilters.status = '';
            } else { // Toggle on
                statusButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilters.status = newStatus;
            }
            applyFilters();
        });
    });

    // Advanced filters toggle
    const advancedToggle = document.getElementById('advancedFilterToggle');
    const advancedFilters = document.getElementById('advancedFilters');
    if (advancedToggle && advancedFilters) { advancedToggle.addEventListener('click', () => { advancedToggle.classList.toggle('active'); advancedFilters.classList.toggle('show'); }); } else { console.warn("Advanced filter toggle/panel not found."); }

    // Advanced Filter inputs listeners
    document.getElementById('clubFilter')?.addEventListener('change', (e) => { currentFilters.club = e.target.value; updateActiveFilters(); });
    document.getElementById('modeFilter')?.addEventListener('change', (e) => { currentFilters.mode = e.target.value; updateActiveFilters(); });
    document.getElementById('feeFilter')?.addEventListener('change', (e) => { currentFilters.fee = e.target.value; updateActiveFilters(); });
    document.getElementById('dateFromFilter')?.addEventListener('change', (e) => { currentFilters.dateFrom = e.target.value; updateActiveFilters(); });
    document.getElementById('dateToFilter')?.addEventListener('change', (e) => { currentFilters.dateTo = e.target.value; updateActiveFilters(); });

    // Apply & Clear buttons for Advanced Filters
    document.getElementById('applyFilters')?.addEventListener('click', () => { console.log("Apply Filters button clicked."); applyFilters(); });
    document.getElementById('clearFilters')?.addEventListener('click', () => { console.log("Clear Filters button clicked."); clearAdvancedFilters(); });

    // Sort button
    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortAscending = !sortAscending;
            sortBtn.classList.toggle('ascending', sortAscending);
            const sortIcon = sortBtn.querySelector('i');
            if (sortIcon) sortIcon.style.transform = sortAscending ? 'rotate(180deg)' : 'rotate(0deg)';
            applyFilters();
        });
    } else { console.warn("Sort button not found."); }
}

function populateFilterOptions() {
    const clubs = [...new Set(allEvents.map(event => event.clubName).filter(Boolean))].sort();
    const clubFilter = document.getElementById('clubFilter');
    if (clubFilter) {
        clubFilter.innerHTML = '<option value="">All Clubs</option>';
        clubs.forEach(club => { const option = document.createElement('option'); option.value = club; option.textContent = club; clubFilter.appendChild(option); });
    }
}

function getEventStatus(event) {
    const now = new Date(); const start = event.startDate; const end = event.endDate;
    if (!(start instanceof Date)) return 'upcoming'; // Must be a valid date
    if (now < start) return 'upcoming';
    if (end instanceof Date) { // Check if end date is valid
        if (now >= start && now <= end) return 'ongoing';
        if (now > end) return 'past';
    } else if (now >= start) { // No valid end date, but started
        return 'ongoing';
    }
    return 'upcoming'; // Default
}

// --- Apply Filters (Includes search logic) ---
function applyFilters() {
    console.log("Events page: Applying filters...", currentFilters);
    filteredEvents = allEvents.filter(event => {
        // Status filter (ignored if searchTerm is active)
        const status = getEventStatus(event);
        if (currentFilters.status && !currentFilters.searchTerm && status !== currentFilters.status) {
            return false;
        }

        // Search term filter (checks title) - THIS IS NEEDED
        if (currentFilters.searchTerm) {
            const searchTerm = currentFilters.searchTerm.toLowerCase();
            const eventTitle = event.title ? event.title.toLowerCase() : '';
            if (!eventTitle.includes(searchTerm)) {
                return false;
            }
        }

        // Advanced Filters
        if (currentFilters.club && event.clubName !== currentFilters.club) return false;
        if (currentFilters.mode) { const mode = event.mode ? event.mode.toLowerCase() : ''; if (!mode.includes(currentFilters.mode.toLowerCase())) return false; }
        if (currentFilters.fee) { const isFree = !event.entryFee || parseFloat(event.entryFee) === 0; if (currentFilters.fee === 'free' && !isFree) return false; if (currentFilters.fee === 'paid' && isFree) return false; }
        if (currentFilters.dateFrom && event.startDate) { const filterDate = new Date(currentFilters.dateFrom); filterDate.setHours(0, 0, 0, 0); if (event.startDate < filterDate) return false; }
        if (currentFilters.dateTo && event.startDate) { const filterDate = new Date(currentFilters.dateTo); filterDate.setHours(23, 59, 59, 999); if (event.startDate > filterDate) return false; }

        return true; // Passes all active filters
    });

    // Sort the filtered results
    filteredEvents.sort((a, b) => {
        const dateA = a.startDate; const dateB = b.startDate;
        if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
        return sortAscending ? dateA - dateB : dateB - dateA;
    });

    displayEvents(); // Update the displayed cards
    updateResultsCount(); // Update the count text
    updateActiveFilters(); // Update the filter tags
    console.log(`Events page: Applied filters. Showing ${filteredEvents.length} events.`);
}

// --- (UI Update Functions: updateActiveFilters, removeFilter, clearAdvancedFilters, updateResultsCount) ---
function updateActiveFilters() {
    const activeFiltersContainer = document.getElementById('activeFilters'); if (!activeFiltersContainer) return; activeFiltersContainer.innerHTML = ''; const filterLabels = { club: 'Club', mode: 'Mode', fee: 'Fee Type', dateFrom: 'From', dateTo: 'To', searchTerm: 'Search' }; Object.keys(currentFilters).forEach(key => { if (currentFilters[key] && key !== 'status') { const tag = document.createElement('div'); tag.className = 'active-filter-tag'; let displayValue = currentFilters[key]; if (key === 'fee') displayValue = currentFilters[key] === 'free' ? 'Free Events' : 'Paid Events'; tag.innerHTML = `<span>${filterLabels[key]}: ${displayValue}</span><i class="ri-close-line" data-filter="${key}"></i>`; tag.querySelector('i')?.addEventListener('click', (e) => { removeFilter(e.target.dataset.filter); }); activeFiltersContainer.appendChild(tag); } });
}

function removeFilter(filterKey) {
    console.log("Events page: Removing filter:", filterKey);
    if (filterKey in currentFilters) { currentFilters[filterKey] = ''; }
    // Reset corresponding UI input element if applicable
    const elementMap = { club: 'clubFilter', mode: 'modeFilter', fee: 'feeFilter', dateFrom: 'dateFromFilter', dateTo: 'dateToFilter' };
    if (elementMap[filterKey]) { const element = document.getElementById(elementMap[filterKey]); if (element) element.value = ''; }
    // If removing search term, also clear the search input bar
    if (filterKey === 'searchTerm') { const searchInput = document.getElementById('header-search-input'); if (searchInput) searchInput.value = ''; }
    applyFilters(); // Re-apply filters after removing one
}

function clearAdvancedFilters() {
    console.log("Events page: Clearing advanced filters.");
    currentFilters.club = ''; currentFilters.mode = ''; currentFilters.fee = ''; currentFilters.dateFrom = ''; currentFilters.dateTo = '';
    // Reset UI elements for advanced filters
    const clubEl = document.getElementById('clubFilter'); if (clubEl) clubEl.value = '';
    const modeEl = document.getElementById('modeFilter'); if (modeEl) modeEl.value = '';
    const feeEl = document.getElementById('feeFilter'); if (feeEl) feeEl.value = '';
    const dateFromEl = document.getElementById('dateFromFilter'); if (dateFromEl) dateFromEl.value = '';
    const dateToEl = document.getElementById('dateToFilter'); if (dateToEl) dateToEl.value = '';
    applyFilters(); // Re-apply (will now only use status and potentially searchTerm)
}

function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount'); if (!resultsCount) return; const count = filteredEvents.length; resultsCount.textContent = count === 0 ? 'No events found' : `Showing ${count} event${count !== 1 ? 's' : ''}`;
}


// --- (Main Data Load and Display Functions) ---
async function fetchAndDisplayEvents() {
    if (eventsContainer) eventsContainer.innerHTML = '<p style="text-align: center; color: #94a3b8;">Loading events...</p>';
    allEvents = await fetchEvents(); // Fetch and filter invalid dates
    console.log("Events page: fetchAndDisplayEvents completed fetch. Valid events:", allEvents.length);
    if (allEvents.length > 0) {
        populateFilterOptions();
        applyFilters(); // Apply initial filters (including URL search term if present)
    } else {
        updateResultsCount();
        if (eventsContainer) eventsContainer.innerHTML = '<p style="text-align: center; color: #94a3b8;">No events available at the moment.</p>';
    }
}

function createEventCard(event) {
    if (!event || !event.id) { console.warn("Skipping card: Invalid event data", event); return null; }
    const card = document.createElement('div'); card.classList.add('event-card');
    const eventDataString = JSON.stringify(event, (key, value) => { if (value instanceof Date) return value.toISOString(); return value; }); card.dataset.event = eventDataString;
    const eventDate = event.startDate ? event.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "TBA"; const eventTime = event.startDate ? event.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ""; const status = getEventStatus(event); card.innerHTML = `<div class="poster"><img src="${event.bannerImage || 'https://via.placeholder.com/300x150'}" alt="${event.title || 'Event'}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x150';"><div class="ribbon"><span class="event-status">${status.charAt(0).toUpperCase() + status.slice(1)}</span></div></div><div class="details"><div class="club"><span class="star">Presented by</span><span>${event.clubName || "N/A"}</span></div><h3 class="title">${event.title || 'Untitled Event'}</h3><div class="bottom"><button class="venue"><i class="ri-map-pin-line"></i>${event.venue || "TBA"}</button></div><a href="${event.registrationLink || '#'}" class="book-tickets" target="_blank" rel="noopener noreferrer">Book Tickets</a><div class="bottom"><div class="date"><i class="ri-calendar-event-fill"></i><span class="event-date">${eventDate}</span></div><div class="time"><i class="ri-time-line"></i><span class="event-time">${eventTime}</span></div></div></div>`; return card;
}

function displayEvents() {
    if (!eventsContainer) return; eventsContainer.innerHTML = ''; if (filteredEvents.length === 0) { eventsContainer.innerHTML = `<div class="no-results"><i class="ri-search-line"></i><h3>No Events Found</h3><p>Try adjusting filters or search.</p></div>`; eventsContainer.classList.add('empty'); } else { eventsContainer.classList.remove('empty'); filteredEvents.forEach(event => { const card = createEventCard(event); if (card) eventsContainer.appendChild(card); }); }
}


// --- (Modal Functions: openModal, closeModal, populateModal) ---
// These should be robust versions handling potential errors and missing data
function openModal(eventData) {
    if (!modal) return; const parseEventData = (data) => { const parsed = { ...data }; for (const key of ['startDate', 'endDate', 'registrationDeadline', 'createdAt', 'updatedAt']) { if (parsed[key] && typeof parsed[key] === 'string') { const date = new Date(parsed[key]); if (!isNaN(date)) parsed[key] = date; else parsed[key] = null; } } return parsed; }; const event = parseEventData(eventData); populateModal(event); modal.classList.add('modal-open'); document.body.classList.add('modal-open');
}
function closeModal() {
    if (!modal) return; modal.classList.remove('modal-open'); document.body.classList.remove('modal-open');
}
async function populateModal(event) {
    if (!modal || !event) { console.error("populateModal failed: Modal or event data missing."); return; }
    try {
        modal.querySelector('.modal-banner').src = event.bannerImage || 'https://via.placeholder.com/800x400';
        modal.querySelector('.modal-banner').alt = event.title || 'Event Banner';
        modal.querySelector('.modal-event-name').textContent = event.title || 'Event Details';
        modal.querySelector('.modal-organizer').textContent = `Organized by: ${event.clubName || "N/A"}`;
        // --- Date & Time Formatting ---
        const startDate = event.startDate; // Should be Date object or null
        const endDate = event.endDate;     // Should be Date object or null
        let dateTimeString = "Date & Time TBA";

        // Check if both start and end dates are valid Date objects
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
        }
        // Check if only the start date is a valid Date object
        else if (startDate instanceof Date) {
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

        // --- Basic Event Info ---
        modal.querySelector('.modal-location').textContent = event.venue || "Location TBA";
        modal.querySelector('.modal-fee-prize').textContent = `Fee: ₹${event.entryFee || 0} / Prize: ₹${event.prizePool || 0}`;
        modal.querySelector('.modal-team-size').textContent = event.teamSize || "N/A";
        modal.querySelector('.modal-mode').textContent = event.mode || "N/A";

        // --- Registration Deadline ---
        const deadline = event.registrationDeadline; // Should be Date object or null
        modal.querySelector('.modal-deadline').textContent = deadline instanceof Date
            ? deadline.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
            : "Deadline TBA";

        // --- Eligibility & Registration Link ---
        modal.querySelector('.modal-eligibility').textContent = event.eligibility || "N/A";
        const regLink = modal.querySelector('.modal-reg-link');
        regLink.href = event.registrationLink || "#";
        regLink.textContent = event.registrationLink ? 'Register Now' : 'Registration Closed/NA';

        // --- Description ---
        modal.querySelector('.modal-description').textContent = event.description || "No description available.";

        // --- Highlights ---
        const highlightsContainer = modal.querySelector('.highlights-container');
        highlightsContainer.innerHTML = ''; // Clear previous highlights
        if (event.highlights && Array.isArray(event.highlights)) {
            event.highlights.forEach(h => {
                // Ensure highlight is a non-empty string before creating badge
                if (typeof h === 'string' && h.trim()) {
                    const badge = document.createElement('span');
                    badge.className = 'highlight-badge';
                    badge.textContent = h;
                    highlightsContainer.appendChild(badge);
                }
            });
        }

        // --- Registration Button Logic ---
        const registerButton = modal.querySelector('.modal-register-btn');
        registerButton.onclick = null; // Clear any previous listener first
        registerButton.onclick = async () => {
            console.log("Modal Register button clicked for event:", event.id);
            const user = auth.currentUser;

            // 1. Check Login Status
            if (!user) {
                alert("Please login first to register for this event.");
                window.location.href = '../login-pages/welcomelogin.html'; // Adjust path if needed
                return;
            }

            try {
                // 2. Check User Profile & Email Verification
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    alert("User profile not found. Please complete registration or contact support.");
                    return;
                }
                if (!user.emailVerified) { // Check Firebase auth object directly
                    alert("Please verify your email before registering for events.");
                    return;
                }

                // 3. Prepare Registration Data
                const userId = user.uid;
                const eventId = event.id;
                const isFree = !event.entryFee || parseFloat(event.entryFee) === 0;
                console.log(`Registering user ${userId} for event ${eventId}. Is free: ${isFree}`);

                // 4. Handle Free vs Paid Registration
                if (isFree) {
                    // --- Free Registration ---
                    console.log("Processing free registration...");
                    const qrPayload = { userId, eventId, timestamp: Date.now() };
                    const jsonStr = JSON.stringify(qrPayload);
                    const base64QR = btoa(unescape(encodeURIComponent(jsonStr))); // Simple encoding

                    // Check if QRCode library is available
                    if (typeof QRCode === 'undefined' || !QRCode.toDataURL) {
                        console.error("QRCode library not loaded!");
                        alert("Registration failed: QR Code generator not available.");
                        return;
                    }
                    const qrImageUrl = await QRCode.toDataURL(base64QR);
                    console.log("QR Code generated.");

                    // Firestore references
                    const registeredEventRef = doc(db, `users/${userId}/registeredEvents`, eventId);
                    const registrationRef = doc(db, 'registrations', `${userId}_${eventId}`);

                    // Prepare event data for Firestore (convert Dates to Timestamps)
                    const eventDataForFirestore = { ...event };
                    for (const key of ['startDate', 'endDate', 'registrationDeadline', 'createdAt', 'updatedAt']) {
                        if (eventDataForFirestore[key] instanceof Date) {
                            eventDataForFirestore[key] = Timestamp.fromDate(eventDataForFirestore[key]);
                        } else {
                            // Remove fields that aren't valid dates to avoid Firestore errors
                            delete eventDataForFirestore[key];
                        }
                    }
                    eventDataForFirestore.registrationDate = Timestamp.now();
                    eventDataForFirestore.qrCode = qrImageUrl; // Store Data URL
                    eventDataForFirestore.qrEncryptedData = base64QR; // Store encoded payload

                    // Save to Firestore
                    console.log("Saving registration data to Firestore...");
                    await setDoc(registrationRef, {
                        userId: userId,
                        eventId: eventId,
                        createdAt: Timestamp.now(),
                        checkedIn: false,
                        qrToken: base64QR
                    });
                    await setDoc(registeredEventRef, eventDataForFirestore);

                    console.log("Registration successful!");
                    alert("Registration successful! Your QR code is saved in 'Registered Events'.");
                    window.location.href = '../registered-events/index.html'; // Redirect

                } else {
                    // --- Paid Registration ---
                    console.log("Processing paid registration (redirecting)...");
                    if (event.registrationLink) {
                        // Open external link in a new tab safely
                        window.open(event.registrationLink, "_blank", "noopener,noreferrer");
                    } else {
                        alert("Registration link not available for this paid event.");
                    }
                }
            } catch (error) {
                // Catch any errors during the process
                console.error("Error during event registration process: ", error);
                alert(`Registration failed. Please try again. Error: ${error.message}`);
            }
        }; // End of registerButton onclick function
    } catch (error) {
        console.error("Error populating modal:", error);
        // Optionally display an error message inside the modal
    }
    // --- Wishlist Button Logic ---
    const wishlistButton = modal.querySelector('.modal-wishlist-btn');
    const wishlistIcon = wishlistButton.querySelector('i');

    // Check if event is already saved and update icon
    const isSaved = await checkIfEventSaved(event.id);
    if (isSaved) {
        wishlistIcon.classList.remove('fa-regular');
        wishlistIcon.classList.add('fa-solid');
    } else {
        wishlistIcon.classList.remove('fa-solid');
        wishlistIcon.classList.add('fa-regular');
    }

    // Add click handler
    wishlistButton.onclick = async () => {
        console.log("Wishlist button clicked for event:", event.id);
        const saved = await toggleSaveEvent(event.id);

        // Update icon based on saved state
        if (saved) {
            wishlistIcon.classList.remove('fa-regular');
            wishlistIcon.classList.add('fa-solid');
            // Optional: Show success message
            const originalText = wishlistButton.title || '';
            wishlistButton.title = 'Saved!';
            setTimeout(() => {
                wishlistButton.title = originalText;
            }, 2000);
        } else if (saved === false) {
            wishlistIcon.classList.remove('fa-solid');
            wishlistIcon.classList.add('fa-regular');
            // Optional: Show removed message
            const originalText = wishlistButton.title || '';
            wishlistButton.title = 'Removed';
            setTimeout(() => {
                wishlistButton.title = originalText;
            }, 2000);
        }
    };
}


// --- (Event Listeners for card clicks and modal close) ---
if (eventsContainer) {
    eventsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.event-card');
        if (!card) return;
        if (e.target.closest('.book-tickets')) return; // Ignore clicks on book tickets button
        console.log("Events page: Card clicked.");
        const eventDataString = card.dataset.event;
        if (eventDataString) {
            try { const eventData = JSON.parse(eventDataString); openModal(eventData); }
            catch (error) { console.error("Error parsing event data from card:", error); }
        } else { console.warn("Card clicked, but no event data found in dataset."); }
    });
} else { console.error("Events container not found for click listener."); }

const closeButton = modal?.querySelector('.close-button');
if (closeButton) closeButton.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });


// --- No GlobalSearchSubmit listener needed ---



// --- Function to Setup Mobile Search TOGGLE (Specific to Events Page) ---
