import { auth, db } from '../firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where, deleteDoc, updateDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- GLOBAL STATE --- //
let allEvents = [];
let currentFilter = 'all';
let currentEventId = null;
let currentEventData = null;
let csvFile = null;

// --- PROFILE MENU --- //
const setupProfileMenu = () => {
    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");
    if (!profileBtn || !profileMenu) return;

    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("show");
    });
    
    window.addEventListener("click", () => {
        if (profileMenu.classList.contains("show")) {
            profileMenu.classList.remove("show");
        }
    });
};

// --- MODAL HANDLING --- //
const modalOverlay = document.getElementById('eventModal');
const modalBody = modalOverlay.querySelector('.modal-body');
const closeModalBtn = modalOverlay.querySelector('.close-btn');
const editEventBtn = modalOverlay.querySelector('.edit-event-btn');
const deleteEventBtn = modalOverlay.querySelector('.delete-event-btn');

const editModalOverlay = document.getElementById('editModal');
const editCloseBtn = editModalOverlay.querySelector('.edit-close');
const cancelEditBtn = editModalOverlay.querySelector('.cancel-edit-btn');
const saveEditBtn = editModalOverlay.querySelector('.save-edit-btn');
const editEventForm = document.getElementById('editEventForm');

const deleteModalOverlay = document.getElementById('deleteModal');
const deleteCloseBtn = deleteModalOverlay.querySelector('.delete-close');
const cancelDeleteBtn = deleteModalOverlay.querySelector('.cancel-delete-btn');
const confirmDeleteBtn = deleteModalOverlay.querySelector('.confirm-delete-btn');

const csvModalOverlay = document.getElementById('csvUploadModal');
const csvCloseBtn = csvModalOverlay.querySelector('.csv-close');
const cancelCsvBtn = csvModalOverlay.querySelector('.cancel-csv-btn');
const uploadCsvBtn = csvModalOverlay.querySelector('.upload-csv-btn');
const csvFileInput = document.getElementById('csvFileInput');

const openModal = () => {
    modalOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
};

const closeModal = () => {
    modalOverlay.classList.remove('show');
    document.body.style.overflow = '';
};

const openEditModal = () => {
    editModalOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
};

const closeEditModal = () => {
    editModalOverlay.classList.remove('show');
    document.body.style.overflow = '';
};

const openDeleteModal = () => {
    deleteModalOverlay.classList.add('show');
};

const closeDeleteModal = () => {
    deleteModalOverlay.classList.remove('show');
};

const openCsvModal = (eventId, eventData) => {
    currentEventId = eventId;
    currentEventData = eventData;
    csvFile = null;
    csvFileInput.value = '';
    document.querySelector('.file-name').textContent = '';
    document.querySelector('.upload-progress').style.display = 'none';
    document.querySelector('.upload-results').style.display = 'none';
    uploadCsvBtn.disabled = true;
    csvModalOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
};

const closeCsvModal = () => {
    csvModalOverlay.classList.remove('show');
    document.body.style.overflow = '';
};

// Close modals
closeModalBtn.addEventListener('click', closeModal);
editCloseBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
deleteCloseBtn.addEventListener('click', closeDeleteModal);
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
csvCloseBtn.addEventListener('click', closeCsvModal);
cancelCsvBtn.addEventListener('click', closeCsvModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

editModalOverlay.addEventListener('click', (e) => {
    if (e.target === editModalOverlay) closeEditModal();
});

deleteModalOverlay.addEventListener('click', (e) => {
    if (e.target === deleteModalOverlay) closeDeleteModal();
});

csvModalOverlay.addEventListener('click', (e) => {
    if (e.target === csvModalOverlay) closeCsvModal();
});

// --- CSV FILE HANDLING --- //
csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (!file.name.endsWith('.csv')) {
            alert('Please select a valid CSV file');
            csvFileInput.value = '';
            return;
        }
        csvFile = file;
        document.querySelector('.file-name').textContent = file.name;
        uploadCsvBtn.disabled = false;
    } else {
        csvFile = null;
        document.querySelector('.file-name').textContent = '';
        uploadCsvBtn.disabled = true;
    }
});
// --- GENERATE QR TOKEN --- //
const generateQRToken = (userId, eventId) => {
    const qrPayload = {
        userId,
        eventId,
        timestamp: Date.now(),
    };
    const jsonStr = JSON.stringify(qrPayload);
    const base64QR = btoa(unescape(encodeURIComponent(jsonStr)));
    return base64QR;
};

