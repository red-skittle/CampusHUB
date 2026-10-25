import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import { getGroupedCart,/*setupCartDropdownToggle*/ } from "./func.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvIrk1TWKjOumhNJFeMafBry8151eB3Gw",
  authDomain: "campushub-muj2.firebaseapp.com",
  databaseURL: "https://campushub-muj2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "campushub-muj2",
  storageBucket: "campushub-muj2.appspot.com",
  messagingSenderId: "1041313599870",
  appId: "1:1041313599870:web:039738bd5602fbf643e32f",
  measurementId: "G-QSSJ1KVLMK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let cart = JSON.parse(localStorage.getItem('userCart')) || {};

// --- INSTANT UI UPDATE FROM LOCALSTORAGE ---
const cachedAuthState = localStorage.getItem('campusHubAuthState');
if (cachedAuthState === 'loggedIn') {
    const headerSignInButton = document.getElementById('sign-in-btn');
    const headerProfileIcon = document.getElementById('profile-icon');
    if (headerSignInButton) headerSignInButton.textContent = 'Sign Out';
    if (headerProfileIcon) headerProfileIcon.classList.remove('hidden');
} else if (cachedAuthState === 'loggedOut') {
    const headerSignInButton = document.getElementById('sign-in-btn');
    const headerProfileIcon = document.getElementById('profile-icon');
    if (headerSignInButton) headerSignInButton.textContent = 'Sign In';
    if (headerProfileIcon) headerProfileIcon.classList.add('hidden');
}

function displayCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    const totalPriceElement = document.getElementById('total-price');
  
    cartItemsContainer.innerHTML = '';
  
    const cartItems = Object.values(cart); 
  
    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
      totalPriceElement.textContent = '₹0';
      return;
    }
  
    let total = 0;
    cartItems.forEach(({ item, quantity }) => { 
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('cart-item');
  
      const itemPrice = item.price.displayPrice || 0; 
  
      itemDiv.innerHTML = `
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          <p>₹${itemPrice} × ${quantity}</p>
        </div>
      `;
  
      cartItemsContainer.appendChild(itemDiv);
      total += itemPrice * quantity;
    });
  
    totalPriceElement.textContent = `₹${total}`;
  }

  function displayCarts(){
    const groupedCart = getGroupedCart()
        let cartsHtml = ''
        let urlParams = new URLSearchParams(window.location.search);
        let outletName = urlParams.get('outlet');
        if((Object.keys(getGroupedCart()).length <= 1)){
            if (Object.keys(getGroupedCart()).length == 1) outletName = Object.entries(groupedCart)[0][0];
            cartLinkContainerA.href = `checkout.html?outlet=${outletName}`
            
            }
        
        
        Object.entries(groupedCart).forEach(([restaurant, items]) => {
            cartsHtml += `<a href='checkout.html?outlet=${restaurant}' <button id="restorant-cart-btn" class="btn btn-dark btn-small">${restaurant}</button></a>`
      });
      cartDropdown.innerHTML = cartsHtml
      }

window.addEventListener('DOMContentLoaded',()=>{
    // setupCartDropdownToggle(cartLinkContainer,cartDropdown);
    displayCarts()

    urlParams = new URLSearchParams(window.location.search);
    outletName = urlParams.get('outlet');
});

let currentUser = null; 
let isOtpVerified = true;
let orderTimerId = null; 
let cancellationTimerId = null; 

