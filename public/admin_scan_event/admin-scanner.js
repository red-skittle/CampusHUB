// admin-scanner.js
const firebaseConfig = {
    apiKey: "AIzaSyBvIrk1TWKjOumhNJFeMafBry8151eB3Gw",
    authDomain: "campushub-muj2.firebaseapp.com",
    databaseURL: "https://campushub-muj2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "campushub-muj2",
    storageBucket: "campushub-muj2.firebasestorage.app",
    messagingSenderId: "1041313599870",
    appId: "1:1041313599870:web:039738bd5602fbf643e32f",
    measurementId: "G-QSSJ1KVLMK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let video, canvas, context;
let scanning = false;
let lastScannedCode = null;
let lastScanTime = 0;
const SCAN_COOLDOWN = 3000; // 3 seconds between scans

// Stats
let stats = {
    total: 0,
    success: 0,
    duplicate: 0
};

// Initialize
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/login.html'; // Redirect to your login page
        return;
    }

    // Check if user is admin
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        alert('❌ Access Denied: Admin privileges required');
        auth.signOut();
        return;
    }

    document.getElementById('userInfo').textContent = `Logged in as: ${user.email}`;
    loadEvents();
});

async function loadEvents() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // Get admin's club ID
        const userDoc = await db.collection('admins').doc(user.uid).get();
        const adminClubId = userDoc.data().clubId;

        if (!adminClubId) {
            showStatus('❌ No club assigned to this admin', 'error');
            return;
        }

        // Query events by clubId and status
        const eventsSnapshot = await db.collection('events')
            .where('clubId', '==', adminClubId)
            .where('status', 'in', ['Upcoming', 'Ongoing'])
            .get();

        const eventSelect = document.getElementById('eventSelect');
        eventSelect.innerHTML = '<option value="">-- Select an event --</option>';

        // Collect events and sort alphabetically by title
        const events = [];
        eventsSnapshot.forEach(doc => {
            const event = doc.data();
            events.push({
                id: doc.id,
                title: event.title
            });
        });

        // Sort alphabetically by title
        events.sort((a, b) => a.title.localeCompare(b.title));

        // Populate dropdown
        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.title;
            eventSelect.appendChild(option);
        });

        if (events.length === 0) {
            showStatus('ℹ️ No upcoming/ongoing events for your club', 'info');
        }

    } catch (error) {
        console.error('Error loading events:', error);
        showStatus('❌ Failed to load events', 'error');
    }
}
async function startScanning() {
    const eventId = document.getElementById('eventSelect').value;
    if (!eventId) {
        showStatus('⚠️ Please select an event first', 'warning');
        setTimeout(() => {
            document.getElementById('statusMessage').style.display = 'none';
        }, 2000);
        return;
    }

    document.getElementById('loading').style.display = 'block';
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stats').style.display = 'grid';

    try {
        video = document.getElementById('video');
        canvas = document.getElementById('canvas');
        context = canvas.getContext('2d');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;
        video.setAttribute('playsinline', true);

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('videoContainer').classList.remove('hidden');
            document.getElementById('startBtn').classList.add('hidden');
            document.getElementById('stopBtn').classList.remove('hidden');

            scanning = true;
            requestAnimationFrame(scanFrame);
        };

    } catch (error) {
        console.error('Camera error:', error);
        showStatus('❌ Camera access denied', 'error');
        document.getElementById('loading').style.display = 'none';
        document.getElementById('startBtn').disabled = false;
    }
}
function pauseScanning(duration = 3000) {
    scanning = false;
    console.log(`⏸️ Pausing scanning for ${duration / 1000} seconds...`);
    setTimeout(() => {
        if (video && video.srcObject) {
            scanning = true;
            console.log('▶️ Resuming scanning...');
            requestAnimationFrame(scanFrame);
        }
    }, duration);
}
function stopScanning() {
    scanning = false;
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    document.getElementById('videoContainer').classList.add('hidden');
    document.getElementById('startBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    document.getElementById('startBtn').disabled = false;
}

function scanFrame() {
    if (!scanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            const now = Date.now();
            if (code.data !== lastScannedCode || now - lastScanTime > SCAN_COOLDOWN) {
                lastScannedCode = code.data;
                lastScanTime = now;
                processQRCode(code.data);
            }
        }
    }

    requestAnimationFrame(scanFrame);
}async function processQRCode(token) {
    console.log('Processing QR code:', token);
    try {
        showStatus('⏳ Verifying ticket...', 'info');
        stats.total++;
        updateStats();

        // 1️⃣ Decode Base64 QR payload
        let decryptedData;
        try {
            // Decode Base64 -> handle Unicode safely
            const jsonStr = decodeURIComponent(escape(atob(token)));
            decryptedData = JSON.parse(jsonStr);
        } catch (err) {
            console.error('Failed to decode QR token:', err);
            throw new Error('Invalid token or corrupted QR code');
        }
        console.log('Decrypted data:', decryptedData);

        const { userId, eventId, timestamp } = decryptedData;

        // 2️⃣ Validate data
        if (!userId || !eventId) {
            throw new Error('Invalid QR code format');
        }
        console.log('Data validated successfully.');

        // 3️⃣ Check if QR is for selected event
        const selectedEventId = document.getElementById('eventSelect').value;
        console.log(`Comparing event IDs: QR Code Event ID (${eventId}) vs Selected Event ID (${selectedEventId})`);
        if (eventId !== selectedEventId) {
            showStatus('❌ Wrong Event\nQR Code', 'error');
            playBeep('error');
            pauseScanning(2000);
            setTimeout(() => {
                document.getElementById('statusMessage').style.display = 'none';
            }, 2000);
            return;
        }
        console.log('Event ID match.');

        // 4️⃣ Query registration document
        const registrationDocId = `${userId}_${eventId}`;
        console.log('Querying registration document:', registrationDocId);
        const registrationRef = db.collection('registrations').doc(registrationDocId);
        const registrationDoc = await registrationRef.get();

        // 5️⃣ Check if registration exists
        if (!registrationDoc.exists) {
            console.log('Registration document not found.');
            showStatus('❌ Registration\nNot Found', 'error');
            playBeep('error');
            pauseScanning(2000);
            setTimeout(() => {
                document.getElementById('statusMessage').style.display = 'none';
            }, 2000);
            return;
        }
        console.log('Registration document found.');

        const registrationData = registrationDoc.data();
        console.log('Registration data:', registrationData);

        // 6️⃣ Check if already checked in
        if (registrationData.checkedIn) {
            console.log('User already checked in.');
            stats.duplicate++;
            updateStats();
            const checkedInTime = registrationData.checkedInAt?.toDate();
            const timeStr = checkedInTime ? checkedInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Earlier';
            showStatus(
                `⚠️ Already Checked In\nat ${timeStr}`,
                'warning'
            );
            playBeep('error');
            pauseScanning(2000);
            setTimeout(() => {
                document.getElementById('statusMessage').style.display = 'none';
            }, 2000);
            return;
        }
        console.log('User not checked in yet.');

        // 7️⃣ Grant entry - update registration
        const adminUserId = auth.currentUser.uid;
        const checkInTime = firebase.firestore.Timestamp.now();
        console.log('Updating registration document with check-in info...');
        await registrationRef.update({
            checkedIn: true,
            checkedInAt: checkInTime,
            checkedInBy: adminUserId
        });
        console.log('Registration document updated.');

        // // 8️⃣ Create entry log (audit trail)
        // console.log('Creating entry log...');
        // await db.collection('entryLogs').add({
        //     eventId,
        //     userId,
        //     qrToken: token,
        //     checkedInAt: checkInTime,
        //     checkedInBy: adminUserId
        // });
        // console.log('Entry log created.');

        // 9️⃣ Success
        stats.success++;
        updateStats();
        showStatus('✅ Entry Granted\nWelcome!', 'success');
        playBeep('success');

        pauseScanning(3000); // pause for 3 seconds
        // Hide status after 2.5 seconds
        setTimeout(() => {
            document.getElementById('statusMessage').style.display = 'none';
        }, 2500);

    } catch (error) {
        console.error('QR processing error:', error);
        showStatus('❌ Invalid QR Code', 'error');
        playBeep('error');
        pauseScanning(2000);
        setTimeout(() => {
            document.getElementById('statusMessage').style.display = 'none';
        }, 2000);
    }
}


function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message status-${type}`;
    statusDiv.style.display = 'flex';
}

function playBeep(type) {
    // Haptic feedback (vibration) for mobile devices
    if ('vibrate' in navigator) {
        if (type === 'success') {
            navigator.vibrate([100, 50, 100]); // Double vibration for success
        } else {
            navigator.vibrate(200); // Single long vibration for error
        }
    }

    // Audio feedback
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'success') {
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } else {
            oscillator.frequency.value = 300;
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    } catch (err) {
        console.log('Audio feedback not available');
    }
}

function updateStats() {
    document.getElementById('totalScans').textContent = stats.total;
    document.getElementById('successScans').textContent = stats.success;
    document.getElementById('duplicateScans').textContent = stats.duplicate;
}

function resetStats() {
    stats = { total: 0, success: 0, duplicate: 0 };
    updateStats();
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        stopScanning();
        auth.signOut();
    }
}
