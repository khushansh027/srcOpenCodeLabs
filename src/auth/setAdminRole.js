// setAdminRole.js
// import { initializeApp, applicationDefault } from "firebase-admin/app";
// import { getAuth } from "firebase-admin/auth";

// initializeApp({
//   credential: applicationDefault(), // uses GOOGLE_APPLICATION_CREDENTIALS env var
// });

// const uid = "20KXaqPE3GStbWLienlfHqwjFrS2"; // <-- replace with your actual Firebase UID

// async function setAdminRole() {
//   try {
//     await getAuth().setCustomUserClaims(uid, { role: "admin" });
//     console.log("✅ Custom claim set for admin:", uid);
//   } catch (err) {
//     console.error("❌ Failed to set claim:", err);
//   }
// }

// setAdminRole();
