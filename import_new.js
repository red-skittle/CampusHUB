


const admin = require("firebase-admin");
const serviceAccount = require("./campus.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// --------------------------- ADMIN DATA ---------------------------
const adminData = {
  uid: "4RtWUNR0uybNrDiBGdYQJruwFlH3",
  clubId: "gltch_the_ssports_society",
  clubName: "Gltch! The sSports Society",
  name: "Gltch! The sSports Society Admin",
  email: "gltchthessports@muj.manipal.edu",
  contactInfo: {
    email: "gltchthessports@muj.manipal.edu",
    instagram: "@gltchmuj",
  },
  isActive: true,
  loginPortal: "admin",
  profileCompleted: true,
  role: "admin",
  type: "club",
  permissions: {
    canManageClub: true,
    canManageEvents: true,
    canManageMembers: true,
    canViewAnalytics: true,
    isOwner: true,
  },
  createdAt: admin.firestore.Timestamp.fromDate(new Date("2025-08-25T18:28:23+05:30")),
  lastLoginAt: null,
};

// --------------------------- UPLOAD FUNCTION ---------------------------
async function uploadAdmin() {
  try {
    console.log("🚀 Uploading admin data...");

    await db.collection("admins").doc(adminData.uid).set(adminData);

    console.log("✅ Admin data added successfully!");
  } catch (error) {
    console.error("❌ Error adding admin data:", error);
  }
}

uploadAdmin();
