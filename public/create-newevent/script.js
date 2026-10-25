import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, addDoc, Timestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

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
const storage = getStorage(app);

// Global variables
let currentUserData = null;
let uploadedImageUrl = null;

// ==========================================================================
// IMAGE UPLOAD FUNCTIONALITY
// ==========================================================================

const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const browseBtn = document.getElementById('browseBtn');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImageBtn');
const uploadStatus = document.getElementById('uploadStatus');

// Upload tabs functionality
const uploadTabs = document.querySelectorAll('.upload-tab');
const uploadPanels = {
    upload: document.getElementById('upload-panel'),
    url: document.getElementById('url-panel')
};

uploadTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabType = tab.dataset.tab;
        
        // Update active tab
        uploadTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active panel
        Object.values(uploadPanels).forEach(panel => panel.classList.remove('active'));
        uploadPanels[tabType].classList.add('active');
        
        // Reset uploaded image if switching tabs
        if (tabType === 'url') {
            uploadedImageUrl = null;
        }
    });
});

// Browse button click
browseBtn.addEventListener('click', () => {
    imageInput.click();
});

// File input change
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageFile(file);
    }
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
    }
});

// Handle image file
async function handleImageFile(file) {
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        dropZone.style.display = 'none';
        imagePreview.style.display = 'block';
        uploadedImageUrl = e.target.result; // Use base64 as fallback
        updatePreview();
    };
    reader.readAsDataURL(file);

    // Try to upload to Firebase Storage with timeout
    const user = auth.currentUser;
    if (!user) {
        uploadStatus.textContent = 'ℹ️ Image ready (login to save to cloud)';
        uploadStatus.style.color = '#3b82f6';
        return;
    }

    uploadStatus.textContent = 'Uploading to cloud...';
    uploadStatus.style.color = '#fbbf24';

    try {
        // Create unique filename with sanitized name
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `event-banners/${user.uid}/${timestamp}_${sanitizedName}`;
        
        const storageRef = ref(storage, filename);

        // Upload file with metadata and timeout
        const uploadPromise = uploadBytes(storageRef, file, {
            contentType: file.type,
            customMetadata: {
                uploadedBy: user.uid,
                uploadedAt: new Date().toISOString()
            }
        });

        // Add 10 second timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout')), 10000)
        );

        await Promise.race([uploadPromise, timeoutPromise]);
        
        // Get download URL with timeout
        const urlPromise = getDownloadURL(storageRef);
        const urlTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('URL fetch timeout')), 5000)
        );

        const downloadURL = await Promise.race([urlPromise, urlTimeoutPromise]);
        
        uploadedImageUrl = downloadURL;
        uploadStatus.textContent = '✓ Uploaded to cloud';
        uploadStatus.style.color = '#4ade80';
        
        updatePreview();
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'ℹ️ Using preview (cloud upload failed)';
        
        if (error.message === 'Upload timeout' || error.message === 'URL fetch timeout') {
            errorMessage = 'ℹ️ Upload timeout - using preview';
        } else if (error.code === 'storage/unauthorized') {
            errorMessage = 'ℹ️ Permission denied - using preview';
            console.error('Fix: Update Firebase Storage Rules');
        } else if (error.code === 'storage/canceled') {
            errorMessage = 'ℹ️ Upload canceled - using preview';
        }
        
        uploadStatus.textContent = errorMessage;
        uploadStatus.style.color = '#3b82f6';
        
        // Image preview is already set with base64, so form can still be submitted
    }
}

// Remove image
removeImageBtn.addEventListener('click', () => {
    imageInput.value = '';
    uploadedImageUrl = null;
    dropZone.style.display = 'block';
    imagePreview.style.display = 'none';
    previewImg.src = '';
    uploadStatus.textContent = '';
    updatePreview();
});

// ==========================================================================
// REAL-TIME PREVIEW UPDATE
// ==========================================================================