const cartItemsContainer = document.getElementById('cart-items-summary-container');
const cartItemCountEl = document.getElementById('cart-item-count-summary');
const billItemTotalEl = document.getElementById('bill-item-total');
const billDeliveryFeeEl = document.getElementById('bill-delivery-fee');
const billTaxesEl = document.getElementById('bill-taxes');
const billTotalEl = document.getElementById('bill-total');
const addressSelect = document.getElementById('address-select'); 
const placeOrderBtn = document.getElementById('proceed-to-payment-btn');
const cartProfileIconContainer = document.getElementById('cart-profile-icon-container');
const phoneNumberInput = document.getElementById('phone-number-input');
const useSavedPhoneCheck = document.getElementById('use-saved-phone');
const emailInput = document.getElementById('email-input');
const useSavedEmailCheck = document.getElementById('use-saved-email');
const sendOtpBtn = document.getElementById('send-otp-btn');
const otpSection = document.getElementById('otp-section');
const otpInput = document.getElementById('otp-input');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const otpStatusText = document.getElementById('otp-status-text');
const orderConfirmationPanel = document.getElementById('order-confirmation-panel');
const cancelOrderBtn = document.getElementById('cancel-order-btn');
const timerBarFill = document.getElementById('timer-bar-fill');
const modalOverlay = document.getElementById('modal-overlay');
const cancellationModal = document.getElementById('cancellation-modal');
const closeCancellationModalBtn = document.getElementById('close-cancellation-modal');
const cancellationOkBtn = document.getElementById('cancellation-ok-btn');
const customAddressDisplay = document.getElementById('custom-address-display');
const customAddressText = document.getElementById('custom-address-text');
const customAddressOptions = document.getElementById('custom-address-options');
const customSelectWrapper = document.querySelector('.custom-select-wrapper');
const checkoutNote = document.getElementById("checkout-note"); 
const cartLinkContainer = document.querySelector('.cart-link-container')
const cartLinkContainerA = document.querySelector('.cart-link-container a')
const cartDropdown = cartLinkContainer?cartLinkContainer.querySelector('.cart-link-dropdown') : null
let urlParams = ''
let outletName = ''

const addressOptions = [
    "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8",
    "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11",
];

function updateAuthUI() {
    console.log("Updating authentication UI...");
    const headerSignInButton = document.getElementById('sign-in-btn'); 
    const headerProfileIcon = document.getElementById('profile-icon'); 

    if (currentUser) {
        if (useSavedPhoneCheck && phoneNumberInput) {
            useSavedPhoneCheck.parentElement.classList.remove('hidden');
            useSavedPhoneCheck.checked = false;
            phoneNumberInput.value = '';
            useSavedPhoneCheck.onchange = () => {
                phoneNumberInput.value = useSavedPhoneCheck.checked ? (currentUser.phone || '') : '';
            };
        }
        if (useSavedEmailCheck && emailInput) {
            useSavedEmailCheck.parentElement.classList.remove('hidden');
            useSavedEmailCheck.checked = false;
            emailInput.value = '';
            useSavedEmailCheck.onchange = () => {
                emailInput.value = useSavedEmailCheck.checked ? (currentUser.email || '') : '';
            };
        }
        if (headerSignInButton) {
            headerSignInButton.textContent = 'Sign Out';
        }
        if (headerProfileIcon) headerProfileIcon.classList.remove('hidden');
        if (currentUser.address && addressSelect && addressOptions.includes(currentUser.address)) {
            addressSelect.value = currentUser.address;
            localStorage.setItem('selectedDeliveryAddress', currentUser.address);
        }
        updateCustomAddressDisplay(); 

        if (cartProfileIconContainer) {
            cartProfileIconContainer.innerHTML = `<img src="assets/user.png" alt="Profile" class="cart-profile-icon">`;
            cartProfileIconContainer.classList.remove('hidden');
        }
    } else {
        if (useSavedPhoneCheck) {
            useSavedPhoneCheck.parentElement.classList.add('hidden');
            useSavedPhoneCheck.checked = false;
            if (phoneNumberInput) phoneNumberInput.value = '';
        }
        if (useSavedEmailCheck) {
            useSavedEmailCheck.parentElement.classList.add('hidden');
            useSavedEmailCheck.checked = false;
            if (emailInput) emailInput.value = '';
        }
        if (headerSignInButton) {
            headerSignInButton.textContent = 'Sign In';
        }
        if (headerProfileIcon) headerProfileIcon.classList.add('hidden');
        
        const savedAddress = localStorage.getItem('selectedDeliveryAddress');
        if (addressSelect && addressOptions.includes(savedAddress)) {
            addressSelect.value = savedAddress;
        } else if (addressSelect) {
            addressSelect.value = "";
        }
        updateCustomAddressDisplay(); 
        
        if (cartProfileIconContainer) {
            cartProfileIconContainer.innerHTML = '';
            cartProfileIconContainer.classList.add('hidden');
        }
    }
}

