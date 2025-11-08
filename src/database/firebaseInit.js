import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";  
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdimkvYFUpVSqKanEvhHEVjPjMLGrhfEE",
  authDomain: "opencodelabs-181222lm.firebaseapp.com",
  projectId: "opencodelabs-181222lm",
  storageBucket: "opencodelabs-181222lm.firebasestorage.app",
  // storageBucket: "opencodelabs-181222lm.firebasestorage.app",
  messagingSenderId: "385252366716",
  appId: "1:385252366716:web:620a8e705c2e3f353f6cf9"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize storage
export const storage = getStorage(app);