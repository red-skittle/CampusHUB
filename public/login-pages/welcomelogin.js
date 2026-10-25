import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase config
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

// DOM Elements
const form = document.querySelector('.login-form');
const emailInput = document.getElementById('userEmail');
const passwordInput = document.getElementById('userPassword');
const loginBtn = document.querySelector('.btn-login');
const messageContainer = document.getElementById('messageContainer');

function showMessage(message, type = 'error') {
  messageContainer.innerHTML = `<div class="${type}-message message">${message}</div>`;
  messageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => messageContainer.innerHTML = '', 4000);
}

function clearMessage() { messageContainer.innerHTML = ''; }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();


  let email = emailInput.value.trim();
  email += '@muj.manipal.edu'
  console.log(email)
  const password = passwordInput.value.trim();
  if (!email.toLowerCase().endsWith('@muj.manipal.edu')) {
    showMessage('Please use your MUJ email address (@muj.manipal.edu)', 'error');
    return;
  }

  loginBtn.textContent = 'Signing In...';
  loginBtn.disabled = true;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Optional: Fetch additional data from Firestore
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        localStorage.setItem('campusHubUser', JSON.stringify({
          uid: user.uid,
          name: data.name,
          email: data.email
        }));
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }

    showMessage('Login successful!', 'success');

    setTimeout(() => {
      window.location.href = '../'; // Your homepage
    }, 1500);

  } catch (error) {
    console.error('Sign in error:', error);
    let errorMessage = 'Failed to sign in. Please try again.';
    switch (error.code) {
      case 'auth/invalid-email': errorMessage = 'Invalid email address.'; break;
      case 'auth/user-disabled': errorMessage = 'This account has been disabled.'; break;
      case 'auth/user-not-found': errorMessage = 'No account found with this email.'; break;
      case 'auth/wrong-password': errorMessage = 'Incorrect password.'; break;
      case 'auth/network-request-failed': errorMessage = 'Network error. Please check your internet connection.'; break;
    }
    showMessage(errorMessage, 'error');
  } finally {
    loginBtn.textContent = 'Log in';
    loginBtn.disabled = false;
  }
});



//remove @muj.manipal.edu
emailInput.addEventListener("input", () => {
  // remove "@gmail.com" or anything after '@'
  const atIndex = emailInput.value.indexOf("@");
  if (atIndex !== -1) {
    emailInput.value = emailInput.value.slice(0, atIndex);
  }
});

//hide password
const togglePassword = document.getElementById('togglePassword')

togglePassword.addEventListener('click',()=>{
  passwordInput.classList.toggle('showPass');

  if (passwordInput.classList.contains('showPass')){
    passwordInput.type = 'text'
    togglePassword.innerHTML = `<img src='../images/hidePass.png'>`

  }else{
    passwordInput.type = 'password'
    togglePassword.innerHTML = `<img src='../images/showPass.png'>`
  }
})