async function loadCart() {
  console.log("Fetching cart...");
  try {
    const storedCart = localStorage.getItem("userCart");
    cart = storedCart ? JSON.parse(storedCart) : {};
    console.log("Loaded cart from localStorage:", cart);

    if (currentUser && Object.keys(cart).length > 0) {
        await saveCart();
    }

  } catch (err) {
    console.error("Error loading cart:", err);
    cart = {};
  }
}

async function saveCart() {
    try {
        localStorage.setItem('userCart', JSON.stringify(cart));
        
        if (currentUser) {
            const cartRef = doc(db, "carts", currentUser.uid);
            await setDoc(cartRef, cart, { merge: true }); 
            console.log("Cart saved to Firestore.");
        }
    } catch (error) {
        console.error("Error saving cart:", error);
    }
}

async function clearCartForCurrentOutlet(outletName) {
    if (!outletName) {
        console.warn("clearCartForCurrentOutlet called without outletName");
        return;
    }
    
    cart = Object.fromEntries(
        Object.entries(cart).filter(([_, c]) => c.item && c.item.restaurant !== outletName)
    );
    
    localStorage.setItem('userCart', JSON.stringify(cart));
    
    try {
        if (currentUser) {
            const cartRef = doc(db, "carts", currentUser.uid);
            await setDoc(cartRef, cart); 
            console.log("Cart updated in Firestore.");
        }
    } catch (error) {
        console.error("Error updating Firestore cart:", error);
    }
    
    displayCheckoutCart(); 
}

function calculateBill() {
    const urlParams = new URLSearchParams(window.location.search);
    const outletName = urlParams.get('outlet');

    let itemTotal = 0;
    let totalItems = 0;
    const cartItems = Object.values(cart);
    const groupedCart = getGroupedCart(cartItems)

    Object.entries(groupedCart).forEach(([restaurant,items]) => {
        
        if(restaurant!=outletName){
            return;
            
        }
        console.log('webvfewty')
        console.log(items)
        items.forEach(({item,quantity})=>{
            if (item?.price?.displayPrice !== undefined && item.price.displayPrice !== null) {
            itemTotal += item.price.displayPrice * quantity; 
            totalItems += quantity;
            
        }
        })
        
    });

    console.log(itemTotal)

    const DELIVERY_FEE = (totalItems > 0) ? 10.00 : 0.00;
    const TAX_RATE = 0.05; 
    const taxes = itemTotal * TAX_RATE;
    const total = itemTotal + DELIVERY_FEE;

    if (cartItemCountEl) cartItemCountEl.textContent = `(${totalItems} ${totalItems === 1 ? 'Item' : 'Items'})`;
    if (billItemTotalEl) billItemTotalEl.textContent = `₹${itemTotal.toFixed(2)}`;
    if (billDeliveryFeeEl) billDeliveryFeeEl.textContent = `₹${DELIVERY_FEE.toFixed(2)}`;
    if (billTaxesEl) billTaxesEl.textContent = `₹${taxes.toFixed(2)}`;
    if (billTotalEl) billTotalEl.textContent = `₹${total.toFixed(2)}`;

    if (placeOrderBtn && !orderTimerId) {
        placeOrderBtn.disabled = totalItems === 0 || !isOtpVerified;
        if (totalItems === 0) {
            placeOrderBtn.textContent = 'Cart is Empty';
        } else if (!isOtpVerified) {
            placeOrderBtn.textContent = 'Verify Email to Proceed';
        } else {
            placeOrderBtn.textContent = 'Proceed To Payment';
        }
    }

    return { totalItems, itemTotal, total };
}

