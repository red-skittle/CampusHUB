import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where, 
    limit,
    updateDoc, 
    onSnapshot 
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
let mockOrders = []; 
let mockReviews = []; 
let isFirstLoad = true; 

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

async function updateOrderStatus(orderId, dataToUpdate) {
    if (!orderId || !dataToUpdate) {
        console.error("updateOrderStatus called with invalid parameters.");
        return false;
    }
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, dataToUpdate); 
        console.log(`Order ${orderId} updated successfully.`);
        return true;
    } catch (error) {
        console.error(`Error updating status for order ${orderId}:`, error);
        return false;
    }
}


document.addEventListener("DOMContentLoaded", async function () {
  
    function setupOrderListener(outletId) {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('outletId', '==', outletId));

        onSnapshot(q, (snapshot) => {
            console.log("Received real-time order update...");
            
            mockOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(), 
                };
            });

            updateStats(statsFilter.value);
            renderTable();
            
            if (isFirstLoad) {
                updateCharts();
                isFirstLoad = false;
            }

        }, (error) => {
            console.error("Error with real-time order listener:", error);
            alert("Error: Could not connect to order feed. Please refresh.");
        });
    }

    async function fetchReviewsData(outletId) {
        try {
            const reviewsRef = collection(db, 'reviews');
            const reviewsQuery = query(
                reviewsRef, 
                where('outletId', '==', outletId),
                limit(10) 
            );
            const reviewsSnapshot = await getDocs(reviewsQuery);
            mockReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            renderReviews();

        } catch (error) {
            console.error("Error fetching review data:", error);
        }
    }
  
    const dashboardContainer = document.getElementById('dashboardContainer');
    
    if (dashboardContainer) dashboardContainer.style.opacity = '0'; 

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            alert("Access Denied: Please log in.");
            window.location.href = '/login-pages/welcomelogin.html';
            return;
        }

        const { user: userData, outletId, role } = await fetchUserAndOutletInfo(user.uid);
        
        const allowedRoles = ['admin', 'outlet_manager', 'outletAdmin'];

        if (allowedRoles.includes(role) && outletId) {
            MANAGED_OUTLET_ID = outletId;

            const managerName = userData?.name || 'Manager';
            if (outletAdminName) outletAdminName.textContent = managerName;
            if (greetingName) greetingName.textContent = `Hi ${managerName}`;
            
            setupOrderListener(MANAGED_OUTLET_ID);
            
            await fetchReviewsData(MANAGED_OUTLET_ID);
            
            if (dashboardContainer) dashboardContainer.style.opacity = '1';
            
            initializeDashboardUI();
            
        } else {
            const message = (role === 'outlet_manager' && !outletId) 
                ? "Your manager account is not assigned to an outlet."
                : `Access Denied: Your role (${role}) does not have permission.`;

            alert(message);
            window.location.href = '/index.html'; 
        }
    });


    let totalRevenueChart, customerMapChart;
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    const tableBody = document.getElementById("ordersTableBody");
    const loadMoreButton = document.getElementById("loadMoreOrders");
    const initialVisibleRows = 5;
    let activeTooltip = null;

    const modalOverlay = document.getElementById("orderDetailsModal");
    const modalCloseButton = document.getElementById("modalCloseButton");
    const modalOrderId = document.getElementById("modalOrderId");
    const modalName = document.getElementById("modalName");
    const modalBlock = document.getElementById("modalBlock");
    const modalItemsList = document.getElementById("modalItemsList");
    const modalPhoneContainer = document.getElementById("modalPhoneContainer");
    const modalPhone = document.getElementById("modalPhone");
    const modalNotesContainer = document.getElementById("modalNotesContainer");
    const modalNotes = document.getElementById("modalNotes");

    const popover = document.getElementById("confirmationPopover");
    const popoverConfirm = document.getElementById("popoverConfirm");
    const popoverCancel = document.getElementById("popoverCancel");
    let rowToModify = null;

    const statTotalOrders = document.getElementById("statTotalOrders");
    const statTotalDelivered = document.getElementById("statTotalDelivered");
    const statTotalCanceled = document.getElementById("statTotalCanceled");
    const statTotalRevenue = document.getElementById("statTotalRevenue");

    const legendYear1 = document.getElementById("legendYear1");
    const legendYear2 = document.getElementById("legendYear2");
    const customerMapFilter = document.getElementById("customerMapFilter");

    const statsFilter = document.getElementById("statsFilter");

    const reviewsGrid = document.querySelector(".reviews-grid");
    const reviewsContainer = document.querySelector(".reviews-container");

    const outletAdminName = document.getElementById("outletAdminName");
    const greetingName = document.getElementById("greetingName");


    
    function updateStats(period = "this_week") {
      if (
        !statTotalOrders ||
        !statTotalDelivered ||
        !statTotalCanceled ||
        !statTotalRevenue
      ) {
        return;
      }
      
      const now = new Date(); 
      const today = new Date(now.setHours(0, 0, 0, 0));
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      
      let filteredOrders = mockOrders;
      
      if (period === "today") {
        filteredOrders = mockOrders.filter((order) => {
          const orderDate = new Date(order.date);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === today.getTime();
        });
      } else if (period === "this_week") {
        filteredOrders = mockOrders.filter((order) => {
          const orderDate = new Date(order.date);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() >= startOfWeek.getTime();
        });
      } else if (period === "this_month") {
        filteredOrders = mockOrders.filter((order) => {
          const orderDate = new Date(order.date);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() >= startOfMonth.getTime();
        });
      } else if (period === "this_year") {
        filteredOrders = mockOrders.filter((order) => {
          const orderDate = new Date(order.date);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() >= startOfYear.getTime();
        });
      }
      
      const totalDeliveredOrders = filteredOrders.filter(
        (o) => o.status === "Delivered"
      );
      const totalCanceledOrders = filteredOrders.filter(
        (o) => o.status === "Canceled"
      );
      const totalOrders = filteredOrders.length;
      const totalDelivered = totalDeliveredOrders.length;
      const totalCanceled = totalCanceledOrders.length;
      
      const totalRevenue = totalDeliveredOrders.reduce(
        (sum, order) => sum + order.totalAmount, 
        0
      );
      
      statTotalOrders.textContent = totalOrders;
      statTotalDelivered.textContent = totalDelivered;
      statTotalCanceled.textContent = totalCanceled;
      statTotalRevenue.textContent = `₹${totalRevenue.toLocaleString()}`;
    }

    function getRevenueChartData() {
      const revenuePrevious = Array(12).fill(0);
      const revenueCurrent = Array(12).fill(0);
      mockOrders.forEach((order) => {
        if (order.status === "Delivered") {
          const date = new Date(order.date);
          const year = date.getFullYear();
          const month = date.getMonth();
          if (year === previousYear) {
            revenuePrevious[month] += order.totalAmount; 
          } else if (year === currentYear) {
            revenueCurrent[month] += order.totalAmount; 
          }
        }
      });
      return { revenuePrevious, revenueCurrent };
    }

    function getCustomerMapData(period = "weekly") {
      let labels = [];
      let data = [];
      if (period === "monthly" || period === "yearly") {
        labels = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        data = Array(12).fill(0);
        mockOrders.forEach((order) => {
          const date = new Date(order.date);
          if (date.getFullYear() === currentYear) {
            const month = date.getMonth();
            data[month]++;
          }
        });
      } else {
        labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        data = Array(7).fill(0);
        mockOrders.forEach((order) => {
          const dayOfWeek = new Date(order.date).getUTCDay();
          data[dayOfWeek]++;
        });
      }
      return { labels, data };
    }


    function renderTable() {
      if (!tableBody) return;
      tableBody.innerHTML = "";
      const fragment = document.createDocumentFragment();
      
      const newOrders = mockOrders.filter(
        (order) => order.status === "Placed"
      );

      newOrders.sort((a, b) => b.date - a.date);
      
      newOrders.forEach((order) => {
        
        const tr = document.createElement("tr");

        tr.dataset.orderId = order.id;
        tr.dataset.name = order.userName || 'Guest';
        tr.dataset.block = order.address || 'N/A';
        tr.dataset.phone = order.phone || 'N/A';
        tr.dataset.notes = order.note || '';

        const items = Object.values(order.cart || {});
        let itemSummary = items
          .map((cartItem) => `${cartItem.item.name} (x${cartItem.quantity})`)
          .join(", ");
        tr.dataset.fullItems = itemSummary;
        
        let itemDisplay =
          items.length > 0 ? items[0].item.name : "No items";
        if (
          items.length > 1 ||
          (items.length === 1 && items[0].quantity > 1)
        ) {
          itemDisplay += "...";
        }

        tr.innerHTML = `
            <td>${order.id.substring(0, 8)}...</td>
            <td>${order.userName || 'Guest'}</td>
            <td>${order.address || 'N/A'}</td>
            <td class="item-cell">${itemDisplay}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-yes">YES</button>
                    <button class="btn btn-no">NO</button>
                </div>
            </td>
        `;
          
        fragment.appendChild(tr);
      });
      
      tableBody.appendChild(fragment);
      updateVisibleRows();
    }
    
    function renderReviews() {
      if (!reviewsGrid || !reviewsContainer) return;
      reviewsGrid.innerHTML = "";
      let navigation = reviewsContainer.querySelector(".reviews-navigation");
      if (!navigation) {
        const reviewsHeader = reviewsContainer.querySelector(".reviews-header");
        if (reviewsHeader) {
          navigation = document.createElement("div");
          navigation.className = "reviews-navigation";
          navigation.innerHTML = `
                   <div class="nav-arrow disabled" id="reviewArrowLeft"><i class="ph ph-caret-left"></i></div>
                   <div class="nav-arrow" id="reviewArrowRight"><i class="ph ph-caret-right"></i></div>
               `;
          reviewsHeader.appendChild(navigation);
          navigation
            .querySelector("#reviewArrowLeft")
            .addEventListener("click", () => {
              const cardWidth =
                reviewsGrid.querySelector(".review-card")?.offsetWidth || 300;
              reviewsGrid.scrollBy({
                left: -(cardWidth + 100),
                behavior: "smooth",
              });
            });
          navigation
            .querySelector("#reviewArrowRight")
            .addEventListener("click", () => {
              const cardWidth =
                reviewsGrid.querySelector(".review-card")?.offsetWidth || 300;
              reviewsGrid.scrollBy({ left: cardWidth + 100, behavior: "smooth" });
            });
        }
      }
      mockReviews.forEach((review) => {
        const card = document.createElement("div");
        card.className = "review-card";
        let stars = "⭐".repeat(Math.floor(review.rating));
        card.innerHTML = `
              <div class="review-card-header">
                  <div class="review-card-header-left">
                      <img src="${review.avatarUrl || './assets/user.png'}" alt="${ 
          review.name
        }" class="review-avatar">
                      <div class="review-name-stack">
                          <h4 class="review-name">${review.name}</h4>
                          <span class="review-date">${review.date}</span>
                      </div>
                  </div>
              </div>
              <p class="review-text">${review.text}</p>
              <div class="review-rating-container">
                  <span class="review-rating">${stars}</span>
                  <span class="review-rating-score">${review.rating.toFixed(
                    1
                  )}</span>
              </div>
              <img src="${
                review.imageUrl || 'https://placehold.co/100' 
              }" alt="review food" class="review-food-img">
          `;
        reviewsGrid.appendChild(card);
      });
      const reviewArrowLeft = document.getElementById("reviewArrowLeft");
      const reviewArrowRight = document.getElementById("reviewArrowRight");
      if (reviewsGrid && reviewArrowLeft && reviewArrowRight) {
        const updateArrowState = () => {
          if (!reviewsGrid) return;
          const scrollLeft = reviewsGrid.scrollLeft;
          const maxScroll = reviewsGrid.scrollWidth - reviewsGrid.clientWidth;
          reviewArrowLeft.classList.toggle("disabled", scrollLeft < 10);
          reviewArrowRight.classList.toggle(
            "disabled",
            scrollLeft > maxScroll - 10
          );
        };
        reviewsGrid.addEventListener("scroll", updateArrowState);
        setTimeout(updateArrowState, 500);
        new ResizeObserver(updateArrowState).observe(reviewsGrid);
      }
    }

    function updateCharts() {
      const { revenuePrevious, revenueCurrent } = getRevenueChartData();
      if (totalRevenueChart) {
        totalRevenueChart.data.datasets[0].data = revenuePrevious;
        totalRevenueChart.data.datasets[1].data = revenueCurrent;
        totalRevenueChart.update();
      }
      updateCustomerMapChart();
    }

    function updateCustomerMapChart() {
      if (!customerMapChart || !customerMapFilter) return;
      const selectedPeriod = customerMapFilter.value;
      const { labels, data } = getCustomerMapData(selectedPeriod);
      customerMapChart.data.labels = labels;
      customerMapChart.data.datasets[0].data = data;
      customerMapChart.update();
    }

    async function processOrderAction(row, action, highlightClass) {
      if (!row) return;
      const orderIdToUpdate = row.dataset.orderId;
      
      let dataToUpdate = {}; 

      if (action === "Delivered") { 
        dataToUpdate = {
          status: "TBD",
          isAccepted: true
        };
      } else if (action === "Canceled") {
        dataToUpdate = {
          status: "Canceled",
          isAccepted: false 
        };
      } else {
        return; 
      }

      const success = await updateOrderStatus(orderIdToUpdate, dataToUpdate);

      if (!success) {
          alert(`Failed to update order ${orderIdToUpdate} status.`);
          return;
      }
      
    }


    
    function initializeDashboardUI() {
      
      if (legendYear1) legendYear1.textContent = previousYear;
      if (legendYear2) legendYear2.textContent = currentYear;

      const revenueCanvas = document.getElementById("totalRevenueChart");
      if (revenueCanvas) {
        const { revenuePrevious, revenueCurrent } = getRevenueChartData();
        const revenueCtx = revenueCanvas.getContext("2d");
        totalRevenueChart = new Chart(revenueCtx, {
          type: "line",
          data: {
            labels: [
              "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ],
            datasets: [
              {
                label: previousYear.toString(),
                data: revenuePrevious,
                borderColor: "#2D9CDB",
                backgroundColor: "#2D9CDB",
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 10,
              },
              {
                label: currentYear.toString(),
                data: revenueCurrent,
                borderColor: "#FF5B5B",
                backgroundColor: "#FF5B5B",
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 10,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    let label = context.dataset.label || "";
                    if (label) {
                      label += ": ";
                    }
                    if (context.parsed.y !== null) {
                      label += `₹${context.parsed.y.toLocaleString()}`;
                    }
                    return label;
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return "₹" + value / 1000 + "k";
                  },
                  stepSize: 10000,
                  color: "#A3A3A3",
                  font: { family: "'Barlow', sans-serif" },
                },
                grid: { drawBorder: false, color: "#F3F2F7" },
              },
              x: {
                ticks: {
                  color: "#A3A3A3",
                  font: { family: "'Barlow', sans-serif" },
                },
                grid: { display: false },
              },
            },
          },
        });
      }

      const customerCanvas = document.getElementById("customerMapChart");
      if (customerCanvas) {
        const { labels, data } = getCustomerMapData(customerMapFilter.value);
        const customerCtx = customerCanvas.getContext("2d");
        customerMapChart = new Chart(customerCtx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Orders",
                data: data,
                backgroundColor: [
                  "#FF5B5B", "#F7C604", "#FF5B5B", "#F7C604", "#FF5B5B", "#F7C604", "#FF5B5B",
                ],
                borderRadius: 2,
                barPercentage: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 10 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    let label = context.dataset.label || "";
                    if (label) {
                      label += ": ";
                    }
                    if (context.parsed.y !== null) {
                      label += context.parsed.y;
                    }
                    return label;
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 20,
                  color: "#A3A3A3",
                  font: { family: "'Barlow', sans-serif" },
                },
                grid: { drawBorder: false, color: "#F3F2F7" },
              },
              x: {
                ticks: {
                  color: "#A3A3A3",
                  font: { family: "'Barlow', sans-serif" },
                },
                grid: { display: false },
              },
            },
          },
        });
      }
    }


    if (statsFilter) {
      statsFilter.addEventListener("change", function () {
        updateStats(this.value);
      });
    }

    function updateVisibleRows() {
      if (!tableBody || !loadMoreButton) return;
      const currentRows = tableBody.getElementsByTagName("tr");
      const totalRows = currentRows.length;
      const showAll = tableBody.classList.contains("show-all");
      let visibleCount = 0;
      let anyHidden = false;
      for (let i = 0; i < totalRows; i++) {
        if (currentRows[i]) {
          if (showAll || visibleCount < initialVisibleRows) {
            currentRows[i].style.display = "table-row";
            visibleCount++;
          } else {
            currentRows[i].style.display = "none";
            anyHidden = true;
          }
        }
      }
      if (anyHidden && !showAll) {
        loadMoreButton.style.display = "block";
      } else {
        loadMoreButton.style.display = "none";
      }
    }

    if (tableBody) {
      if (loadMoreButton) {
        loadMoreButton.addEventListener("click", function (event) {
          event.preventDefault();
          tableBody.classList.add("show-all");
          updateVisibleRows();
        });
      }

      tableBody.addEventListener("click", function (event) {
        const target = event.target;
        const row = target.closest("tr");
        if (!row) return;

        if (
          target.classList.contains("btn-yes") ||
          target.classList.contains("btn-no")
        ) {
          event.stopPropagation();

          if (target.classList.contains("btn-yes")) {
            processOrderAction(row, "Delivered", "highlight-green"); 
          } else if (target.classList.contains("btn-no")) {
            showPopover(target, row);
          }
        } else if (!target.closest("button") && !target.closest(".item-cell")) {
          const orderId = row.dataset.orderId;
          const name = row.dataset.name;
          const block = row.dataset.block;
          const itemsString = row.dataset.fullItems;
          const phone = row.dataset.phone;
          const notes = row.dataset.notes;
          if (modalOrderId) modalOrderId.textContent = orderId || "N/A";
          if (modalName) modalName.textContent = name || "N/A";
          if (modalBlock) modalBlock.textContent = block || "N/A";
          if (modalPhoneContainer && modalPhone) {
            modalPhone.textContent = phone || "N/A";
            modalPhoneContainer.style.display = "block";
          }
          if (modalItemsList) {
            modalItemsList.innerHTML = "";
            if (itemsString) {
              itemsString.split(",").forEach((itemText) => {
                const trimmedItem = itemText.trim();
                if (trimmedItem) {
                  const li = document.createElement("li");
                  li.textContent = trimmed.item;
                  modalItemsList.appendChild(li);
                }
              });
            } else {
              const li = document.createElement("li");
              li.textContent = "No items listed.";
              modalItemsList.appendChild(li);
            }
          }
          if (modalNotesContainer && modalNotes) {
            if (notes) {
              modalNotes.textContent = notes;
              modalNotesContainer.style.display = "block";
            } else {
              modalNotesContainer.style.display = "none";
            }
          }
          if (modalOverlay) {
            modalOverlay.style.display = "flex";
            requestAnimationFrame(() => {
              modalOverlay.classList.add("visible");
            });
          }
        }
      });

      tableBody.addEventListener("mouseover", function (event) {
        const targetCell = event.target.closest(".item-cell");
        if (targetCell) {
          const parentRow = targetCell.closest("tr");
          if (!parentRow) return;
          removeTooltip();
          const tooltipText =
            parentRow.dataset.fullItems || "No details available";
          const rect = targetCell.getBoundingClientRect();
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip-box";
          tooltip.textContent = tooltipText;
          document.body.appendChild(tooltip);
          activeTooltip = tooltip;
          tooltip.style.left = `${rect.left + window.scrollX}px`;
          tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
          void tooltip.offsetWidth;
          tooltip.classList.add("visible");
        }
      });
      tableBody.addEventListener("mouseout", function (event) {
        const relatedTarget = event.relatedTarget;
        const targetCell = event.target.closest(".item-cell");
        if (
          targetCell &&
          (!relatedTarget || !targetCell.contains(relatedTarget))
        ) {
          removeTooltip();
        }
      });
      function removeTooltip() {
        if (activeTooltip) {
          activeTooltip.classList.remove("visible");
          activeTooltip.addEventListener(
            "transitionend",
            () => {
              if (activeTooltip && !activeTooltip.classList.contains("visible")) {
                activeTooltip.remove();
                activeTooltip = null;
              }
            },
            { once: true }
          );
          setTimeout(() => {
            if (activeTooltip && !activeTooltip.classList.contains("visible")) {
              activeTooltip.remove();
              activeTooltip = null;
            }
          }, 300);
        }
      }

      if (modalCloseButton && modalOverlay) {
        modalCloseButton.addEventListener("click", function () {
          modalOverlay.classList.remove("visible");
          modalOverlay.addEventListener(
            "transitionend",
            () => {
              if (!modalOverlay.classList.contains("visible")) {
                modalOverlay.style.display = "none";
              }
            },
            { once: true }
          );
        });
        modalOverlay.addEventListener("click", function (event) {
          if (event.target === modalOverlay) {
            modalOverlay.classList.remove("visible");
            modalOverlay.addEventListener(
              "transitionend",
              () => {
                if (!modalOverlay.classList.contains("visible")) {
                  modalOverlay.style.display = "none";
                }
              },
              { once: true }
            );
          }
        });
      }

      function showPopover(button, row) {
        rowToModify = row;
        const rect = button.getBoundingClientRect();

        popover.style.visibility = "hidden";
        popover.style.display = "block";
        const popoverHeight = popover.offsetHeight;
        const popoverWidth = popover.offsetWidth;

        let top = rect.top + window.scrollY - popoverHeight - 10;

        if (top - window.scrollY < 10) {
          top = rect.bottom + window.scrollY + 10; 
        }

        let left = rect.left + window.scrollX - popoverWidth / 2 + rect.width / 2;

        if (left - window.scrollX < 10) {
          left = window.scrollX + 10;
        }

        const rightEdge = left + popoverWidth;
        const windowWidth = window.innerWidth + window.scrollX;
        if (rightEdge > windowWidth - 10) {
          left = windowWidth - popoverWidth - 10;
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;

        popover.style.visibility = "visible";
        requestAnimationFrame(() => {
          popover.classList.add("visible");
        });
      }

      function hidePopover() {
        rowToModify = null;
        popover.classList.remove("visible");

        const afterHide = () => {
          if (!popover.classList.contains("visible")) {
            popover.style.display = "none";
            popover.style.visibility = "hidden";
          }
          popover.removeEventListener("transitionend", afterHide);
        };
        popover.addEventListener("transitionend", afterHide);

        setTimeout(() => {
          if (!popover.classList.contains("visible")) {
            popover.style.display = "none";
            popover.style.visibility = "hidden";
          }
        }, 300);
      }

      if (popoverConfirm) {
        popoverConfirm.addEventListener("click", function () {
          if (rowToModify) {
            processOrderAction(rowToModify, "Canceled", "highlight-red");
          }
          hidePopover();
        });
      }
      if (popoverCancel) {
        popoverCancel.addEventListener("click", function () {
          hidePopover();
        });
      }
      document.addEventListener(
        "click",
        function (event) {
          if (!popover) return;
          const clickedPopover = popover.contains(event.target);
          const clickedNoButton = event.target.classList.contains("btn-no");
          if (
            popover.classList.contains("visible") &&
            !clickedPopover &&
            !clickedNoButton
          ) {
            hidePopover();
          }
        },
        true
      );
    } 

    if (customerMapFilter) {
      customerMapFilter.addEventListener("change", function () {
        updateCustomerMapChart();
      });
    }

    const reviewGrid = document.querySelector(".reviews-grid");
    const reviewArrowLeft = document.getElementById("reviewArrowLeft");
    const reviewArrowRight = document.getElementById("reviewArrowRight");

    if (reviewGrid && reviewArrowLeft && reviewArrowRight) {
      const updateArrowState = () => {
        if (!reviewGrid) return;
        const scrollLeft = reviewGrid.scrollLeft;
        const maxScroll = reviewsGrid.scrollWidth - reviewsGrid.clientWidth;

        reviewArrowLeft.classList.toggle("disabled", scrollLeft < 10);
        reviewArrowRight.classList.toggle(
          "disabled",
          scrollLeft > maxScroll - 10
        );
      };

      reviewArrowLeft.addEventListener("click", () => {
        const cardWidth =
          reviewsGrid.querySelector(".review-card")?.offsetWidth + 100;
        reviewsGrid.scrollBy({ left: -cardWidth, behavior: "smooth" });
      });

      reviewArrowRight.addEventListener("click", () => {
        const cardWidth =
          reviewsGrid.querySelector(".review-card")?.offsetWidth + 100;
        reviewsGrid.scrollBy({ left: cardWidth, behavior: "smooth" });
      });

      reviewsGrid.addEventListener("scroll", updateArrowState);
      setTimeout(updateArrowState, 500);
      new ResizeObserver(updateArrowState).observe(reviewGrid);
    }
    
    const observerOptions = { root: null, rootMargin: "0px", threshold: 0.1 };
    const observerCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        } else {
        }
      });
    };
    const scrollObserver = new IntersectionObserver(
      observerCallback,
      observerOptions
    );
    const fadeElements = document.querySelectorAll(".fade-in-on-scroll");
    fadeElements.forEach((el) => scrollObserver.observe(el));
    
});