// crypto-utils.js
// Client-side encryption/decryption utilities
// Include this file in both registration page and admin scanner

// Base64 URL encoding/decoding
function base64UrlEncode(str) {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(b64url) {
    b64url = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64url.length % 4) b64url += '=';
    return atob(b64url);
}

// Simple "encryption": JSON → Base64URL
function encryptData(payload) {
    try {
        const payloadStr = JSON.stringify(payload);
        return base64UrlEncode(payloadStr);
    } catch (err) {
        console.error('Failed to encrypt payload:', err);
        throw err;
    }
}

// Simple "decryption": Base64URL → JSON
function decryptData(token) {
    try {
        const payloadStr = base64UrlDecode(token);
        return JSON.parse(payloadStr);
    } catch (err) {
        console.error('Failed to decrypt token:', err);
        throw new Error('Invalid token or corrupted QR code');
    }
}
