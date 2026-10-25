// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Your Firebase configuration
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

// Get form elements
const forgotPasswordForm = document.querySelector('.login-form');
const emailInput = document.getElementById('userEmail');

// Function to show notification
function showNotification(message, type = 'success') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="ph-bold ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Function to validate email
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Function to set loading state
function setLoadingState(isLoading) {
    const submitBtn = forgotPasswordForm.querySelector('.btn-login');
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph-bold ph-spinner"></i> Sending...';
        submitBtn.classList.add('loading');
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Reset Link';
        submitBtn.classList.remove('loading');
    }
}

// Handle form submission
forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    // Validate email
    if (!email) {
        showNotification('Please enter your email address', 'error');
        emailInput.focus();
        return;
    }
    
    if (!validateEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        emailInput.focus();
        return;
    }
    
    // Set loading state
    setLoadingState(true);
    
    try {
        // Send password reset email
        await sendPasswordResetEmail(auth, email);
        
        // Show success message
        showNotification('Password reset link sent! Check your email inbox.', 'success');
        
        // Clear the form
        emailInput.value = '';
        
        // Optionally redirect to login page after 3 seconds
        setTimeout(() => {
            window.location.href = '../login-pages/welcomelogin.html';
        }, 3000);
        
    } catch (error) {
        console.error('Password reset error:', error);
        
        // Handle specific errors
        let errorMessage = 'An error occurred. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format';
                break;
            case 'auth/user-not-found':
                // For security, don't reveal if user exists
                errorMessage = 'If this email exists, a reset link has been sent';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many attempts. Please try again later';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Check your connection';
                break;
            case 'auth/invalid-action-code':
                errorMessage = 'Reset link expired. Request a new one';
                break;
            default:
                errorMessage = error.message || 'Failed to send reset link';
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        setLoadingState(false);
    }
});

// Add input validation on blur
emailInput.addEventListener('blur', () => {
    const email = emailInput.value.trim();
    if (email && !validateEmail(email)) {
        emailInput.classList.add('error');
    } else {
        emailInput.classList.remove('error');
    }
});

// Remove error state on input
emailInput.addEventListener('input', () => {
    emailInput.classList.remove('error');
});