// --- PROCESS CSV AND CREATE REGISTRATIONS (with QR Image) --- //
uploadCsvBtn.addEventListener('click', async () => {
    if (!csvFile || !currentEventId) return;

    const progressDiv = document.querySelector('.upload-progress');
    const resultsDiv = document.querySelector('.upload-results');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');

    uploadCsvBtn.disabled = true;
    cancelCsvBtn.disabled = true;
    progressDiv.style.display = 'block';
    resultsDiv.style.display = 'none';

    try {
        // Ensure PapaParse is loaded
        if (typeof Papa === 'undefined') {
            alert('CSV parser not loaded. Please refresh the page and try again.');
            progressDiv.style.display = 'none';
            uploadCsvBtn.disabled = false;
            cancelCsvBtn.disabled = false;
            return;
        }

        // Ensure QRCode library is loaded
        if (typeof QRCode === 'undefined') {
            alert('QR code generator not loaded. Please include qrcode.min.js.');
            progressDiv.style.display = 'none';
            uploadCsvBtn.disabled = false;
            cancelCsvBtn.disabled = false;
            return;
        }

        // Parse CSV
        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const emails = results.data.map(row => row.email?.trim().toLowerCase()).filter(e => e);

                if (emails.length === 0) {
                    alert('No valid emails found in CSV');
                    progressDiv.style.display = 'none';
                    uploadCsvBtn.disabled = false;
                    cancelCsvBtn.disabled = false;
                    return;
                }

                let successCount = 0;
                let errorCount = 0;
                const errorEmails = [];

                for (let i = 0; i < emails.length; i++) {
                    const email = emails[i];

                    try {
                        // 1️⃣ Find user by email
                        const usersRef = collection(db, "users");
                        const q = query(usersRef, where("email", "==", email));
                        const querySnapshot = await getDocs(q);

                        if (querySnapshot.empty) {
                            errorEmails.push({ email, reason: 'User not found' });
                            errorCount++;
                        } else {
                            const userDoc = querySnapshot.docs[0];
                            const userId = userDoc.id;

                            // 2️⃣ Check if already registered
                            const registrationRef = doc(db, 'registrations', `${userId}_${currentEventId}`);
                            const existingReg = await getDoc(registrationRef);

                            if (existingReg.exists()) {
                                errorEmails.push({ email, reason: 'Already registered' });
                                errorCount++;
                            } else {
                                // 3️⃣ Generate QR Token
                                const qrToken = generateQRToken(userId, currentEventId);

                                // 4️⃣ Generate QR Image as Base64
                                const qrCodeImage = await new Promise((resolve, reject) => {
                                    QRCode.toDataURL(qrToken, { errorCorrectionLevel: 'H', width: 300 }, (err, url) => {
                                        if (err) reject(err);
                                        else resolve(url);
                                    });
                                });

                                // 5️⃣ Create registration document
                                await setDoc(registrationRef, {
                                    userId: userId,
                                    eventId: currentEventId,
                                    createdAt: Timestamp.now(),
                                    checkedIn: false,
                                    qrToken: qrToken,
                                    qrCode: qrCodeImage, // ✅ New field for QR Image
                                });



                                // 6️⃣ Also add to user's registeredEvents subcollection
                                const userEventRef = doc(db, `users/${userId}/registeredEvents`, currentEventId);

                                // Prepare event data safely
                                const eventDataForUser = {
                                    ...currentEventData,
                                    registrationDate: Timestamp.now(),
                                    qrEncryptedData: qrToken,
                                    qrCode: qrCodeImage, // ✅ Also store image in user's event
                                };

                                // Convert date fields safely to Firestore timestamps
                                for (const key of ['startDate', 'startTime', 'endDate', 'registrationDeadline', 'createdAt', 'updatedAt']) {
                                    if (eventDataForUser[key]) {
                                        try {
                                            if (!(eventDataForUser[key] instanceof Timestamp)) {
                                                const dateValue = new Date(eventDataForUser[key]);
                                                if (!isNaN(dateValue.getTime())) {
                                                    eventDataForUser[key] = Timestamp.fromDate(dateValue);
                                                } else {
                                                    delete eventDataForUser[key];
                                                }
                                            }
                                        } catch (e) {
                                            console.error(`Error converting ${key}:`, e);
                                            delete eventDataForUser[key];
                                        }
                                    }
                                }

                                await setDoc(userEventRef, eventDataForUser);
                                successCount++;
                            }
                        }
                    } catch (error) {
                        console.error(`Error processing ${email}:`, error);
                        errorEmails.push({ email, reason: error.message });
                        errorCount++;
                    }

                    // 🔄 Update progress bar
                    const progress = ((i + 1) / emails.length) * 100;
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `Processing... ${i + 1}/${emails.length}`;
                }

                // ✅ Show results
                progressDiv.style.display = 'none';
                resultsDiv.style.display = 'block';
                document.querySelector('.success-count').textContent = successCount;
                document.querySelector('.error-count').textContent = errorCount;

                if (errorEmails.length > 0) {
                    const errorDetails = document.querySelector('.error-details');
                    const errorList = document.querySelector('.error-list');
                    errorDetails.style.display = 'block';
                    errorList.innerHTML = errorEmails.map(e =>
                        `<li>${e.email} - <span class="error-reason">${e.reason}</span></li>`
                    ).join('');
                }

                uploadCsvBtn.disabled = false;
                cancelCsvBtn.disabled = false;
            },
            error: (error) => {
                console.error('CSV parsing error:', error);
                alert('Failed to parse CSV file. Please check the format.');
                progressDiv.style.display = 'none';
                uploadCsvBtn.disabled = false;
                cancelCsvBtn.disabled = false;
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to process CSV. Please try again.');
        progressDiv.style.display = 'none';
        uploadCsvBtn.disabled = false;
        cancelCsvBtn.disabled = false;
    }
});


