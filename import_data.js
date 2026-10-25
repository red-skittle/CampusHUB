const admin = require("firebase-admin");
const serviceAccount = require("./campus.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// --------------------------- CLUBS DATA ---------------------------
const clubsData=[]

// --------------------------- EVENTS DATA ---------------------------
const eventsData = [
  // --- ACM Student Chapter Events --- //
  {
    id: "acmhackathon2025",
    clubId: "acm_student_chapter",
    title: "ACM Hackathon 2025",
    category: "Hackathon",
    bannerImage: "https://example.com/acm-hackathon-banner.jpg",
    venue: "Computer Lab, MUJ",
    startDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-12T10:00:00Z")),
    endDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-13T18:00:00Z")),
    status: "Upcoming",
    mode: "Offline",
    teamSize: "Team of 4",
    eligibility: "Open for all MUJ students",
    entryFee: 100,
    prizePool: 12000,
    registrationDeadline: admin.firestore.Timestamp.fromDate(new Date("2025-11-10T23:59:00Z")),
    registrationLink: "https://acmmuj.in/hackathon",
    highlights: ["Coding marathon", "AI & ML tracks", "Mentorship sessions"],
    description: "Join ACM Hackathon to build innovative solutions and showcase your coding skills."
  },
  {
    id: "codemania2025",
    clubId: "acm_student_chapter",
    title: "CodeMania 2025",
    category: "Coding Competition",
    bannerImage: "https://example.com/codemanias-banner.jpg",
    venue: "Computer Lab, MUJ",
    startDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-20T09:00:00Z")),
    endDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-20T16:00:00Z")),
    status: "Upcoming",
    mode: "Offline",
    teamSize: "Solo",
    eligibility: "Open for all students",
    entryFee: 0, // ✅ Free Event
    prizePool: 5000,
    registrationDeadline: admin.firestore.Timestamp.fromDate(new Date("2025-11-18T23:59:00Z")),
    registrationLink: "https://acmmuj.in/codemanias",
    highlights: ["Algorithm challenges", "Competitive coding rounds", "Leaderboard prizes"],
    description: "Test your coding skills in ACM CodeMania and compete for top ranks."
  },
  {
    id: "acmwebdev2025",
    clubId: "acm_student_chapter",
    title: "WebDev Workshop 2025",
    category: "Workshop",
    bannerImage: "https://example.com/webdev-banner.jpg",
    venue: "Lab AB-2, MUJ",
    startDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-25T11:00:00Z")),
    endDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-25T15:00:00Z")),
    status: "Upcoming",
    mode: "Offline",
    teamSize: "Solo",
    eligibility: "Open for MUJ students",
    entryFee: 0, // ✅ Free Event
    prizePool: 0,
    registrationDeadline: admin.firestore.Timestamp.fromDate(new Date("2025-11-23T23:59:00Z")),
    registrationLink: "https://acmmuj.in/webdev",
    highlights: ["Frontend basics", "Hands-on projects", "Live Q&A with mentors"],
    description: "Learn to build responsive websites and improve your web development skills."
  },
  {
    id: "datasci2025",
    clubId: "acm_student_chapter",
    title: "Data Science Bootcamp",
    category: "Workshop",
    bannerImage: "https://example.com/datasci-banner.jpg",
    venue: "Computer Lab, MUJ",
    startDate: admin.firestore.Timestamp.fromDate(new Date("2025-12-01T10:00:00Z")),
    endDate: admin.firestore.Timestamp.fromDate(new Date("2025-12-01T17:00:00Z")),
    status: "Upcoming",
    mode: "Offline",
    teamSize: "Solo",
    eligibility: "Open for all",
    entryFee: 150,
    prizePool: 0,
    registrationDeadline: admin.firestore.Timestamp.fromDate(new Date("2025-11-29T23:59:00Z")),
    registrationLink: "https://acmmuj.in/datasci",
    highlights: ["Python & Pandas", "Data visualization", "Mini project"],
    description: "Kickstart your data science journey with hands-on exercises and guided projects."
  },
  {
    id: "aichallenge2025",
    clubId: "acm_student_chapter",
    title: "AI Challenge 2025",
    category: "Competition",
    bannerImage: "https://example.com/aichallenge-banner.jpg",
    venue: "Innovation Lab, MUJ",
    startDate: admin.firestore.Timestamp.fromDate(new Date("2025-12-05T10:00:00Z")),
    endDate: admin.firestore.Timestamp.fromDate(new Date("2025-12-05T18:00:00Z")),
    status: "Upcoming",
    mode: "Offline",
    teamSize: "Team of 2",
    eligibility: "Open for all universities",
    entryFee: 200,
    prizePool: 15000,
    registrationDeadline: admin.firestore.Timestamp.fromDate(new Date("2025-12-03T23:59:00Z")),
    registrationLink: "https://acmmuj.in/aichallenge",
    highlights: ["ML projects", "Model building", "Industry mentorship"],
    description: "Solve real-world AI problems and showcase your machine learning skills."
  },
  {
    id: "codingdojo2025",
    clubId: "acm_student_chapter",
    title: "Coding Dojo 2025",
    category: "Workshop",
    bannerImage: "https://example.com/codingdojo-banner.jpg",
    venue: "Lab AB-1, MUJ",
    startDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-28T14:00:00Z")),
    endDate: admin.firestore.Timestamp.fromDate(new Date("2025-11-28T18:00:00Z")),
    status: "Upcoming",
    mode: "Offline",
    teamSize: "Solo",
    eligibility: "Open for MUJ students",
    entryFee: 0, // ✅ Free Event
    prizePool: 0,
    registrationDeadline: admin.firestore.Timestamp.fromDate(new Date("2025-11-26T23:59:00Z")),
    registrationLink: "https://acmmuj.in/codingdojo",
    highlights: ["Hands-on coding exercises", "Debugging tips", "Mentor support"],
    description: "Enhance your problem-solving skills through practical coding exercises and mentorship."
  },
]

// --------------------------- IMPORT FUNCTION ---------------------------
async function importClubsAndEvents() {
  try {
    console.log("🚀 Importing clubs and events...");

    // Add timestamps automatically
    const now = admin.firestore.Timestamp.now();

    // Add all clubs
    const clubPromises = clubsData.map((club) =>
      db.collection("clubs").doc(club.id).set({
        ...club,
        createdAt: now,
        updatedAt: now,
      })
    );

    // Add all events
    const eventPromises = eventsData.map((event) =>
      db.collection("events").doc(event.id).set({
        ...event,
        createdAt: now,
        updatedAt: now,
      })
    );

    await Promise.all([...clubPromises, ...eventPromises]);

    console.log("✅ All clubs and events imported successfully!");
  } catch (error) {
    console.error("❌ Error importing data:", error);
  }
}

importClubsAndEvents();
