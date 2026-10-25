// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const QRCode = require('qrcode');

admin.initializeApp();
const db = admin.firestore();

// SECRET must be set via functions config (see below)
const SECRET = functions.config().qr?.secret || process.env.QR_SECRET;
if (!SECRET) {
  console.warn("QR secret not configured — set `firebase functions:config:set qr.secret=\"YOUR_SECRET\"`");
}

function base64UrlEncode(bufferOrStr) {
  const buf = Buffer.isBuffer(bufferOrStr) ? bufferOrStr : Buffer.from(bufferOrStr);
  return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/, '');
}



exports.generateEventQRCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const userId = context.auth.uid;
  const eventId = data.eventId;
  if (!eventId) throw new functions.https.HttpsError('invalid-argument', 'Missing eventId.');

  // Fetch event
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) throw new functions.https.HttpsError('not-found', 'Event not found.');

  const eventData = eventSnap.data();
  const fee = Number(eventData.entryFee || 0);
  if (fee > 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Paid events require payment.');
  }

  // compact payload
  const payload = { userId, eventId, iat: Date.now() };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadStr);

  // sign (HMAC SHA256)
  const signature = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('hex');
  const token = `${payloadB64}.${signature}`;

  // create QR data URL
  const qrDataUrl = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1 });

  // Write server-side registration (admin sdk bypasses rules)
  const userRegRef = db.collection('users').doc(userId).collection('registeredEvents').doc(eventId);
  await userRegRef.set({
    eventId,
    qrToken: token,
    registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    eventTitle: eventData.title || null
  }, { merge: true });

  // registration lookup
  const regsRef = db.collection('registrations').doc(token);
  await regsRef.set({
    userId, eventId, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { qrDataUrl };
});

function base64UrlDecode(b64url) {
    b64url = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64url.length % 4) b64url += '=';
    return Buffer.from(b64url, 'base64').toString();
}

exports.verifyEventQR = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { qrToken, eventId } = data;

    if (!qrToken || !eventId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing qrToken or eventId.');
    }

    try {
        // Parse and verify the QR token
        const parts = qrToken.split('.');
        if (parts.length !== 2) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid QR code format.');
        }

        const [payloadB64, signature] = parts;

        // Verify signature
        const expectedSignature = crypto.createHmac('sha256', SECRET)
            .update(payloadB64)
            .digest('hex');

        if (signature !== expectedSignature) {
            throw new functions.https.HttpsError('permission-denied', 'Invalid QR code signature.');
        }

        // Decode payload
        const payloadStr = base64UrlDecode(payloadB64);
        const payload = JSON.parse(payloadStr);

        const { userId, eventId: qrEventId, iat } = payload;

        // Verify event ID matches
        if (qrEventId !== eventId) {
            return {
                success: false,
                message: 'QR code is for a different event.',
                userData: null
            };
        }

        // Check if QR is too old (optional: 24 hours validity)
        const qrAge = Date.now() - iat;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (qrAge > maxAge) {
            return {
                success: false,
                message: 'QR code has expired.',
                userData: null
            };
        }

        // Check if registration exists
        const registrationRef = db.collection('registrations').doc(qrToken);
        const regDoc = await registrationRef.get();

        if (!regDoc.exists) {
            return {
                success: false,
                message: 'Registration not found.',
                userData: null
            };
        }

        const regData = regDoc.data();

        // Check if already checked in
        if (regData.checkedIn) {
            // Get user data
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            return {
                success: false,
                message: 'This QR code has already been used for entry.',
                alreadyCheckedIn: true,
                userData: {
                    userId: userId,
                    name: userData.name || userData.displayName,
                    email: userData.email,
                    checkedInAt: regData.checkedInAt?.toDate()
                }
            };
        }

        // Mark as checked in
        await registrationRef.update({
            checkedIn: true,
            checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
            checkedInBy: context.auth.uid
        });

        // Get user data
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Log the entry
        await db.collection('entryLogs').add({
            eventId: eventId,
            userId: userId,
            qrToken: qrToken,
            checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
            checkedInBy: context.auth.uid
        });

        return {
            success: true,
            message: 'Entry granted successfully!',
            alreadyCheckedIn: false,
            userData: {
                userId: userId,
                name: userData.name || userData.displayName,
                email: userData.email
            }
        };

    } catch (error) {
        console.error('Error verifying QR:', error);
        throw new functions.https.HttpsError('internal', 'Error verifying QR code.');
    }
});