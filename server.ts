import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// We use two separate app instances to handle project ID mismatches
// 1. authApp: Matches the project ID in the config to verify frontend tokens
// 2. dbApp: Uses auto-detection to leverage the environment's service account permissions
let authApp: admin.app.App;
let dbApp: admin.app.App;

try {
  // Initialize Auth App with explicit Project ID from config
  authApp = admin.initializeApp({
    projectId: firebaseConfig.projectId,
  }, "auth-app");
  console.log(`Auth App initialized for project: ${firebaseConfig.projectId}`);
} catch (error) {
  console.error("Error initializing Auth App:", error);
  authApp = admin.app(); // Fallback
}

try {
  // Initialize DB App with auto-detection (best for Cloud Run permissions)
  dbApp = admin.initializeApp({}, "db-app");
  console.log("DB App initialized with auto-detection");
} catch (error) {
  console.error("Error initializing DB App, falling back to Auth App:", error);
  dbApp = authApp;
}

const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
const db = getFirestore(dbApp, databaseId);
const auth = admin.auth(authApp);

console.log(`Firestore initialized using ${dbApp.name === "db-app" ? "auto-detected" : "explicit"} project.`);
console.log(`Targeting database: ${databaseId}`);

const server = express();
server.use(express.json());

const PORT = 3000;

// Health check endpoint
server.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    authProjectId: firebaseConfig.projectId, 
    databaseId: databaseId,
    dbAppName: dbApp.name,
    authAppName: authApp.name
  });
});

// Admin User Deletion Endpoint
server.post("/api/admin/delete-user", async (req, res) => {
  const { userId, adminToken } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (!adminToken) {
    return res.status(401).json({ error: "Admin token is required" });
  }

  try {
    console.log(`Attempting to delete user: ${userId}`);
    
    // Verify requester is an admin
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(adminToken);
      console.log(`Token verified for user: ${decodedToken.uid}`);
    } catch (verifyError: any) {
      console.error("Error verifying admin token:", verifyError);
      return res.status(401).json({ error: "Invalid admin token: " + verifyError.message });
    }

    let adminUserDoc;
    try {
      adminUserDoc = await db.collection("users").doc(decodedToken.uid).get();
      console.log(`Admin check for ${decodedToken.uid}: exists=${adminUserDoc.exists}`);
    } catch (dbError: any) {
      console.error("Database error during admin check:", dbError);
      return res.status(500).json({ 
        error: "Database permission error during admin check. This usually means the service account lacks permissions.",
        details: dbError.message,
        code: dbError.code
      });
    }
    
    if (!adminUserDoc.exists || adminUserDoc.data()?.role !== "admin") {
      console.warn(`Unauthorized delete attempt by user ${decodedToken.uid}`);
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found in Firestore" });
    }

    const userData = userDoc.data();

    // 1. Delete from Firestore (and related collections)
    console.log(`Starting Firestore deletion batch for user: ${userId}`);
    const batch = db.batch();
    
    // Delete main user doc
    batch.delete(db.collection("users").doc(userId));
    
    // Delete username mapping
    if (userData?.username) {
      batch.delete(db.collection("usernames").doc(userData.username.toLowerCase()));
    }
    
    // Delete referral code mapping
    if (userData?.referral_code) {
      batch.delete(db.collection("referral_codes").doc(userData.referral_code.toUpperCase()));
    }
    
    // Delete public profile
    batch.delete(db.collection("public_profiles").doc(userId));
    
    // Delete any referrals where this user was the referee
    try {
      console.log(`Finding referrals for referee_id: ${userId}`);
      const refereeRefs = await db.collection("referrals").where("referee_id", "==", userId).get();
      console.log(`Found ${refereeRefs.size} referrals to delete`);
      refereeRefs.forEach(doc => batch.delete(doc.ref));
    } catch (e: any) {
      console.warn("Error finding referee referrals (this might be a permission error on the referrals collection):", e);
      // If this is a permission error, we might want to know
      if (e.code === 7 || e.message?.includes("PERMISSION_DENIED")) {
        throw new Error(`Permission denied while querying referrals collection: ${e.message}`);
      }
    }

    try {
      console.log("Committing Firestore batch...");
      await batch.commit();
      console.log(`Firestore data for user ${userId} deleted successfully.`);
    } catch (batchError: any) {
      console.error("Error committing Firestore batch:", batchError);
      throw new Error(`Permission denied while committing batch deletion: ${batchError.message}`);
    }

    // 2. Delete from Firebase Authentication
    try {
      console.log(`Attempting to delete user ${userId} from Auth...`);
      await auth.deleteUser(userId);
      console.log(`Firebase Auth user ${userId} deleted successfully.`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found' || authError.message?.includes('NOT_FOUND')) {
        console.warn(`User ${userId} already deleted from Firebase Auth or not found.`);
      } else {
        console.error(`Error deleting user ${userId} from Auth:`, authError);
        // We don't necessarily want to fail the whole request if Auth deletion fails 
        // but Firestore succeeded, but it's better to know.
      }
    }

    res.json({ success: true, message: "User permanently deleted from Firestore and Authentication" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    server.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    server.use(express.static(distPath));
    server.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