function displayCheckoutCart() {
    if (!cartItemsContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    // --- FIX: Get the "pretty" name directly. No normalizing. ---
    const outletName = urlParams.get('outlet');

    cartItemsContainer.innerHTML = '';
    const cartItems = Object.values(cart);

    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = '<p class="cart-empty-message" style="text-align: left; padding: 1rem 0;">Your cart is empty</p>';
        calculateBill();
        return;
    }

    const groupedCart = getGroupedCart(cartItems)
    
    console.log(groupedCart)

    Object.entries(groupedCart).forEach(([restaurantName, itemsFromRestaurant]) => {
        if(restaurantName!=outletName){
            return;
        }
        const groupHeader = document.createElement('h4');
        groupHeader.className = 'cart-group-header';
        groupHeader.innerHTML = `from <span class="text-primary">${restaurantName}</span>`;
        cartItemsContainer.appendChild(groupHeader);

        itemsFromRestaurant.forEach(({ item, quantity }) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checkout-cart-item';
            itemDiv.innerHTML = `
    <div class="item-info">
        <p class="checkout-item-name">${item.name}</p>
        <p class="checkout-item-price">₹${item.price.displayPrice.toFixed(2)}</p>    </div>
    <div class="checkout-quantity-selector">
        <button class="checkout-quantity-btn" data-item-id="${item.id}" data-action="decrease">－</button>
        <span>${quantity}</span>
        <button class="checkout-quantity-btn" data-item-id="${item.id}" data-action="increase">＋</button>
    </div>`;
            cartItemsContainer.appendChild(itemDiv);
        });

        const divider = document.createElement('hr');
        divider.className = 'cart-group-divider';
        cartItemsContainer.appendChild(divider);
    });
    const lastDivider = cartItemsContainer.querySelector('hr.cart-group-divider:last-of-type');
    if (lastDivider) lastDivider.remove();

    calculateBill();
}

function updateCustomAddressDisplay() {
    if (!addressSelect || !customAddressText || !customAddressOptions) return;
    const selectedOption = addressSelect.options[addressSelect.selectedIndex];
    const selectedValue = addressSelect.value;
    
    if (selectedValue && selectedValue !== "") {
        customAddressText.textContent = selectedOption.textContent;
        customAddressText.classList.remove('placeholder');
    } else {
        const placeholderOption = addressSelect.querySelector('option[disabled][selected]');
        customAddressText.textContent = placeholderOption ? placeholderOption.textContent : "Select an address";
        customAddressText.classList.add('placeholder');
    }
    const allOptions = customAddressOptions.querySelectorAll('li');
    allOptions.forEach(optionEl => {
        optionEl.classList.toggle('selected', optionEl.dataset.value === selectedValue);
    });
}

function populateAddressDropdown() {
    if (!addressSelect) return;
    if (customAddressOptions) customAddressOptions.innerHTML = ''; 

    addressSelect.innerHTML = '<option value="" disabled selected>Type or select address (e.g., B10)</option>'; 
    addressOptions.forEach(addr => {
        const option = document.createElement('option');
        option.value = addr;
        option.textContent = addr;
        addressSelect.appendChild(option);

        if (customAddressOptions) {
            const li = document.createElement('li');
            li.textContent = addr;
            li.dataset.value = addr;
            
            li.addEventListener('click', () => {
                addressSelect.value = addr;
                localStorage.setItem('selectedDeliveryAddress', addr);
                updateCustomAddressDisplay();
                customAddressOptions.classList.add('hidden');
                if (customSelectWrapper) customSelectWrapper.classList.remove('open');
            });
            customAddressOptions.appendChild(li);
        }
    });

    let currentAddress = '';
    if (currentUser && currentUser.address) {
        currentAddress = currentUser.address;
    } else {
        currentAddress = localStorage.getItem('selectedDeliveryAddress');
    }

    if (currentAddress && addressOptions.includes(currentAddress)) {
        addressSelect.value = currentAddress;
    } else {
        addressSelect.value = "";
    }
    
    updateCustomAddressDisplay();
}

function setupCustomDropdownHandlers() {
    if (customAddressDisplay) {
        customAddressDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (customAddressOptions) customAddressOptions.classList.toggle('hidden');
            if (customSelectWrapper) customSelectWrapper.classList.toggle('open');
        });
            customAddressDisplay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (customAddressOptions) customAddressOptions.classList.toggle('hidden');
                if (customSelectWrapper) customSelectWrapper.classList.toggle('open');
            }
        });
    }
    window.addEventListener('click', () => {
        if (customAddressOptions && !customAddressOptions.classList.contains('hidden')) {
            customAddressOptions.classList.add('hidden');
            if (customSelectWrapper) customSelectWrapper.classList.remove('open');
        }
    });
}