// --- POPULATE DETAILS MODAL --- //
const populateModal = (event) => {
    const formatFullDate = (date) => {
        if (!date) return 'TBA';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'TBA';
            return d.toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } catch (e) {
            return 'TBA';
        }
    };
    
    const formatTime = (date) => {
        if (!date) return 'TBA';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'TBA';
            return d.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: true 
            });
        } catch (e) {
            return 'TBA';
        }
    };

    const bannerUrl = event.bannerImage || 
                      (event.imageUrl && (event.imageUrl.url || event.imageUrl.banner)) || 
                      'https://via.placeholder.com/700x300?text=Event+Banner';

    modalBody.innerHTML = `
        <img src="${bannerUrl}" alt="${event.title}" onerror="this.src='https://via.placeholder.com/700x300?text=Event+Banner'">
        <p><strong>Description:</strong> ${event.description || 'No description provided.'}</p>
        <p><strong>Club:</strong> ${event.clubName || 'N/A'}</p>
        <p><strong>Category:</strong> ${event.category || 'N/A'}</p>
        <p><strong>Venue:</strong> ${event.venue || event.location || 'TBA'}</p>
        <p><strong>Starts:</strong> ${formatFullDate(event.startDate)} at ${formatTime(event.startTime)}</p>
        <p><strong>Ends:</strong> ${formatFullDate(event.endDate)}</p>
        <p><strong>Registration Deadline:</strong> ${formatFullDate(event.registrationDeadline)}</p>
        <p><strong>Entry Fee:</strong> ₹${event.entryFee || 0}</p>
        <p><strong>Prize Pool:</strong> ₹${event.prizePool || 0}</p>
        <p><strong>Team Size:</strong> ${event.teamSize || 'N/A'}</p>
        <p><strong>Mode:</strong> ${event.mode || 'N/A'}</p>
        <p><strong>Status:</strong> ${event.status || 'Upcoming'}</p>
    `;
    
    currentEventId = event.id;
    currentEventData = event;
    editEventBtn.dataset.eventId = event.id;
    deleteEventBtn.dataset.eventId = event.id;
};

