import { app, auth, db } from '../public/firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 1. Check 'admins' collection first
            const adminDocRef = doc(db, "admins", user.uid);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                const adminData = adminDocSnap.data();

                if (adminData.role !== 'admin') {
                    alert('You are not authorized to access the admin portal.');
                    return;
                }

                if (!adminData.isActive) {
                    alert('Your admin account is inactive. Please contact support.');
                    return;
                }

                // If all checks pass for 'admin', redirect and stop
                window.location.href = '../admin-events/admin.html';
                return;
            }

            // 2. If not in 'admins', check 'outletAdmins' collection
            const outletAdminDocRef = doc(db, "outletAdmins", user.uid);
            const outletAdminDocSnap = await getDoc(outletAdminDocRef);

            if (outletAdminDocSnap.exists()) {
                const outletAdminData = outletAdminDocSnap.data();

                // --- Assumption ---
                // This code assumes your 'outletAdmins' documents also have
                // 'role' and 'isActive' fields.
                // Please adjust these checks if your data structure is different.

                if (outletAdminData.role !== 'outletAdmin') {
                    alert('You are not authorized to access this portal.');
                    return;
                }

                if (!outletAdminData.isActive) {
                    alert('Your outlet admin account is inactive. Please contact support.');
                    return;
                }

                // If all checks pass for 'outletAdmin', redirect
                window.location.href = '../Outlet-Website- Food Homepage/adminFoodOutlet/index.html';
                return;
            }

            // 3. If user was not found in EITHER collection
            alert('You are not registered as an admin. Access denied.');

        } catch (error) {
            console.error("Error signing in:", error);
            // This error handles bad passwords or other sign-in failures
            alert('Invalid credentials. Please try again.');
        }
    });
});