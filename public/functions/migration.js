const admin = require('firebase-admin');
admin.initializeApp();

// Get reference to Firestore
const db = admin.firestore();

// Function to migrate documents
async function migrateRegistrations() {
    console.log('🚀 Starting migration...');
    
    try {
        const snapshot = await db.collection('registrations').get();
        console.log(`Found ${snapshot.size} documents to migrate`);
        
        let migrated = 0;
        let skipped = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const oldId = doc.id;
            const newId = `${data.userId}_${data.eventId}`;
            
            // Check if document ID already correct
            if (oldId === newId) {
                console.log(`⏭️ Skipping ${oldId} (already correct format)`);
                skipped++;
                continue;
            }
            
            // Create new document with correct ID
            await db.collection('registrations').doc(newId).set(data);
            console.log(`✅ Created: ${newId}`);
            
            // Delete old document
            await db.collection('registrations').doc(oldId).delete();
            console.log(`🗑️ Deleted: ${oldId}`);
            
            migrated++;
        }
        
        console.log(`\n✅ Migration Complete!`);
        console.log(`📊 Migrated: ${migrated} documents`);
        console.log(`⏭️ Skipped: ${skipped} documents`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

// Run the migration
migrateRegistrations();