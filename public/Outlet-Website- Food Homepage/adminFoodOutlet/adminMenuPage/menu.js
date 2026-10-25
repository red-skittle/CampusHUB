import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

let MANAGED_OUTLET_ID = null;
let allMenuItems = []; 
let currentFilteredData = [];


async function fetchUserAndOutletInfo(userId) {
    if (!userId) return { user: null, outletId: null, role: null };
    const userRef = doc(db, "outletAdmins", userId); 
    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            let rawId = data.outletId || "";
            let normalizedOutletId = rawId.toLowerCase().replace(/\s+/g, '').replace(/'/g, '');
            return {
                user: data,
                outletId: normalizedOutletId, 
                role: data.role || 'student' 
            };
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
    return { user: null, outletId: null, role: 'student' };
}


async function fetchMenuData(outletId) {
    try {
        const outletRef = doc(db, "outlets", outletId);
        const snap = await getDoc(outletRef);
        
        if (!snap.exists()) {
            console.error("Outlet document not found!");
            return [];
        }

        const data = snap.data();
        const rawCategories = data.categories || [];
        let parsedItems = [];

        if (Array.isArray(rawCategories)) {
            rawCategories.forEach(cat => {
                if (cat.items && Array.isArray(cat.items)) {
                    cat.items.forEach(item => {
                        parsedItems.push(normalizeItemData(item, cat.name));
                    });
                }
            });
        } 
        else if (typeof rawCategories === 'object') {
            Object.entries(rawCategories).forEach(([catName, catData]) => {
                if (catData.items && Array.isArray(catData.items)) {
                    catData.items.forEach(item => {
                        parsedItems.push(normalizeItemData(item, catName));
                    });
                }
            });
        }

        return parsedItems;

    } catch (error) {
        console.error("Error fetching menu:", error);
        alert("Failed to load menu data.");
        return [];
    }
}

function normalizeItemData(item, categoryName) {
    let priceArray = [];
    if (item.prices && Array.isArray(item.prices)) {
        priceArray = item.prices.map(p => parseFloat(p));
    } else if (item.price) {
        priceArray = [parseFloat(item.price)];
    } else {
        priceArray = [0];
    }

    const itemId = item.id || item.name.replace(/\s+/g, '-').toLowerCase() + "-" + Math.random().toString(36).substr(2, 5);

    return {
        id: itemId,
        name: item.name || "Unnamed Item",
        img: item.imageURL || item.img || "https://placehold.co/150",
        sizes: item.sizes || [], 
        prices: priceArray,
        desc: item.description || "",
        category: categoryName || "uncategorized",
        type: item.type || (item.isVeg ? "veg" : "nonveg"), 
        inStock: item.inStock !== undefined ? item.inStock : true
    };
}

async function saveMenuToFirestore() {
    if (!MANAGED_OUTLET_ID) return;

    try {
        
        const groupedCategories = {};

        allMenuItems.forEach(item => {
            const cat = item.category || "uncategorized";
            if (!groupedCategories[cat]) {
                groupedCategories[cat] = {
                    name: cat,
                    items: []
                };
            }

            const firestoreItem = {
                id: item.id,
                name: item.name,
                description: item.desc,
                imageURL: item.img,
                type: item.type,
                isVeg: item.type === 'veg',
                inStock: item.inStock,
                sizes: item.sizes || []
            };
            if (item.prices.length > 0) {
                firestoreItem.prices = item.prices;
                firestoreItem.price = Math.min(...item.prices); 
            } else {
                firestoreItem.price = 0;
            }

            groupedCategories[cat].items.push(firestoreItem);
        });

        const categoriesArray = Object.values(groupedCategories);

        const outletRef = doc(db, "outlets", MANAGED_OUTLET_ID);
        
        await updateDoc(outletRef, {
            categories: categoriesArray
        });

        console.log("Menu successfully saved to Firestore!");

    } catch (error) {
        console.error("Error saving menu to Firestore:", error);
        alert("Failed to save changes. Check console.");
    }
}


document.addEventListener("DOMContentLoaded", function () {
  
  const menuListContainer = document.getElementById("menuListContainer");
  const categoryFilter = document.getElementById("categoryFilter");
  const sortFilter = document.getElementById("sortFilter");
  const modalOverlay = document.getElementById("menuModal");
  const modalCloseButton = document.getElementById("modalCloseButton");
  const modalCancelButton = document.getElementById("modalCancelButton");
  const modalForm = document.getElementById("menuForm");
  const modalTitle = document.getElementById("modalTitle");
  const modalItemId = document.getElementById("modalItemId");
  const modalName = document.getElementById("modalName");
  const modalCategory = document.getElementById("modalCategory");
  const modalSizes = document.getElementById("modalSizes");
  const modalPrices = document.getElementById("modalPrices");
  const modalDesc = document.getElementById("modalDesc");
  const modalImgUpload = document.getElementById("modalImgUpload");
  const imagePreview = document.getElementById("imagePreview");
  const imagePreviewImg = imagePreview.querySelector(".image-preview-img");
  let currentImageFile = null; 

  const outletAdminName = document.getElementById("outletAdminName");


  // =================================================================
  // AUTH & INIT LOGIC
  // =================================================================

  onAuthStateChanged(auth, async (user) => {
      if (!user) {
          window.location.href = '/login-pages/welcomelogin.html';
          return;
      }

      const { user: userData, outletId, role } = await fetchUserAndOutletInfo(user.uid);
      
      const allowedRoles = ['admin', 'outlet_manager', 'outletAdmin'];

      if (allowedRoles.includes(role) && outletId) {
          MANAGED_OUTLET_ID = outletId;
          if (outletAdminName) outletAdminName.textContent = userData?.name || "Manager";
          
          // Load Data
          allMenuItems = await fetchMenuData(MANAGED_OUTLET_ID);
          applyFiltersAndSort(); // Initial Render

      } else {
          alert("Access Denied. You are not assigned to a valid outlet.");
          window.location.href = '/index.html';
      }
  });

  function renderMenu(itemsToRender) { 
    if (!menuListContainer) return;
    menuListContainer.innerHTML = ""; 

    if (itemsToRender.length === 0) {
        menuListContainer.innerHTML = "<p class='no-items-message'>No menu items match the current filter.</p>";
        return;
    }

    itemsToRender.forEach(item => {
      const card = document.createElement("article");
      card.className = `menu-card fade-in-on-scroll ${item.category}`; 
      card.dataset.id = item.id;
      card.dataset.category = item.category; 
      card.dataset.type = item.type; 
      card.dataset.price = item.prices[0]; 

      const sizesText = item.sizes && item.sizes.length > 0 ? item.sizes.join(", ") : "Standard";
      const pricesText = item.prices.map(p => `₹${p}`).join(", "); 
      const stockStatus = item.inStock ? "in_stock" : "out_of_stock";
      const stockDropdownClass = item.inStock ? "" : "out-of-stock"; 
      const shortDesc = item.desc.length > 50 ? item.desc.substring(0, 50) + "..." : item.desc;

      const isPlaceholder = !item.img || item.img.trim() === "" || item.img.includes('placehold.co');
      
      const imageSection = `
        <div class="image-wrapper"> 
          ${isPlaceholder
            ? `<div class="card-img-placeholder">${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</div>`
            : `<img src="${item.img}" alt="${item.name}" class="card-img">`
          }
          <button class="btn-edit" data-id="${item.id}" aria-label="Edit ${item.name}"><i class="ph ph-pencil-simple"></i></button>
        </div>
      `;

      card.innerHTML = `
        ${imageSection}
        
        <div class="card-details">
          <p><i class="ph ph-pencil-line"></i><b>ITEM NAME :</b>${item.name}</p> 
          <p><i class="ph ph-list-numbers"></i><b>ITEM SIZES :</b>[${sizesText}]</p> 
          <p><i class="ph ph-currency-inr"></i><b>ITEM PRICES :</b>[${pricesText}]</p> 
          <p><i class="ph ph-info"></i><b>ITEM DESCRIPTION :</b>${shortDesc}</p> 
        </div>
        <div class="card-actions">
          <select class="stock-dropdown ${stockDropdownClass}" data-id="${item.id}" aria-label="Set stock status for ${item.name}">
               <option value="in_stock" ${stockStatus === 'in_stock' ? 'selected' : ''}>In Stock</option> 
               <option value="out_of_stock" ${stockStatus === 'out_of_stock' ? 'selected' : ''}>Out of Stock</option>
          </select>
        </div>
      `;
      menuListContainer.appendChild(card);
    });

    observeFadeInElements();
  }

  // =================================================================
  // FILTER & SORT FUNCTIONS 
  // =================================================================
  
  function applyFiltersAndSort() {
      const category = categoryFilter ? categoryFilter.value : 'all';
      const sortValue = sortFilter ? sortFilter.value : 'name-asc';

      currentFilteredData = allMenuItems.filter(item => {
          if (category === 'all') return true;
          if (category === 'veg' || category === 'nonveg') {
              return item.type === category; 
          }
          return item.category === category; 
      });

      switch (sortValue) {
          case 'name-asc':
              currentFilteredData.sort((a, b) => a.name.localeCompare(b.name));
              break;
          case 'price-low':
              currentFilteredData.sort((a, b) => (a.prices[0] || 0) - (b.prices[0] || 0));
              break;
          case 'price-high':
              currentFilteredData.sort((a, b) => (b.prices[0] || 0) - (a.prices[0] || 0));
              break;
      }

      renderMenu(currentFilteredData);
  }


  // =================================================================
  // MODAL FUNCTIONS 
  // =================================================================

  function openModal(item = null) {
    modalForm.reset(); 
    imagePreview.classList.remove("has-image");
    imagePreviewImg.src = "";
    currentImageFile = null;

    if (item) {
      modalTitle.textContent = "Edit Menu Item";
      modalItemId.value = item.id;
      modalName.value = item.name;
      modalCategory.value = item.category;
      modalSizes.value = item.sizes ? item.sizes.join(", ") : "";
      modalPrices.value = item.prices ? item.prices.join(", ") : "";
      modalDesc.value = item.desc; 

      if (item.img && item.img.trim() !== "" && !item.img.includes('placehold.co')) {
          imagePreviewImg.src = item.img;
          imagePreview.classList.add("has-image");
      }

    } else {
       console.error("Attempted to open modal in ADD mode. Logic not implemented in this snippet.");
       return; 
    }

    modalOverlay.style.display = "flex";
    requestAnimationFrame(() => {
      modalOverlay.classList.add("visible");
    });
  }

  function closeModal() {
    modalOverlay.classList.remove("visible");
    modalOverlay.addEventListener("transitionend", () => {
      if (!modalOverlay.classList.contains("visible")) {
        modalOverlay.style.display = "none";
      }
    }, { once: true });
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const id = modalItemId.value; 
    if (!id) return; 

    // Parse inputs
    const sizesArray = modalSizes.value.split(',').map(s => s.trim()).filter(Boolean);
    const pricesArray = modalPrices.value.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p));

    // Basic Validation
    if (sizesArray.length > 0 && sizesArray.length !== pricesArray.length) {
       // Only enforce matching length if sizes are actually provided
       alert("Error: If you provide sizes, the number of sizes must match the number of prices.");
       return;
    }

    let imageUrl = ""; 
    const existingItem = allMenuItems.find(item => item.id === id);
    if (existingItem) imageUrl = existingItem.img; 

    let itemType = 'veg'; 
    if (modalCategory.value === 'pizza') {
        if (modalName.value.toLowerCase().includes('pepperoni') || modalName.value.toLowerCase().includes('chicken')) {
            itemType = 'nonveg';
        }
    } else if (existingItem) {
        itemType = existingItem.type;
    }

    const updatedItemData = {
      name: modalName.value,
      category: modalCategory.value,
      type: itemType, 
      sizes: sizesArray,
      prices: pricesArray,
      desc: modalDesc.value,
      img: imageUrl,
    };

    const index = allMenuItems.findIndex(item => item.id === id);
    if (index !== -1) {
      allMenuItems[index] = { ...allMenuItems[index], ...updatedItemData };
      
      await saveMenuToFirestore();
      
      applyFiltersAndSort(); 
      closeModal();
    } else {
        console.error("Could not find item to update locally with ID:", id);
    }
  }
  
  if(modalImgUpload) {
      modalImgUpload.addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
          const reader = new FileReader();
          currentImageFile = file; 
          reader.onload = function(e) {
            imagePreviewImg.src = e.target.result; 
            imagePreview.classList.add("has-image");
          }
          reader.readAsDataURL(file);
        }
      });
  }
  
  if(imagePreview) {
     imagePreview.addEventListener("click", () => modalImgUpload.click());
  }

  function initializeCustomDropdowns() {
    const dropdownWrappers = document.querySelectorAll('.custom-dropdown-wrapper');

    dropdownWrappers.forEach(wrapper => {
      const trigger = wrapper.querySelector('.custom-dropdown-trigger');
      const list = wrapper.querySelector('.custom-dropdown-list');
      const options = list.querySelectorAll('li');
      const selectedTextSpan = trigger.querySelector('.selected-option-text');
      const hiddenSelectId = list.id.replace('-list', '');
      const hiddenSelect = document.getElementById(hiddenSelectId);

      if (!trigger || !list || !options || !selectedTextSpan || !hiddenSelect) return;

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns(wrapper);
        list.classList.toggle('is-open');
      });

      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          closeAllDropdowns(wrapper);
          list.classList.toggle('is-open');
        }
      });

      options.forEach(option => {
        option.addEventListener('click', () => {
          const value = option.dataset.value;
          const text = option.textContent;
          options.forEach(opt => opt.classList.remove('selected'));
          option.classList.add('selected');
          selectedTextSpan.textContent = text;
          hiddenSelect.value = value;
          hiddenSelect.dispatchEvent(new Event('change'));
          list.classList.remove('is-open');
        });
      });
    });

    document.addEventListener('click', () => { closeAllDropdowns(); });

    function closeAllDropdowns(exceptWrapper = null) {
      document.querySelectorAll('.custom-dropdown-list.is-open').forEach(list => {
       if (exceptWrapper && list.closest('.custom-dropdown-wrapper') === exceptWrapper) {
        } else {
          list.classList.remove('is-open');
        }
      });
    }
  }

  initializeCustomDropdowns();

  if (categoryFilter) categoryFilter.addEventListener('change', applyFiltersAndSort);
  if (sortFilter) sortFilter.addEventListener('change', applyFiltersAndSort);
  if (modalCloseButton) modalCloseButton.addEventListener("click", closeModal);
  if (modalCancelButton) modalCancelButton.addEventListener("click", closeModal);
  if (modalOverlay) modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
  if (modalForm) modalForm.addEventListener("submit", handleFormSubmit);

  if (menuListContainer) {
    menuListContainer.addEventListener("click", function(e) {
      const editButton = e.target.closest(".btn-edit"); 
      if (editButton) { 
        const id = editButton.dataset.id; 
        const itemToEdit = allMenuItems.find(item => item.id === id); 
        if (itemToEdit) openModal(itemToEdit); 
      }
    });

    menuListContainer.addEventListener("change", async function(e) {
        const stockDropdown = e.target.closest(".stock-dropdown");
        if (stockDropdown) {
            const id = stockDropdown.dataset.id;
            const newStatus = stockDropdown.value === 'in_stock';
            
            const index = allMenuItems.findIndex(item => item.id === id); 
            if (index !== -1) {
                allMenuItems[index].inStock = newStatus;
                
                stockDropdown.classList.toggle('out-of-stock', !newStatus); 
                stockDropdown.style.borderColor = newStatus ? 'var(--highlight-green)' : 'var(--highlight-red)';
                setTimeout(() => { stockDropdown.style.borderColor = 'var(--border-color)'; }, 1000);


                await saveMenuToFirestore();
            }
        }
    });
  }
  
  let scrollObserver;
  function observeFadeInElements() {
    const observerOptions = { root: null, rootMargin: "0px", threshold: 0.1 };
    const observerCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target); 
        }
      });
    };
    if (scrollObserver) scrollObserver.disconnect();
    scrollObserver = new IntersectionObserver(observerCallback, observerOptions);
    const fadeElements = document.querySelectorAll(".fade-in-on-scroll");
    fadeElements.forEach((el) => {
        el.classList.remove('visible'); 
        scrollObserver.observe(el)
    });
  }

});