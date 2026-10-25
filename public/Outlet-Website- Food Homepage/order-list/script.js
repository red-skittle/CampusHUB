// === Firebase Configuration ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Use your actual Firebase config here
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


// === App State ===
let allOrders = []; // Will hold ONLY today's orders for this outlet
let filteredOrders = [];
let activeFilters = ["all"];
let currentPage = 1;
const ordersPerPage = 10;
let MANAGED_OUTLET_ID = null;

// === DOM Elements ===
const ordersTableBody = document.getElementById("ordersTableBody");
const filterBtn = document.getElementById("filterBtn");
const filterDropdown = document.getElementById("filterDropdown");
const searchInput = document.getElementById("searchInput");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageButtons = document.querySelectorAll(".page-number");

// === Initialization ===
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners(); // Setup button clicks right away

    // 1. Check for authenticated user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User logged in, fetching admin info...");
            // 2. Get their outletId
            const { outletId, role } = await fetchUserAndOutletInfo(user.uid);
            
            const allowedRoles = ['admin', 'outlet_manager', 'outletAdmin'];
            if (allowedRoles.includes(role) && outletId) {
                MANAGED_OUTLET_ID = outletId;
                console.log(`Admin role confirmed for outlet: ${MANAGED_OUTLET_ID}`);
                // 3. Load orders for *this* outlet and *this* date
                await loadOrdersFromFirestore(MANAGED_OUTLET_ID);
            } else {
                alert("Access Denied: You are not an authorized outlet admin.");
                console.error("Access Denied: Role or outletId not found.");
                ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Access Denied.</td></tr>`;
            }
        } else {
            alert("Please log in to view this page.");
            console.log("No user logged in.");
            // Optional: Redirect to login
            // window.location.href = '/login-pages/welcomelogin.html';
        }
    });
});

// === Helper function to get admin info ===
async function fetchUserAndOutletInfo(userId) {
    if (!userId) return { user: null, outletId: null, role: null };
    const userRef = doc(db, "outletAdmins", userId); 
    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                user: data,
                outletId: data.outletId || null, 
                role: data.role || 'student'
            };
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
  return { user: null, outletId: null, role: 'student' };
}


// === Fetch Orders from Firestore ===
async function loadOrdersFromFirestore(outletId) {
    if (!outletId) {
        console.error("Cannot load orders, outletId is missing.");
        return;
    }

    try {
        // 1. Create date range for "today"
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); // 00:00:00
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59); // 23:59:59

        // 2. Build the new query
        const q = query(
            collection(db, "orders"), 
            where("outletId", "==", outletId),       // Filter by outlet
            where("timestamp", ">=", startOfDay),    // Filter by date (start)
            where("timestamp", "<=", endOfDay),      // Filter by date (end)
            orderBy("timestamp", "desc")
        );
        
        const snapshot = await getDocs(q);

        // 3. Fix the data mapping
        allOrders = snapshot.docs.map(doc => {
            const data = doc.data();

            // Summarize the cart (like in the dashboard)
            const items = Object.values(data.cart || {});
            let itemSummary = items.length > 0 ? items[0].item.name : "No items";
            if (items.length > 1 || (items.length === 1 && items[0].quantity > 1)) {
                itemSummary += "...";
            }

            // Format the timestamp
            let orderTime = "N/A";
            if (data.timestamp && data.timestamp.toDate) {
                // Show time only, since we know it's today
                orderTime = data.timestamp.toDate().toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                });
            }

            return {
                id: doc.id.substring(0, 8), // Shorten ID
                timestamp: orderTime,           // Formatted time
                customer: data.userName || "Guest", // Correct field
                mobile: data.phone || "-",      // Correct field
                block: data.address || "-",     // Correct field
                item: itemSummary,              // Summarized cart
                price: data.totalAmount || 0,   // Correct field
                status: data.status || "TBD"
            };
        });

        console.log(`✅ Loaded ${allOrders.length} orders from today`);
        filteredOrders = [...allOrders];
        renderOrders();

    } catch (error) {
        console.error("❌ Error fetching orders:", error);
        // This is a common error if the index is missing
        if (error.code === 'failed-precondition') {
            ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;"><b>Error:</b> This query requires a Firestore Index. Please open the console (F12) and click the link in the error message to create it.</td></tr>`;
        } else {
            ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Failed to load orders: ${error.message}</td></tr>`;
        }
    }
}

// === Render Orders in Table ===
function renderOrders() {
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const ordersToShow = filteredOrders.slice(startIndex, endIndex);

    ordersTableBody.innerHTML = "";

    if (ordersToShow.length === 0) {
        ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No orders found for today</td></tr>`;
        updatePaginationInfo();
        return;
    }

    ordersToShow.forEach(order => {
        const statusClass =
            order.status === "TBD" ? "status-tbd" :
            order.status === "Placed" ? "status-placed" : // Added Placed
            order.status === "Processing" ? "status-accepted" : // Renamed Accepted
            order.status === "Canceled" ? "status-rejected" :
            "status-tbd"; // Default

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.timestamp}</td>
            <td>${order.customer}</td>
            <td>${order.mobile}</td>
            <td>${order.block}</td>
            <td><a href="#" class="item-link">${order.item}</a></td>
            <td>₹${order.price}</td>
            <td><span class="status-badge ${statusClass}">${order.status}</span></td>
        `;
        ordersTableBody.appendChild(row);
    });

    updatePaginationInfo();
}

// === Update Pagination Info ===
function updatePaginationInfo() {
    const startIndex = (currentPage - 1) * ordersPerPage + 1;
    const endIndex = Math.min(currentPage * ordersPerPage, filteredOrders.length);

    document.getElementById("showingCount").textContent = filteredOrders.length > 0 ? endIndex : 0;
    document.getElementById("totalCount").textContent = filteredOrders.length;

    pageButtons.forEach(btn => {
        btn.classList.remove("active");
        if (parseInt(btn.dataset.page) === currentPage) {
            btn.classList.add("active");
        }
    });

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= Math.ceil(filteredOrders.length / ordersPerPage);
}

// === Event Listeners ===
function setupEventListeners() {
    // Filter dropdown toggle
    if (filterBtn) {
        filterBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (filterDropdown) filterDropdown.classList.toggle("active");
        });
    }

    // Close dropdown on outside click
    document.addEventListener("click", e => {
        if (filterDropdown && !filterDropdown.contains(e.target) && e.target !== filterBtn) {
            filterDropdown.classList.remove("active");
        }
    });

    // Filter checkboxes
    if (filterDropdown) {
        filterDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener("change", handleFilterChange);
        });
    }

    // Search input
    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    // Pagination buttons
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderOrders();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (currentPage < Math.ceil(filteredOrders.length / ordersPerPage)) {
                currentPage++;
                renderOrders();
            }
        });
    }

    pageButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            currentPage = parseInt(this.dataset.page);
            renderOrders();
        });
    });

    // Promo Button
    const promoBtn = document.querySelector('.promo-btn');
    if (promoBtn) {
        promoBtn.addEventListener('click', () => {
            alert('Add Menus functionality coming soon!');
        });
    }
}

// === Handle Filter Changes ===
function handleFilterChange(e) {
    const value = e.target.value;
    const isChecked = e.target.checked;

    if (value === "all") {
        if (isChecked) {
            activeFilters = ["all"];
            filterDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.value !== "all") cb.checked = false;
            });
        }
    } else {
        const allCheckbox = filterDropdown.querySelector('input[value="all"]');
        allCheckbox.checked = false;

        if (isChecked) {
            activeFilters = activeFilters.filter(f => f !== "all");
            activeFilters.push(value);
        } else {
            activeFilters = activeFilters.filter(f => f !== value);
            if (activeFilters.length === 0) {
                activeFilters = ["all"];
                allCheckbox.checked = true;
            }
        }
    }

    applyFilters();
}

// === Apply Filters + Search ===
function applyFilters() {
    if (activeFilters.includes("all")) {
        filteredOrders = [...allOrders];
    } else {
        filteredOrders = allOrders.filter(order => activeFilters.includes(order.status));
    }

    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredOrders = filteredOrders.filter(order =>
            order.customer.toLowerCase().includes(searchTerm) ||
            order.mobile.includes(searchTerm) ||
            order.block.toLowerCase().includes(searchTerm) ||
            order.item.toLowerCase().includes(searchTerm) ||
            order.id.toString().includes(searchTerm)
        );
    }

    currentPage = 1;
    renderOrders();
}