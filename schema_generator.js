
const admin = require("firebase-admin");
const serviceAccount = require("./campus.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function generateSchema() {
  try {
    const collections = await db.listCollections();
    for (const collection of collections) {
      console.log(`Collection: ${collection.id}`);
      const snapshot = await collection.limit(1).get();
      if (snapshot.empty) {
        console.log("  No documents in this collection.");
        continue;
      }
      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log("  Schema:");
      for (const key in data) {
        const value = data[key];
        let type = typeof value;
        if (value && typeof value === 'object' && value._seconds) {
            type = 'Timestamp';
        }
        console.log(`    ${key}: ${type}`);
      }
    }
  } catch (error) {
    console.error("Error generating schema:", error);
  } finally {
    process.exit();
  }
}

generateSchema();
