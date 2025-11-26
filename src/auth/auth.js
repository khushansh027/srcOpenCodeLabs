import { getAuth, signOut, updateProfile, onAuthStateChanged as onAuthStateChangedFirebase, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../database/firebaseInit.js";
import { defaultUserSchema } from "../database/schema/userSchema.js";

const auth = getAuth(); // initial authorization

/* Bridge between Firebase Auth (basic user info) and Firestore (your custom user schema)
    // Firebase Auth only knows about the authentication fields (uid, email, displayName, photoURL).
    // It does not know about extra fields like role, createdAt, etc to read those extra fields
    // (like role), you must explicitly fetch the Firestore doc you created with defaultUserSchema */
const getUserDoc = async (uid) => {
    try {
        const userDocRef = doc(db, "users", uid);
        const snap = await getDoc(userDocRef);

        if (!snap.exists()) return null;

        const raw = snap.data();

        // inline normalization of Firestore timestamps to milliseconds
        for (const key in raw) {
            if (raw[key]?.toMillis) {
                raw[key] = raw[key].toMillis();
            }
        }

        return { uid, ...raw };
    } catch (error) {
        // ✅ Retry on network errors
        if (error.code === 'unavailable' && retries > 0) {
            console.warn(`Network error, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            return getUserDoc(uid, retries - 1);
        }

        console.error("Error fetching user document:", error);
        return null;
    }
};

// helper function to switch roles real-time
const subscribeUserDoc = (uid, callback) => {
    const userDocRef = doc(db, "users", uid);
    return onSnapshot(
        userDocRef,
        (snap) => {
            if (!snap.exists()) {
                callback(null);
                return;
            }
            const raw = snap.data();

            // Normalize timestamps
            for (const key in raw) {
                if (raw[key]?.toMillis) {
                    raw[key] = raw[key].toMillis();
                }
            }
            callback({ uid, ...raw });
        }
    );
};

//-------------------------------------------------authentication functions-----------------------------------------------
const Signup = async (name, email, password) => {
    try {
        const newUserCredentials = await createUserWithEmailAndPassword(auth, email, password);
        const user = newUserCredentials.user;

        // update displayName in Firebase Auth if provided
        if (name) await updateProfile(user, { displayName: name });

        const userDocRef = doc(db, "users", user.uid);

        // write user doc (single write, merge to avoid accidental overwrite)
        await setDoc(userDocRef, {
            ...defaultUserSchema(user, name),
            createdAt: serverTimestamp()
        }, { merge: true });

        // fetch the stored user doc with role included
        const userDoc = await getUserDoc(user.uid);
        if (!userDoc) {
            return { uid: user.uid, ...defaultUserSchema(user, name) };
        }
        return userDoc;
    } catch (error) {
        console.error("Sign Up Error:", error);
        
        let errorMessage = "Signup failed. Please try again.";

        if (error.code === "auth/email-already-in-use") {
            errorMessage = "This email is already registered. Please login instead.";
        } else if (error.code === "auth/weak-password") {
            errorMessage = "Password should be at least 6 characters.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "Please enter a valid email address.";
        } else if (error.code === "auth/operation-not-allowed") {
            errorMessage = "Email/password accounts are not enabled. Please contact support.";
        } else if (error.code === "auth/too-many-requests") {
            errorMessage = "Too many signup attempts. Please try again later.";
        } else if (error.code === "auth/network-request-failed") {
            errorMessage = "Network error. Please check your connection and try again.";
        }

        throw new Error(errorMessage);
    }
};

const Login = async (email, password) => {
    try {
        const userCredentials = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredentials || !userCredentials.user) {
            console.error("Invalid Firebase response:", userCredentials);
            throw new Error("Login failed. Please try again.");
        }

        const user = userCredentials.user;

        // fetch the stored user doc with role included
        const userDoc = await getUserDoc(user.uid);
        if (userDoc) return userDoc;

        // Fallback if user doc missing
        console.warn("User doc not found in Firestore for uid:", user.uid);

        // fallback if user doc missing
        return {
            uid: user.uid,
            name: user.displayName || null,
            email: user.email,
            role: "student"
        };
    } catch (error) {
        console.error("Sign In Error:", error);
        
        let errorMessage = "Login failed. Please try again.";

        if (error.code === "auth/invalid-credential") {
            errorMessage = "Invalid email or password. Please try again.";
        } else if (error.code === "auth/user-not-found") {
            errorMessage = "No account found with this email.";
        } else if (error.code === "auth/wrong-password") {
            errorMessage = "Incorrect password. Please try again.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "Please enter a valid email address.";
        } else if (error.code === "auth/too-many-requests") {
            errorMessage = "Too many failed attempts. Please try again later.";
        } else if (error.code === "auth/user-disabled") {
            errorMessage = "This account has been disabled.";
        }

        throw new Error(errorMessage);
    }
};

const Logout = async () => {
    try {
        await signOut(auth);
        return true;
    } catch (error) {
        console.error("Logout Error:", error);
        throw new Error(error?.message || "Logout failed");
    }
};

export { Signup, Login, Logout, getUserDoc, subscribeUserDoc, auth, onAuthStateChangedFirebase };