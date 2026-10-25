// order-history.js - Fetch and display user's order history from Firebase

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

let currentUser = null;

document.addEventListener('DOMContentLoaded', function () {
    // UI Elements
    const signInButton = document.getElementById('sign-in-btn');
    const profileContainer = document.getElementById('profile-container');
    const signOutButton = document.getElementById('sign-out-btn');
    const orderListContainer = document.querySelector('.order-list-container');

    // Auth State Observer
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Show profile, hide sign in
            if (signInButton) signInButton.style.display = 'none';
            if (profileContainer) profileContainer.classList.remove('hidden');

            // Fetch and display orders
            await fetchAndDisplayOrders(user.uid);
        } else {
            currentUser = null;
            // Show sign in, hide profile
            if (signInButton) signInButton.style.display = 'block';
            if (profileContainer) profileContainer.classList.add('hidden');

            // Redirect to login if not authenticated
            window.location.href = '../login-pages/welcomelogin.html';
        }
    });

    // Sign In Button
    if (signInButton) {
        signInButton.addEventListener('click', () => {
            window.location.href = '../login-pages/welcomelogin.html';
        });
    }

    // Sign Out Button
    if (signOutButton) {
        signOutButton.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = './HomePage.html';
            } catch (error) {
                console.error("Sign out error:", error);
                alert("Failed to sign out. Please try again.");
            }
        });
    }

    // Profile dropdown toggle
    const profileIcon = document.getElementById('profile-icon');
    const profileDropdown = document.querySelector('.profile-dropdown');
    if (profileIcon && profileDropdown) {
        profileIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileContainer.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    // Search form redirect
    const searchForm = document.getElementById('header-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('header-search-input');
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `./searchResults.html?query=${encodeURIComponent(query)}`;
            }
        });
    }

    // Fetch and Display Orders
    async function fetchAndDisplayOrders(userId) {
        try {
            // Show loading state
            orderListContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #6b7280;">
                    <p style="font-size: 1.125rem;">Loading your orders...</p>
                </div>
            `;

            // Query orders collection for this user
            const ordersRef = collection(db, 'orders');
            const q = query(
                ordersRef,
                where('userId', '==', userId),
                orderBy('timestamp', 'desc')
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // No orders found
                orderListContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <svg style="width: 64px; height: 64px; margin: 0 auto 1rem; color: #d1d5db;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                        </svg>
                        <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 0.5rem;">No Orders Yet</h2>
                        <p style="color: #6b7280; margin-bottom: 1.5rem;">You haven't placed any orders yet. Start exploring our outlets!</p>
                        <a href="./HomePage.html" style="display: inline-block; padding: 0.75rem 1.5rem; background: #dc2626; color: white; border-radius: 6px; font-weight: 500; text-decoration: none;">Browse Outlets</a>
                    </div>
                `;
                return;
            }

            // Clear loading state
            orderListContainer.innerHTML = '';

            // Process and display each order
            querySnapshot.forEach((doc) => {
                const orderData = doc.data();
                const orderCard = createOrderCard(doc.id, orderData);
                orderListContainer.appendChild(orderCard);
            });

        } catch (error) {
            console.error("Error fetching orders:", error);
            orderListContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <p style="color: #dc2626; font-weight: 500; margin-bottom: 0.5rem;">Failed to load orders</p>
                    <p style="color: #6b7280;">Please try refreshing the page</p>
                </div>
            `;
        }
    }

    // Create Order Card HTML
    function createOrderCard(orderId, orderData) {
        const card = document.createElement('div');
        card.className = 'order-card';

        // Format date
        const orderDate = orderData.timestamp?.toDate ? 
            orderData.timestamp.toDate().toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            }) : 
            'Date unavailable';

        // Format time
        const orderTime = orderData.timestamp?.toDate ? 
            orderData.timestamp.toDate().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 
            '';

        // Get status badge class
        const statusClass = getStatusClass(orderData.status);
        const statusText = orderData.status || 'Processing';

        // Build items list
        let itemsHTML = '';
        let itemCount = 0;
        if (orderData.cart) {
            for (const [itemId, itemData] of Object.entries(orderData.cart)) {
                const quantity = itemData.quantity || 1;
                const itemName = itemData.item?.name || itemId;
                const itemPrice = itemData.item?.price?.price || 0;
                const totalItemPrice = itemPrice * quantity;
                itemCount += quantity;

                itemsHTML += `
                    <li class="order-item">
                        <span class="order-item-name">${quantity} x ${itemName}</span>
                        <span class="order-item-price">₹${totalItemPrice.toFixed(2)}</span>
                    </li>
                `;
            }
        }

        // Card HTML
        card.innerHTML = `
            <div class="order-card-header">
                <div class="order-card-details">
                    <h2 class="order-card-title">${orderData.outletName || 'Unknown Outlet'}</h2>
                    <p class="order-card-date">Order placed on: ${orderDate} at ${orderTime}</p>
                    ${orderData.address ? `<p class="order-card-date" style="margin-top: 0.25rem;">📍 Delivery to: ${orderData.address}</p>` : ''}
                </div>
                <div class="order-card-status-price">
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                    <p class="order-card-price">₹${(orderData.totalAmount || 0).toFixed(2)}</p>
                </div>
            </div>

            <div class="order-card-body">
                <ul class="order-item-list">
                    ${itemsHTML}
                </ul>
                ${orderData.note ? `
                    <div style="margin-top: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 6px; border-left: 3px solid #dc2626;">
                        <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Note:</p>
                        <p style="font-size: 0.875rem; color: #374151;">${orderData.note}</p>
                    </div>
                ` : ''}
            </div>

            <div class="order-card-footer">
                <button class="btn btn-secondary view-details-btn" data-order-id="${orderId}">
                    View Details
                </button>
                ${statusText !== 'Cancelled' ? `
                    <button class="btn btn-primary reorder-btn" data-outlet-id="${orderData.outletId}" data-outlet-name="${orderData.outletName}">
                        Reorder
                    </button>
                ` : `
                    <button class="btn btn-disabled" disabled>
                        Reorder
                    </button>
                `}
            </div>
        `;

        // Add event listeners
        const viewDetailsBtn = card.querySelector('.view-details-btn');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', () => showOrderDetails(orderId, orderData));
        }

        const reorderBtn = card.querySelector('.reorder-btn');
        if (reorderBtn) {
            reorderBtn.addEventListener('click', () => handleReorder(orderData));
        }

        return card;
    }

    // Get status badge class
    function getStatusClass(status) {
        const statusLower = (status || '').toLowerCase();
        if (statusLower === 'delivered' || statusLower === 'completed') {
            return 'status-delivered';
        } else if (statusLower === 'cancelled' || statusLower === 'rejected') {
            return 'status-cancelled';
        } else {
            return 'status-pending';
        }
    }

    // Show Order Details Modal
    function showOrderDetails(orderId, orderData) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'order-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 1rem;
        `;

        // Format date and time
        const orderDate = orderData.timestamp?.toDate ? 
            orderData.timestamp.toDate().toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
            }) : 
            'Date unavailable';

        const orderTime = orderData.timestamp?.toDate ? 
            orderData.timestamp.toDate().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 
            '';

        // Build detailed items list
        let itemsHTML = '';
        if (orderData.cart) {
            for (const [itemId, itemData] of Object.entries(orderData.cart)) {
                const quantity = itemData.quantity || 1;
                const item = itemData.item || {};
                const itemName = item.name || itemId;
                const itemPrice = item.price?.price || 0;
                const category = item.category || '';
                const totalItemPrice = itemPrice * quantity;

                itemsHTML += `
                    <div style="display: flex; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="flex: 1;">
                            <p style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">${itemName}</p>
                            ${category ? `<p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">${category}</p>` : ''}
                            <p style="font-size: 0.875rem; color: #6b7280;">Quantity: ${quantity} × ₹${itemPrice.toFixed(2)}</p>
                        </div>
                        <div style="font-weight: 600; color: #111827;">
                            ₹${totalItemPrice.toFixed(2)}
                        </div>
                    </div>
                `;
            }
        }

        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <div style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; background: white; z-index: 10;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Order Details</h2>
                        <button class="close-modal-btn" style="background: none; border: none; font-size: 1.5rem; color: #6b7280; cursor: pointer; padding: 0.25rem; line-height: 1;">&times;</button>
                    </div>
                </div>
                
                <div style="padding: 1.5rem;">
                    <!-- Order Info -->
                    <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <div style="display: grid; gap: 0.75rem;">
                            <div>
                                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Order ID</p>
                                <p style="font-weight: 600; color: #111827; font-family: monospace; font-size: 0.875rem;">${orderId}</p>
                            </div>
                            <div>
                                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Outlet</p>
                                <p style="font-weight: 600; color: #111827;">${orderData.outletName || 'Unknown'}</p>
                            </div>
                            <div>
                                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Order Date & Time</p>
                                <p style="font-weight: 600; color: #111827;">${orderDate} at ${orderTime}</p>
                            </div>
                            <div>
                                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Delivery Address</p>
                                <p style="font-weight: 600; color: #111827;">${orderData.address || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Contact</p>
                                <p style="font-weight: 600; color: #111827;">${orderData.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Status</p>
                                <span class="status-badge ${getStatusClass(orderData.status)}" style="display: inline-flex;">
                                    ${orderData.status || 'Processing'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Items -->
                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 1rem;">Order Items</h3>
                        <div>
                            ${itemsHTML}
                        </div>
                    </div>

                    ${orderData.note ? `
                        <div style="margin-bottom: 1.5rem; padding: 1rem; background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b;">
                            <p style="font-size: 0.875rem; font-weight: 600; color: #92400e; margin-bottom: 0.5rem;">Special Instructions:</p>
                            <p style="font-size: 0.875rem; color: #78350f;">${orderData.note}</p>
                        </div>
                    ` : ''}

                    <!-- Total -->
                    <div style="border-top: 2px solid #e5e7eb; padding-top: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <p style="font-size: 1.25rem; font-weight: 700; color: #111827;">Total Amount</p>
                            <p style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">₹${(orderData.totalAmount || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // Handle Reorder
    function handleReorder(orderData) {
        if (!orderData.outletId) {
            alert('Cannot reorder: Outlet information not available');
            return;
        }

        // Redirect to outlet menu page
        window.location.href = `./menu.html?outlet=${orderData.outletId}`;
    }
});