// --- POPULATE EDIT MODAL --- //
const populateEditModal = (event) => {
    const formatDateTimeLocal = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
            console.error('Error formatting date:', e);
            return '';
        }
    };

    document.getElementById('editTitle').value = event.title || '';
    document.getElementById('editDescription').value = event.description || '';
    document.getElementById('editCategory').value = event.category || '';
    document.getElementById('editVenue').value = event.venue || event.location || '';
    document.getElementById('editStartDate').value = formatDateTimeLocal(event.startDate || event.startTime);
    document.getElementById('editEndDate').value = formatDateTimeLocal(event.endDate);
    document.getElementById('editRegDeadline').value = formatDateTimeLocal(event.registrationDeadline);
    document.getElementById('editEntryFee').value = event.entryFee || 0;
    document.getElementById('editPrizePool').value = event.prizePool || 0;
    document.getElementById('editTeamSize').value = event.teamSize || '';
    document.getElementById('editMode').value = event.mode || 'Online';
    document.getElementById('editStatus').value = event.status || 'Upcoming';
    document.getElementById('editBannerUrl').value = event.bannerImage || '';
    document.getElementById('editRegLink').value = event.registrationLink || '';
};

// --- EDIT EVENT BUTTON --- //
editEventBtn.addEventListener('click', () => {
    if (currentEventData) {
        populateEditModal(currentEventData);
        closeModal();
        openEditModal();
    }
});

// --- SAVE EDIT EVENT --- //
saveEditBtn.addEventListener('click', async () => {
    if (!editEventForm.checkValidity()) {
        editEventForm.reportValidity();
        return;
    }

    const eventId = currentEventId;
    if (!eventId) return;

    try {
        saveEditBtn.disabled = true;
        saveEditBtn.innerHTML = '<i class="ph-bold ph-circle-notch"></i> Saving...';

        const formData = {
            title: document.getElementById('editTitle').value.trim(),
            description: document.getElementById('editDescription').value.trim(),
            category: document.getElementById('editCategory').value.trim(),
            venue: document.getElementById('editVenue').value.trim(),
            entryFee: parseInt(document.getElementById('editEntryFee').value) || 0,
            prizePool: parseInt(document.getElementById('editPrizePool').value) || 0,
            teamSize: document.getElementById('editTeamSize').value.trim(),
            mode: document.getElementById('editMode').value,
            status: document.getElementById('editStatus').value,
            bannerImage: document.getElementById('editBannerUrl').value.trim(),
            registrationLink: document.getElementById('editRegLink').value.trim(),
            updatedAt: Timestamp.now()
        };

        const startDateValue = document.getElementById('editStartDate').value;
        const endDateValue = document.getElementById('editEndDate').value;
        const regDeadlineValue = document.getElementById('editRegDeadline').value;

        if (startDateValue) {
            formData.startDate = Timestamp.fromDate(new Date(startDateValue));
            formData.startTime = Timestamp.fromDate(new Date(startDateValue));
        }
        if (endDateValue) {
            formData.endDate = Timestamp.fromDate(new Date(endDateValue));
        }
        if (regDeadlineValue) {
            formData.registrationDeadline = Timestamp.fromDate(new Date(regDeadlineValue));
        }

        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, formData);

        const eventIndex = allEvents.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
            const updatedEvent = {
                ...allEvents[eventIndex],
                ...formData,
                startDate: formData.startDate ? formData.startDate.toDate().toISOString() : null,
                startTime: formData.startTime ? formData.startTime.toDate().toISOString() : null,
                endDate: formData.endDate ? formData.endDate.toDate().toISOString() : null,
                registrationDeadline: formData.registrationDeadline ? formData.registrationDeadline.toDate().toISOString() : null,
            };
            allEvents[eventIndex] = updatedEvent;
        }

        closeEditModal();

        const eventsGrid = document.querySelector('.events-grid');
        renderEvents(filterEvents(currentFilter), eventsGrid);

        alert('Event updated successfully!');

    } catch (error) {
        console.error("Error updating event: ", error);
        alert('Failed to update event. Please try again.');
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Changes';
    }
});