function updatePreview() {
    const title = document.getElementById("title").value || "Event Title";
    const clubName = currentUserData?.clubName || "Your Club";
    const venue = document.getElementById("venue").value || "Venue";
    
    // Get banner image - prioritize uploaded image
    let bannerImage;
    const activeTab = document.querySelector('.upload-tab.active').dataset.tab;
    if (activeTab === 'upload' && uploadedImageUrl) {
        bannerImage = uploadedImageUrl;
    } else if (activeTab === 'url') {
        bannerImage = document.getElementById("bannerImage").value || "https://via.placeholder.com/300x150";
    } else {
        bannerImage = "https://via.placeholder.com/300x150";
    }
    
    const registrationLink = document.getElementById("registrationLink").value || "#";
    const startDateValue = document.getElementById("startDate").value;
    
    let eventDate = "Date";
    let eventTime = "Time";

    if (startDateValue) {
        const startDate = new Date(startDateValue);
        eventDate = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        eventTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    const previewCard = document.getElementById("preview-card");

    previewCard.innerHTML = `
        <div class="poster">
            <img src="${bannerImage}" alt="${title}" id="preview-banner" onerror="this.src='https://via.placeholder.com/300x150?text=Invalid+Image'">
            <div class="ribbon"><span class="event-status">Upcoming</span></div>
        </div>
        <div class="details">
            <div class="club">
                <span class="star">Presented by</span>
                <span>${clubName}</span>
            </div>
            <h3 class="title">${title}</h3>
            <div class="bottom">
                <button class="venue"><i class="ri-map-pin-line"></i>${venue}</button>
            </div>
            <a href="${registrationLink}" class="book-tickets" target="_blank">Book Tickets</a>
            <div class="bottom">
                <div class="date">
                    <i class="ri-calendar-event-fill"></i>
                    <span class="event-date">${eventDate}</span>
                </div>
                <div class="time">
                    <i class="ri-time-line"></i>
                    <span class="event-time">${eventTime}</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================================================
// JSON MODAL HANDLING
// ==========================================================================

const jsonModal = document.getElementById("jsonModal");
const jsonUploadBtn = document.getElementById("jsonUploadBtn");
const jsonCloseBtn = document.querySelector(".json-close-btn");
const verifyJsonBtn = document.getElementById("verifyJsonBtn");
const uploadJsonBtn = document.getElementById("uploadJsonBtn");
const jsonInput = document.getElementById("jsonInput");
const jsonValidationMessage = document.getElementById("jsonValidationMessage");

let verifiedJsonData = null;

// Open modal
jsonUploadBtn.addEventListener("click", () => {
    jsonModal.style.display = "block";
    jsonInput.value = "";
    jsonValidationMessage.style.display = "none";
    uploadJsonBtn.disabled = true;
    verifiedJsonData = null;
});

// Close modal
jsonCloseBtn.addEventListener("click", () => {
    jsonModal.style.display = "none";
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
    if (e.target === jsonModal) {
        jsonModal.style.display = "none";
    }
});

// ==========================================================================
// JSON VERIFICATION LOGIC
// ==========================================================================

verifyJsonBtn.addEventListener("click", async () => {
    const jsonText = jsonInput.value.trim();
    
    if (!jsonText) {
        showValidationMessage("Please paste JSON data first", "error");
        return;
    }

    verifyJsonBtn.textContent = "Verifying...";
    verifyJsonBtn.disabled = true;

    try {
        const jsonData = JSON.parse(jsonText);

        // Required fields validation
        const requiredFields = ['title', 'category', 'bannerImage', 'venue', 'startDate', 'endDate', 'mode', 'description'];
        const missingFields = requiredFields.filter(field => !jsonData[field]);

        if (missingFields.length > 0) {
            showValidationMessage(`Missing required fields: ${missingFields.join(', ')}`, "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        // Date validation
        const startDate = new Date(jsonData.startDate);
        const endDate = new Date(jsonData.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            showValidationMessage("Invalid date format. Use ISO format: YYYY-MM-DDTHH:MM", "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        if (endDate <= startDate) {
            showValidationMessage("End date must be after start date", "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        // Check user authentication and authorization
        const user = auth.currentUser;
        if (!user) {
            showValidationMessage("You must be logged in to upload events", "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        // Fetch admin data
        const adminDocRef = doc(db, "admins", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);

        if (!adminDocSnap.exists()) {
            showValidationMessage("You are not authorized to create events. Only club admins can upload events.", "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        const adminData = adminDocSnap.data();
        
        // Check if JSON contains clubId and if it matches the admin's clubId
        if (jsonData.clubId && jsonData.clubId !== adminData.clubId) {
            showValidationMessage(`Authorization failed: You can only create events for your club (${adminData.clubName}). The JSON contains a different clubId.`, "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        // Check if JSON contains clubName and if it matches
        if (jsonData.clubName && jsonData.clubName !== adminData.clubName) {
            showValidationMessage(`Club name mismatch: You are admin of "${adminData.clubName}" but JSON contains "${jsonData.clubName}"`, "error");
            verifyJsonBtn.textContent = "Verify JSON";
            verifyJsonBtn.disabled = false;
            return;
        }

        // Validation successful - status will be set to "Upcoming" automatically
        verifiedJsonData = {
            ...jsonData,
            status: "Upcoming", // Force status to Upcoming
            clubId: adminData.clubId,
            clubName: adminData.clubName,
            createdBy: user.uid
        };

        showValidationMessage(`✓ JSON verified successfully! Event will be created for "${adminData.clubName}" with status "Upcoming"`, "success");
        uploadJsonBtn.disabled = false;

    } catch (error) {
        if (error instanceof SyntaxError) {
            showValidationMessage("Invalid JSON format. Please check your syntax.", "error");
        } else {
            showValidationMessage(`Verification error: ${error.message}`, "error");
        }
        uploadJsonBtn.disabled = true;
    }

    verifyJsonBtn.textContent = "Verify JSON";
    verifyJsonBtn.disabled = false;
});

// ==========================================================================
// JSON UPLOAD LOGIC
// ==========================================================================

uploadJsonBtn.addEventListener("click", async () => {
    if (!verifiedJsonData) {
        showValidationMessage("Please verify JSON first", "warning");
        return;
    }

    uploadJsonBtn.textContent = "Uploading...";
    uploadJsonBtn.disabled = true;

    try {
        // Prepare event object with proper Timestamp conversion
        const newEvent = {
            title: verifiedJsonData.title,
            category: verifiedJsonData.category,
            bannerImage: verifiedJsonData.bannerImage,
            venue: verifiedJsonData.venue,
            startDate: Timestamp.fromDate(new Date(verifiedJsonData.startDate)),
            endDate: Timestamp.fromDate(new Date(verifiedJsonData.endDate)),
            status: "Upcoming", // Always set to Upcoming
            mode: verifiedJsonData.mode,
            clubName: verifiedJsonData.clubName,
            teamSize: verifiedJsonData.teamSize || "",
            eligibility: verifiedJsonData.eligibility || "",
            entryFee: parseFloat(verifiedJsonData.entryFee) || 0,
            prizePool: parseFloat(verifiedJsonData.prizePool) || 0,
            maxParticipants: parseInt(verifiedJsonData.maxParticipants) || 0,
            currentParticipants: 0,
            registrationDeadline: verifiedJsonData.registrationDeadline ? Timestamp.fromDate(new Date(verifiedJsonData.registrationDeadline)) : null,
            registrationLink: verifiedJsonData.registrationLink || "",
            highlights: Array.isArray(verifiedJsonData.highlights) ? verifiedJsonData.highlights : 
                        (verifiedJsonData.highlights ? verifiedJsonData.highlights.split(',').map(h => h.trim()) : []),
            description: verifiedJsonData.description,
            clubId: verifiedJsonData.clubId,
            clubName: verifiedJsonData.clubName,
            createdBy: verifiedJsonData.createdBy,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        // Add event to Firestore
        await addDoc(collection(db, "events"), newEvent);

        showValidationMessage("✓ Event uploaded successfully!", "success");
        
        // Close modal after 2 seconds
        setTimeout(() => {
            jsonModal.style.display = "none";
            jsonInput.value = "";
            verifiedJsonData = null;
            uploadJsonBtn.disabled = true;
        }, 2000);

    } catch (error) {
        showValidationMessage(`Upload failed: ${error.message}`, "error");
        console.error("Error uploading event:", error);
    }

    uploadJsonBtn.textContent = "Upload Event";
    uploadJsonBtn.disabled = false;
});

function showValidationMessage(message, type) {
    jsonValidationMessage.textContent = message;
    jsonValidationMessage.className = `json-validation-message ${type}`;
    jsonValidationMessage.style.display = "block";
}

// ==========================================================================
// FORM SUBMISSION & FIREBASE INTEGRATION
// ==========================================================================

document.getElementById("createEventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById("message");

    // Clear previous messages
    messageEl.textContent = "";
    messageEl.style.color = "";

    try {
        // Collect form data
        const title = document.getElementById("title").value.trim();
        const category = document.getElementById("category").value.trim();
        
        // Get banner image based on active tab
        const activeTab = document.querySelector('.upload-tab.active').dataset.tab;
        let bannerImage;
        if (activeTab === 'upload') {
            if (!uploadedImageUrl) {
                messageEl.style.color = "#ff6b6b";
                messageEl.textContent = "⚠️ Please upload an image first.";
                return;
            }
            
            // Check if it's a base64 image (fallback)
            if (uploadedImageUrl.startsWith('data:')) {
                messageEl.style.color = "#fbbf24";
                messageEl.textContent = "⚠️ Image upload to cloud failed. Please use the URL tab or try uploading again.";
                return;
            }
            
            bannerImage = uploadedImageUrl;
        } else if (activeTab === 'url') {
            bannerImage = document.getElementById("bannerImage").value.trim();
            if (!bannerImage) {
                messageEl.style.color = "#ff6b6b";
                messageEl.textContent = "⚠️ Please provide an image URL.";
                return;
            }
        } else {
            messageEl.style.color = "#ff6b6b";
            messageEl.textContent = "⚠️ Please upload an image or provide an image URL.";
            return;
        }
        
        const venue = document.getElementById("venue").value.trim();
        const startDate = new Date(document.getElementById("startDate").value);
        const endDate = new Date(document.getElementById("endDate").value);
        const mode = document.getElementById("mode").value;
        const teamSize = document.getElementById("teamSize").value.trim();
        const eligibility = document.getElementById("eligibility").value.trim();
        const entryFee = parseFloat(document.getElementById("entryFee").value) || 0;
        const prizePool = parseFloat(document.getElementById("prizePool").value) || 0;
        const maxParticipants = parseInt(document.getElementById("maxParticipants").value) || 0;
        const registrationDeadlineInput = document.getElementById("registrationDeadline").value;
        const registrationDeadline = registrationDeadlineInput ? new Date(registrationDeadlineInput) : null;
        const registrationLink = document.getElementById("registrationLink").value.trim();
        const highlights = document.getElementById("highlights").value
            ? document.getElementById("highlights").value.split(",").map((h) => h.trim())
            : [];
        const description = document.getElementById("description").value.trim();

        // Validation
        if (!title || !category || !bannerImage || !venue || !description) {
            messageEl.style.color = "#ff6b6b";
            messageEl.textContent = "⚠️ Please fill in all required fields.";
            return;
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            messageEl.style.color = "#ff6b6b";
            messageEl.textContent = "⚠️ Please provide valid start and end dates.";
            return;
        }

        if (endDate <= startDate) {
            messageEl.style.color = "#ff6b6b";
            messageEl.textContent = "⚠️ End date must be after start date.";
            return;
        }

        // Check user authentication and authorization
        const user = auth.currentUser;
        let createdBy, clubId, clubName;

        if (user) {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                createdBy = user.uid;
                clubId = adminDocSnap.data().clubId;
                clubName = adminDocSnap.data().clubName;
            } else {
                messageEl.style.color = "#ff6b6b";
                messageEl.textContent = "❌ You are not authorized to create an event.";
                return;
            }
        } else {
            messageEl.style.color = "#ff6b6b";
            messageEl.textContent = "❌ You must be logged in to create an event.";
            return;
        }

        // Show loading state
        const createBtn = document.querySelector('.create-btn');
        const originalBtnText = createBtn.textContent;
        createBtn.textContent = "Creating Event...";
        createBtn.disabled = true;

        // Prepare event object - status is always "Upcoming"
        const newEvent = {
            title,
            category,
            bannerImage,
            venue,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            status: "Upcoming", // Always set to Upcoming
            mode,
            teamSize,
            eligibility,
            entryFee,
            prizePool,
            maxParticipants,
            currentParticipants: 0,
            registrationDeadline: registrationDeadline ? Timestamp.fromDate(registrationDeadline) : null,
            registrationLink,
            highlights,
            description,
            clubId,
            clubName,
            createdBy,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        // Add event to Firestore
        await addDoc(collection(db, "events"), newEvent);

        // Success feedback
        messageEl.style.color = "#4ade80";
        messageEl.style.background = "rgba(74, 222, 128, 0.1)";
        messageEl.style.padding = "12px";
        messageEl.style.borderRadius = "8px";
        messageEl.textContent = "✅ Event created successfully!";

        // Reset form
        document.getElementById("createEventForm").reset();
        uploadedImageUrl = null;
        dropZone.style.display = 'block';
        imagePreview.style.display = 'none';
        updatePreview();

        // Reset button state
        createBtn.textContent = originalBtnText;
        createBtn.disabled = false;

        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Clear success message after 5 seconds
        setTimeout(() => {
            messageEl.textContent = "";
            messageEl.style.background = "";
            messageEl.style.padding = "";
        }, 5000);

    } catch (error) {
        console.error("Error adding event:", error);
        
        messageEl.style.color = "#ff6b6b";
        messageEl.style.background = "rgba(255, 107, 107, 0.1)";
        messageEl.style.padding = "12px";
        messageEl.style.borderRadius = "8px";
        messageEl.textContent = `❌ Failed to create event: ${error.message}`;

        const createBtn = document.querySelector('.create-btn');
        createBtn.textContent = "Create Event";
        createBtn.disabled = false;
    }
});

// ==========================================================================
// AUTH STATE MONITORING
// ==========================================================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User is logged in:", user);
        
        // Fetch and store admin data
        try {
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDocSnap = await getDoc(adminDocRef);
            
            if (adminDocSnap.exists()) {
                currentUserData = adminDocSnap.data();
                updatePreview();
            }
        } catch (error) {
            console.error("Error fetching admin data:", error);
        }
    } else {
        console.log("User is logged out.");
        currentUserData = null;
    }
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createEventForm');
    const fields = form.querySelectorAll('input, select, textarea');
    
    // Add event listeners for real-time preview
    fields.forEach(field => {
        field.addEventListener('input', updatePreview);
    });
    
    // Initial preview update
    updatePreview();

    // Date validation
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");

    if (startDateInput && endDateInput) {
        startDateInput.addEventListener("change", function() {
            endDateInput.min = this.value;
            
            if (endDateInput.value && new Date(endDateInput.value) < new Date(this.value)) {
                endDateInput.value = "";
            }
        });
    }
});

// =========================================================================
// EVENT PREVIEW MODAL
// =========================================================================

const eventModal = document.getElementById("event-modal");
const previewCard = document.getElementById("preview-card");
const closeModalButton = document.querySelector(".modal .close-button");

function populateAndOpenModal() {
    // Get data from form
    const title = document.getElementById("title").value || "Event Title";
    const clubName = currentUserData?.clubName || "Your Club";
    const category = document.getElementById("category").value || "Category";
    
    // Get banner image
    const activeTab = document.querySelector('.upload-tab.active').dataset.tab;
    let bannerImage;
    if (activeTab === 'upload' && uploadedImageUrl) {
        bannerImage = uploadedImageUrl;
    } else if (activeTab === 'url') {
        bannerImage = document.getElementById("bannerImage").value || "https://via.placeholder.com/800x400";
    } else {
        bannerImage = "https://via.placeholder.com/800x400";
    }
    
    const startDateValue = document.getElementById("startDate").value;
    const endDateValue = document.getElementById("endDate").value;
    const venue = document.getElementById("venue").value || "Venue";
    const entryFee = document.getElementById("entryFee").value || "0";
    const prizePool = document.getElementById("prizePool").value || "0";
    const teamSize = document.getElementById("teamSize").value || "Not specified";
    const mode = document.getElementById("mode").value || "N/A";
    const registrationDeadlineValue = document.getElementById("registrationDeadline").value;
    const eligibility = document.getElementById("eligibility").value || "All are welcome";
    const registrationLink = document.getElementById("registrationLink").value || "#";
    const description = document.getElementById("description").value || "No description provided.";
    const highlights = document.getElementById("highlights").value.split(",").map(h => h.trim()).filter(h => h);

    // Format Date & Time
    let dateTimeString = "Date & Time not set";
    if (startDateValue && endDateValue) {
        const startDate = new Date(startDateValue);
        const endDate = new Date(endDateValue);
        dateTimeString = `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
    }

    // Format Entry Fee / Prize Pool
    const feePrizeString = `₹${entryFee} / ₹${prizePool} Prize Pool`;

    // Format Registration Deadline
    const deadlineString = registrationDeadlineValue ? new Date(registrationDeadlineValue).toLocaleString() : "No deadline";

    // Populate Modal
    eventModal.querySelector(".modal-banner").src = bannerImage;
    eventModal.querySelector(".modal-event-name").textContent = title;
    eventModal.querySelector(".modal-organizer").textContent = `Organized by: ${clubName}`;
    eventModal.querySelector(".modal-category").textContent = category;
    eventModal.querySelector(".modal-date-time").textContent = dateTimeString;
    eventModal.querySelector(".modal-location").textContent = venue;
    eventModal.querySelector(".modal-fee-prize").textContent = feePrizeString;
    eventModal.querySelector(".modal-team-size").textContent = teamSize;
    eventModal.querySelector(".modal-mode").textContent = mode;
    eventModal.querySelector(".modal-deadline").textContent = deadlineString;
    eventModal.querySelector(".modal-eligibility").textContent = eligibility;
    eventModal.querySelector(".modal-reg-link").href = registrationLink;
    eventModal.querySelector(".modal-description").textContent = description;

    const highlightsContainer = eventModal.querySelector(".highlights-container");
    highlightsContainer.innerHTML = "";
    if (highlights.length > 0) {
        highlights.forEach(h => {
            const badge = document.createElement("span");
            badge.className = "highlight-badge";
            badge.textContent = h;
            highlightsContainer.appendChild(badge);
        });
    } else {
        const noHighlights = document.createElement("p");
        noHighlights.textContent = "No highlights provided.";
        highlightsContainer.appendChild(noHighlights);
    }

    // Open Modal
    eventModal.classList.add("modal-open");
    document.body.classList.add("modal-open");
}

previewCard.addEventListener("click", populateAndOpenModal);

closeModalButton.addEventListener("click", () => {
    eventModal.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
});

window.addEventListener("click", (e) => {
    if (e.target === eventModal) {
        eventModal.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
    }
});