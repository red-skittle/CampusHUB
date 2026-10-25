// This function fetches the sidebar.html content and injects it into the page
async function loadSidebar() {
  try {
    const response = await fetch(`../sidebar/sidebar.html`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const container = document.getElementById("dashboardContainer");
    
    if (container) {
      // Injects the sidebar HTML at the very beginning of the dashboard container
      container.insertAdjacentHTML('afterbegin', html);
    } else {
      console.error("#dashboardContainer not found. Cannot inject sidebar.");
    }
  } catch (error) {
    console.error("Error loading sidebar.html:", error);
  }
}

// This function finds the buttons (now loaded) and makes them work
function initSidebarToggle() {
  // We query for these elements *after* they have been loaded by loadSidebar()
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle && sidebar && sidebarOverlay) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.add("is-open");
      sidebarOverlay.classList.add("is-open");
    });

    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.remove("is-open");
      sidebarOverlay.classList.remove("is-open");
    });
  } else {
    console.error("Could not find sidebar toggle elements after load.");
  }
}

// ======================================================
// ✨ NEW FUNCTION TO HIGHLIGHT THE CURRENT PAGE
// ======================================================
function setActiveLink() {
  try {
    // Get the path of the current page (e.g., "/orderListPage/orderList.html")
    const currentPath = window.location.pathname;

    // Get all the navigation links from the sidebar
    const navLinks = document.querySelectorAll("#sidebar .nav-menu li a");

    if (!navLinks.length) {
      console.warn("No sidebar navigation links found to highlight.");
      return;
    }

    navLinks.forEach(link => {
      // Get the full path of the link (it resolves the "../")
      const linkPath = new URL(link.href).pathname;

      // Check if the link's path is identical to the current page's path
      if (currentPath === linkPath) {
        link.classList.add("active");
      }
    });
  } catch (error) {
    console.error("Error setting active sidebar link:", error);
  }
}

// Main execution when the page is ready
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Wait for the sidebar HTML to be loaded and added to the page
  await loadSidebar();
  
  // 2. NOW that the HTML exists, set the active link
  setActiveLink(); // <-- THIS LINE WAS ADDED
  
  // 3. Find the buttons and add the click events
  initSidebarToggle(); 
});