// --- DELETE EVENT --- //
deleteEventBtn.addEventListener('click', () => {
    const eventId = deleteEventBtn.dataset.eventId;
    if (eventId) {
        const event = allEvents.find(e => e.id === eventId);
        if (event) {
            const confirmText = deleteModalOverlay.querySelector('.event-name-confirm');
            confirmText.textContent = `Event: ${event.title}`;
            closeModal();
            openDeleteModal();
        }
    }
});

confirmDeleteBtn.addEventListener('click', async () => {
    const eventId = deleteEventBtn.dataset.eventId;
    if (!eventId) return;

    try {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Deleting...';

        await deleteDoc(doc(db, "events", eventId));
        
        allEvents = allEvents.filter(e => e.id !== eventId);
        
        closeDeleteModal();
        
        const eventsGrid = document.querySelector('.events-grid');
        renderEvents(filterEvents(currentFilter), eventsGrid);
        
        alert('Event deleted successfully!');
        
    } catch (error) {
        console.error("Error deleting event: ", error);
        alert('Failed to delete event. Please try again.');
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Delete Event';
    }
});

// --- EVENT CARD CREATION --- //
const createEventCard = (event) => {
    const card = document.createElement('div');
    card.classList.add('event-card');
    card.dataset.event = JSON.stringify(event);

    const eventDateObj = event.startTime || event.startDate;
    let eventDate = "TBA";
    let eventTime = "";
    
    try {
        if (eventDateObj) {
            const d = new Date(eventDateObj);
            if (!isNaN(d.getTime())) {
                eventDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                eventTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        }
    } catch (e) {
        console.error('Error formatting event date:', e);
    }
    
    const bannerUrl = event.bannerImage || 
                      (event.imageUrl && (event.imageUrl.url || event.imageUrl.banner)) || 
                      'https://via.placeholder.com/400x200?text=Event+Banner';

    const status = event.status || 'Upcoming';
    const ribbonClass = status.toLowerCase();

    // Determine if event is paid (entryFee > 0)
    const isPaidEvent = event.entryFee && event.entryFee > 0;

    card.innerHTML = `
        <div class="poster">
            <img src="${bannerUrl}" alt="${event.title || 'Event Banner'}" onerror="this.src='https://via.placeholder.com/400x200?text=Event+Banner'">
            <div class="ribbon ${ribbonClass}">${status}</div>
            ${isPaidEvent ? '<div class="paid-badge"><i class="ph-bold ph-currency-inr"></i> Paid</div>' : ''}
        </div>
        <div class="details">
            <span class="club-name">Presented by ${event.clubName || "N/A"}</span>
            <h3 class="title">${event.title || 'Untitled Event'}</h3>
            <div class="event-info">
                <div><i class="ph-bold ph-map-pin"></i><span>${event.venue || "TBA"}</span></div>
                <div><i class="ph-bold ph-calendar"></i><span>${eventDate}</span></div>
                <div><i class="ph-bold ph-clock"></i><span>${eventTime}</span></div>
            </div>
            <div class="card-actions">
                <button class="details-btn">View Details</button>
                ${isPaidEvent ? '<button class="upload-csv-btn-card"><i class="ph-bold ph-file-csv"></i> Upload CSV</button>' : ''}
            </div>
        </div>
    `;
    
    return card;
};

// --- RENDER EVENTS --- //
const renderEvents = (events, container) => {
    container.innerHTML = '';
    
    if (!events || events.length === 0) {
        container.innerHTML = '<p class="empty-state">No events found matching your filter.</p>';
        return;
    }

    events.forEach(eventData => {
        const eventCard = createEventCard(eventData);
        
        eventCard.querySelector('.details-btn').addEventListener('click', (e) => {
            e.preventDefault();
            const storedEventData = JSON.parse(e.currentTarget.closest('.event-card').dataset.event);
            populateModal(storedEventData);
            openModal();
        });

        // Add CSV upload button listener for paid events
        const csvBtn = eventCard.querySelector('.upload-csv-btn-card');
        if (csvBtn) {
            csvBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const storedEventData = JSON.parse(e.currentTarget.closest('.event-card').dataset.event);
                openCsvModal(storedEventData.id, storedEventData);
            });
        }

        container.appendChild(eventCard);
    });
};