async function saveOrderToFirebase() {
  const address = addressSelect?.value;
  const phone = phoneNumberInput?.value.trim();
  const note = checkoutNote?.value.trim() || "";

  const urlParams = new URLSearchParams(window.location.search);
  const outletName = urlParams.get('outlet');
  
  if (!outletName) {
      console.error("Order save failed: No outlet specified in URL.");
      alert("Error: No outlet specified. Cannot place order.");
      return false;
  }
  
  const outletId = outletName.toLowerCase().replace(/\s+/g, '').replace(/'/g, '');

  const orderCart = Object.fromEntries(
        Object.entries(cart).filter(([_, c]) => c.item && c.item.restaurant === outletName)  
    );

  if (!address || !phone || Object.keys(orderCart).length === 0) {
      console.error("Order save validation failed. Address, phone, or filtered cart empty.");
      alert("Please ensure your address, phone, and cart are valid before ordering.");
      return false;
  }

  const bill = calculateBill();

  const orderData = {
    userId: currentUser ? currentUser.uid : "guest",
    userName: currentUser ? (currentUser.name || currentUser.email) : (emailInput.value || "Guest"),
    userEmail: currentUser ? currentUser.email : (emailInput.value || "guest"),
    address,
    phone,
    note,
    cart: orderCart, 
    totalAmount: bill.total,
    status: "Placed",
    timestamp: serverTimestamp(),
    isAccepted: false,
    outletName: outletName, 
    outletId: outletId,     
  };

  try {
    const orderRef = await addDoc(collection(db, "orders"), orderData);
    console.log("✅ Order placed with ID:", orderRef.id);
    alert(`🎉 Order placed successfully!\nOrder ID: ${orderRef.id}`);
    return true;
  } catch (err) {
    console.error("❌ Error placing order:", err);
    alert("Failed to place order. Please try again.");
    return false;
  }
}

async function confirmOrder() {
    if (orderTimerId) {
        clearTimeout(orderTimerId);
        orderTimerId = null;
    }
    if (cancellationTimerId) {
        clearTimeout(cancellationTimerId);
        cancellationTimerId = null;
    }
    console.log("Order confirmed by user/timeout. Saving to Firebase...");

    const success = await saveOrderToFirebase();

    if (orderConfirmationPanel) orderConfirmationPanel.classList.remove('visible');
    if (modalOverlay) modalOverlay.classList.add('hidden');
    document.body.classList.remove('no-scroll');
    if (timerBarFill) timerBarFill.classList.remove('animate-timer');

    if (success) {
        const randomDelay = Math.floor(Math.random() * 10000) + 5000;
        console.log(`Mock cancellation scheduled in ${randomDelay / 1000} seconds.`);

        cancellationTimerId = setTimeout(() => {
                console.log("Mock restaurant cancellation triggered.");
                if (cancellationModal) cancellationModal.classList.remove('hidden');
                if (modalOverlay) modalOverlay.classList.remove('hidden');
                document.body.classList.add('no-scroll');
            cancellationTimerId = null;
        }, randomDelay);

        const urlParams = new URLSearchParams(window.location.search);
        const outletName = urlParams.get('outlet');
        await clearCartForCurrentOutlet(outletName); 
        
        if (useSavedEmailCheck) useSavedEmailCheck.checked = false;
        if (useSavedPhoneCheck) useSavedPhoneCheck.checked = false;
        if (phoneNumberInput) phoneNumberInput.value = '';
        calculateBill(); 

    } else {
        calculateBill();
    }
}

function hideCancellationModal() {
    if (cancellationModal) cancellationModal.classList.add('hidden');
    if (modalOverlay) modalOverlay.classList.add('hidden');
    document.body.classList.remove('no-scroll');
    console.log("Cancellation modal closed.");
}

function setupHelperFunctions() {
    const elementsToAnimate = document.querySelectorAll('.fade-in-element');
    if (elementsToAnimate.length > 0) {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                            entry.target.classList.add('visible');
                            observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            elementsToAnimate.forEach(element => observer.observe(element));
        } else {
            elementsToAnimate.forEach(element => element.classList.add('visible'));
        }
    }

    const headerSearchForm = document.getElementById('header-search-form');
    if (headerSearchForm) {
        headerSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const searchInput = document.getElementById('header-search-input');
            const query = searchInput?.value.trim();
            if (query) window.location.href = `searchResults.html?query=${encodeURIComponent(query)}`;
        });
    }
}

