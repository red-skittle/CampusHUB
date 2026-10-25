import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBvIrk1TWKjOumhNJFeMafBry8151eB3Gw",
    authDomain: "campushub-muj2.firebaseapp.com",
    projectId: "campushub-muj2",
    storageBucket: "campushub-muj2.firebasestorage.app",
    messagingSenderId: "1041313599870",
    appId: "1:1041313599870:web:039738bd5602fbf643e32f",
    measurementId: "G-QSSJ1KVLMK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let allOrders = []; 
let filteredOrders = [];
let activeFilter = "all";
let currentPage = 1;
const ordersPerPage = 10;
let MANAGED_OUTLET_ID = null;


const ordersTableBody = document.getElementById("orderTableBody"); 
const filterBtn = document.querySelector(".filter-btn"); 
const filterDropdown = document.getElementById("statusFilter-list"); 
const searchInput = document.querySelector(".search-bar input"); 
const prevBtn = document.getElementById("prevButton"); 
const nextBtn = document.getElementById("nextButton"); 
const pageNumbersContainer = document.getElementById("pageNumbers"); 
const paginationInfo = document.getElementById("paginationInfo"); 
const outletAdminName = document.getElementById("outletAdminName"); 


document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners(); 

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User logged in, fetching admin info...");
            const { userData, outletId, role } = await fetchUserAndOutletInfo(user.uid);
            
            const allowedRoles = ['admin', 'outlet_manager', 'outletAdmin'];
            if (allowedRoles.includes(role) && outletId) {
                MANAGED_OUTLET_ID = outletId;
                if(outletAdminName) outletAdminName.textContent = userData?.name || outletId; 
                console.log(`Admin role confirmed for outlet: ${MANAGED_OUTLET_ID}`);
                await loadOrdersFromFirestore(MANAGED_OUTLET_ID);
            } else {
                alert("Access Denied: You are not an authorized outlet admin.");
                console.error("Access Denied: Role or outletId not found.");
                if(ordersTableBody) ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Access Denied.</td></tr>`;
            }
        } else {
            alert("Please log in to view this page.");
            console.log("No user logged in.");
        }
    });
});


async function fetchUserAndOutletInfo(userId) {
    if (!userId) return { userData: null, outletId: null, role: null };
    const userRef = doc(db, "outletAdmins", userId); 
    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                userData: data, 
                outletId: data.outletId || null, 
                role: data.role || 'student'
            };
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
  return { userData: null, outletId: null, role: 'student' };
}



async function loadOrdersFromFirestore(outletId) {
    if (!outletId) {
        console.error("Cannot load orders, outletId is missing.");
        return;
    }

    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); 
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59); 

        const q = query(
            collection(db, "orders"), 
            where("outletId", "==", outletId),       
            where("timestamp", ">=", startOfDay),    
            where("timestamp", "<=", endOfDay),      
            orderBy("timestamp", "desc")
        );
        
        const snapshot = await getDocs(q);

        allOrders = snapshot.docs.map(doc => {
            const data = doc.data();

            const items = Object.values(data.cart || {});
            let itemSummary = items.length > 0 ? items[0].item.name : "No items";
            if (items.length > 1 || (items.length === 1 && items[0].quantity > 1)) {
                itemSummary += "...";
            }

            let orderTime = "N/A";
            if (data.timestamp && data.timestamp.toDate) {
                orderTime = data.timestamp.toDate().toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                });
            }

            return {
                id: doc.id.substring(0, 8), 
                timestamp: orderTime,           
                customer: data.userName || "Guest", 
                mobile: data.phone || "-",      
                block: data.address || "-",     
                item: itemSummary,              
                price: data.totalAmount || 0,   
                status: data.status || "TBD"
            };
        });

        console.log(`✅ Loaded ${allOrders.length} orders from today`);
        applyFilters(); 

    } catch (error) {
        console.error("❌ Error fetching orders:", error);
        if (error.code === 'failed-precondition') {
            if(ordersTableBody) ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;"><b>Error:</b> This query requires a Firestore Index. Please open the console (F12) and click the link in the error message to create it.</td></tr>`;
        } else {
            if(ordersTableBody) ordersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Failed to load orders: ${error.message}</td></tr>`;
        }
    }
}


function renderOrders() {
    if (!ordersTableBody) return; 
    
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
            order.status === "Placed" ? "status-placed" : 
            order.status === "Processing" ? "status-accepted" : 
            order.status === "Canceled" ? "status-rejected" :
            "status-tbd"; 

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


function updatePaginationInfo() {
    if (!paginationInfo || !pageNumbersContainer || !prevBtn || !nextBtn) return;

    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage + 1;
    const endIndex = Math.min(currentPage * ordersPerPage, filteredOrders.length);

    if (filteredOrders.length > 0) {
        paginationInfo.textContent = `showing ${startIndex}-${endIndex} from ${filteredOrders.length} data..`;
    } else {
        paginationInfo.textContent = "showing 0 from 0 data..";
    }

    pageNumbersContainer.innerHTML = ""; 
    
    if (totalPages <= 1) {
        prevBtn.classList.add("disabled");
        nextBtn.classList.add("disabled");
        return; 
    }

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("a");
        btn.href = "#";
        btn.textContent = i;
        btn.dataset.page = i;
        btn.classList.add("page-number"); 
        if (i === currentPage) {
            btn.classList.add("active");
        }
        pageNumbersContainer.appendChild(btn);
    }

    if (currentPage === 1) {
        prevBtn.classList.add("disabled");
    } else {
        prevBtn.classList.remove("disabled");
    }

    if (currentPage === totalPages) {
        nextBtn.classList.add("disabled");
    } else {
        nextBtn.classList.remove("disabled");
    }
}


function setupEventListeners() {
    if (filterBtn) {
        filterBtn.addEventListener("click", e => {
            e.stopPropagation();
            if (filterDropdown) filterDropdown.classList.toggle("active");
        });
    }

    document.addEventListener("click", e => {
        if (filterDropdown && !filterDropdown.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) {
            filterDropdown.classList.remove("active");
        }
    });

    if (filterDropdown) {
        filterDropdown.addEventListener("click", handleFilterChange);
    }

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                renderOrders();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderOrders();
            }
        });
    }

    if (pageNumbersContainer) {
        pageNumbersContainer.addEventListener("click", function(e) {
            e.preventDefault();
            if (e.target.classList.contains("page-number")) {
                currentPage = parseInt(e.target.dataset.page);
                renderOrders();
            }
        });
    }

    const promoBtn = document.querySelector('.promo-btn');
    if (promoBtn) {
        promoBtn.addEventListener('click', () => {
            alert('Add Menus functionality coming soon!');
        });
    }
}


function handleFilterChange(e) {
    if (e.target.tagName !== 'LI') return;

    const value = e.target.dataset.value;
    if (!value) return;

    filterDropdown.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    e.target.classList.add('selected');

    const selectedText = e.target.textContent;
    if(filterBtn) filterBtn.querySelector('.selected-option-text').textContent = selectedText;
    
    activeFilter = value; 

    if(filterDropdown) filterDropdown.classList.remove("active");

    applyFilters();
}


function applyFilters() {
    if (activeFilter === "all") {
        filteredOrders = [...allOrders];
    } else {
        filteredOrders = allOrders.filter(order => order.status === activeFilter);
    }

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
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