// --- FILTER EVENTS --- //
const filterEvents = (filterType) => {
    if (filterType === 'all') {
        return allEvents;
    }
    return allEvents.filter(event => event.status === filterType);
};

// --- SETUP FILTERS --- //
const setupFilters = () => {
    const filterButtons = document.querySelectorAll('.tag-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filterType = btn.dataset.filter;
            currentFilter = filterType;
            
            const eventsGrid = document.querySelector('.events-grid');
            renderEvents(filterEvents(filterType), eventsGrid);
        });
    });
};

// --- FETCH ADMIN EVENTS --- //
const fetchAdminEvents = () => {
    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            eventsGrid.innerHTML = '<p class="loading-text">Loading your events...</p>';
            
            try {
                const adminDocRef = doc(db, "admins", user.uid);
                const adminDocSnap = await getDoc(adminDocRef);

                if (adminDocSnap.exists()) {
                    const clubId = adminDocSnap.data().clubId;
                    
                    if (!clubId) {
                        eventsGrid.innerHTML = '<p class="empty-state">Your admin profile is not linked to a club.</p>';
                        return;
                    }

                    const convertTimestamp = (ts) => ts ? ts.toDate().toISOString() : null;

                    const eventsRef = collection(db, "events");
                    const q = query(eventsRef, where("clubId", "==", clubId));
                    const querySnapshot = await getDocs(q);
                    
                    allEvents = querySnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            startTime: convertTimestamp(data.startTime),
                            startDate: convertTimestamp(data.startDate),
                            endDate: convertTimestamp(data.endDate),
                            registrationDeadline: convertTimestamp(data.registrationDeadline),
                        };
                    });
                    
                    allEvents.sort((a, b) => {
                        try {
                            const dateA = new Date(a.startDate || a.startTime || 0);
                            const dateB = new Date(b.startDate || b.startTime || 0);
                            if (isNaN(dateA.getTime())) return 1;
                            if (isNaN(dateB.getTime())) return -1;
                            return dateB - dateA;
                        } catch (e) {
                            return 0;
                        }
                    });
                    
                    renderEvents(filterEvents(currentFilter), eventsGrid);
                    
                } else {
                    eventsGrid.innerHTML = '<p class="empty-state">Admin profile not found.</p>';
                }
            } catch (error) {
                console.error("Error fetching events: ", error);
                eventsGrid.innerHTML = '<p class="empty-state">Failed to load events. Please try again.</p>';
            }
        } else {
            eventsGrid.innerHTML = '<p class="empty-state">Please sign in to view your events.</p>';
            setTimeout(() => {
                window.location.href = '../login-pages/welcomelogin.html';
            }, 2000);
        }
    });
};

// --- INITIALIZE APP --- //
document.addEventListener('DOMContentLoaded', () => {
    setupProfileMenu();
    setupFilters();
    fetchAdminEvents();
});