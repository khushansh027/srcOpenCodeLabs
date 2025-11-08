// new user schema to be used while creating user document in Firestore
import { serverTimestamp } from "firebase/firestore";

export const defaultUserSchema = (user, name = "", role = "student") => ({
    uid: user.uid,
    name: name || user.displayName || "",
    email: user.email,
    role, // defaults to "student" unless explicitly passed as "admin"
    phone: null,
    bio: null,
    enrolledCourses: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
});