function setupCheckoutEventHandlers() {
    console.log("Setting up checkout event handlers...");

    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            const buttonClicked = e.target.closest('.checkout-quantity-btn');
            if (!buttonClicked) return;
            
            const itemId = buttonClicked.dataset.itemId;
            const action = buttonClicked.dataset.action;
    
            if (!cart[itemId]) return console.warn(`Item not in cart: ${itemId}`);
            
            if (action === 'increase') {
                cart[itemId].quantity++;
            } else if (action === 'decrease') {
                cart[itemId].quantity--;
                if (cart[itemId].quantity <= 0) {
                    delete cart[itemId];
                }
            }
            saveCart(); 
            displayCheckoutCart(); 
            // setupCartDropdownToggle(cartLinkContainer,cartDropdown)
            displayCarts()
        });
    }

    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', () => {
            if (!currentUser) {
                return alert("Please sign in to place an order.");
            }
            if (!isOtpVerified) return alert('Please verify your email address with OTP.');
            if (!addressSelect.value) return alert('Please select a delivery address.');
            if (!phoneNumberInput || !/^\d{10}$/.test(phoneNumberInput.value)) return alert('Please enter a valid 10-digit phone number.');
            
            const bill = calculateBill(); 
            if (bill.totalItems === 0) return alert('Your cart for this outlet is empty.');
            
            console.log("Validation passed. Showing confirmation panel...");
            if (timerBarFill) {
                timerBarFill.classList.remove('animate-timer');
                void timerBarFill.offsetWidth;
                timerBarFill.classList.add('animate-timer');
            }
            if (orderConfirmationPanel) orderConfirmationPanel.classList.add('visible');
            if (modalOverlay) modalOverlay.classList.remove('hidden');
            document.body.classList.add('no-scroll');
            placeOrderBtn.disabled = true;
            placeOrderBtn.textContent = 'Placing Order...';
            
            orderTimerId = setTimeout(confirmOrder, 10000); 
            console.log("User cancellation timer started.");
        });
    }

    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', () => {
            if (orderTimerId) {
                clearTimeout(orderTimerId);
                orderTimerId = null;
                if (cancellationTimerId) {
                    clearTimeout(cancellationTimerId);
                    cancellationTimerId = null;
                }
                console.log("Order cancelled by user during confirmation.");
                if (orderConfirmationPanel) orderConfirmationPanel.classList.remove('visible');
                if (modalOverlay) modalOverlay.classList.add('hidden');
                document.body.classList.remove('no-scroll');
                if (timerBarFill) timerBarFill.classList.remove('animate-timer');
                calculateBill(); 
                alert("Order Cancelled.");
            }
        });
    }

    if (closeCancellationModalBtn) {
        closeCancellationModalBtn.addEventListener('click', hideCancellationModal);
    }
    if (cancellationOkBtn) {
        cancellationOkBtn.addEventListener('click', hideCancellationModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
                if (event.target === modalOverlay) {
                    if (cancellationModal && !cancellationModal.classList.contains('hidden')) {
                        hideCancellationModal();
                    }
                }
        });
    }

    console.log("Checkout event handlers set up.");
}

setupCheckoutEventHandlers();
setupCustomDropdownHandlers();
setupHelperFunctions();

onAuthStateChanged(auth, async (user) => {
    const otpSection = document.getElementById('otp-section');
    if (otpSection) {
        otpSection.classList.add('hidden');
    }
    if (user) {
        console.log("Auth state changed: User logged in:", user.email);
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            currentUser = { uid: user.uid, email: user.email, ...userDocSnap.data() };
            console.log("User profile data loaded:", currentUser);
        } else {
            console.log("No user profile found in Firestore, using basic auth info.");
            currentUser = { uid: user.uid, email: user.email };
        }
        
        // Save to localStorage
        localStorage.setItem('campusHubAuthState', 'loggedIn');
    } else {
        console.log("Auth state changed: No user logged in.");
        currentUser = null;
        
        // Clear localStorage
        localStorage.setItem('campusHubAuthState', 'loggedOut');
        localStorage.removeItem('campusHubUserData');
    }

    await loadCart();

    populateAddressDropdown();
    displayCheckoutCart(); 
    updateAuthUI();
});