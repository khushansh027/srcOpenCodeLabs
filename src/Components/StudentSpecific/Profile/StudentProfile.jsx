// Firestore helpers to update documents and create server timestamps
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
// Firebase Auth to update the displayName if needed
import { getAuth, updateProfile as updateAuthProfile } from "firebase/auth";

import { useEffect, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { db } from "../../../database/firebaseInit.js";
import { userSelector, setUser, setLoading, setError } from "../../../ReduxToolKit/Slices/UserSlice.js";
import profileSetting from '../../../icons/profileSeeting.png';
import styles from "./StudentProfile.module.css";
import { Link } from "react-router";

// handle "createdAt" string to convert and display better
function formatTimestamp(ts) {
    // Debug info to see the actual shape of your timestamp
    console.log("🕒 [formatTimestamp] Raw value:", ts, "| Type:", typeof ts);

    // explicit null/undefined -> show placeholder
    if (ts === null || ts === undefined) return "—";

    let dateObj = null;

    try {
        // Firestore Timestamp object
        if (typeof ts === "object" && ts !== null && typeof ts.toDate === "function") {
            dateObj = ts.toDate();
        }
        // Firestore-like object { seconds: 1234567890 }
        else if (typeof ts === "object" && ts !== null && "seconds" in ts) {
            dateObj = new Date(ts.seconds * 1000);
        }
        // Already a JS Date instance
        else if (ts instanceof Date) {
            dateObj = ts;
        }
        // Numeric timestamp (ms)
        else if (typeof ts === "number") {
            dateObj = new Date(ts);
        }
        // ISO or string timestamp
        else if (typeof ts === "string" && !isNaN(Date.parse(ts))) {
            dateObj = new Date(ts);
        }
    } catch (e) {
        console.warn("⚠️ [formatTimestamp] Failed to parse timestamp:", e);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
        console.warn("⚠️ [formatTimestamp] Invalid timestamp:", ts);
        return "—";
    }

    // ✅ Pretty, short format (e.g. Jan 1, 2024)
    return dateObj.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}


function StudentProfile() {

    const dispatch = useDispatch();

    // reference current user
    const user = useSelector(userSelector);

    // local state for profile form
    const [form, setForm] = useState({ name: "", phone: "", bio: "" });

    // if user exists sync local data with prefilled data
    useEffect(() => {
        if (user) {
            setForm({
                name: user.name || "",
                phone: user.phone || "",
                bio: user.bio || "",
            });
        }
    }, [user]);
    // if no user, show warning
    if (!user) return <div className={styles.message}>Please log in to view your profile.</div>;

    // make a difference function, that store changed values
    const diff = useMemo(() => {
        // empty object to store different values
        const d = {};
        // check name, store if changed
        const nameTrim = (form.name || "").trim();
        if ((nameTrim) !== (user.name || "")) d.name = nameTrim || null;
        // check phone, store if changed
        if ((form.phone || "") !== (user.phone || "")) d.phone = form.phone || null;
        // check bio, store if changed
        if ((form.bio || "") !== (user.bio || "")) d.bio = form.bio || null;
        // return updated difference object
        return d;
    }, [form, user]);

    // disable save button if difference array length is 0, because that means no changes were made to the form 
    const hasChanges = Object.keys(diff).length > 0; // Object.keys() turns obj to arr

    const handleSave = async (e) => {
        // Prevent default form submission
        e.preventDefault();

        // If nothing changed, do nothing
        if (!hasChanges) return;

        // Validate name type and length
        if (typeof diff.name === "string" && diff.name.length > 0 && diff.name.length < 2) {
            dispatch(setError("Name must contain alteast 2 characters !!"));
            return;
        }

        // convert the difference array and its update time into data object
        const data = { ...diff, updatedAt: serverTimestamp() };
        // save user's ref so we can update the current data yet still have reference of old data
        let oldUser = user;
        // set loading true for ui affect
        dispatch(setLoading(true));
        // change fields and updating time
        dispatch(setUser({ ...user, ...diff, updatedAt: Date.now() }));


        try {
            // update user data in database
            await updateDoc(doc(db, "users", user.uid), data);
            // if changed name's data type is string
            if (typeof diff.name === "string") {
                // check auth and if databse name is different from new name
                const auth = getAuth();
                if (auth.currentUser && auth.currentUser.displayName !== diff.name) {
                    // if so, update name in auth profile
                    await updateAuthProfile(auth.currentUser, { displayName: diff.name });
                }
            }
        } catch (err) {
            // On failure, revert the optimistic update and show an error
            dispatch(setUser(prevUser));
            dispatch(setError(err?.message || "Profile update failed"));
        } finally {
            // Clear loading state regardless of success/failure
            dispatch(setLoading(false));
        }
    };

    // function to handle skip and keep form data as it is.
    const handleSkip = () => {
        setForm({
            name: user.name || "",
            phone: user.phone || "",
            bio: user.bio || "",
        });
    };

    return (
        <>
            <div className={styles.backWrap}>
                <Link to="/student/dashboard" className={styles.backWrap}>&larr; Back to Dashboard</Link>
            </div>
            <div className={styles.container}>
                <h1 className={styles.title}>MY PROFILE</h1>

                <div className={styles.profileWrapper}>

                    <section className={styles.imageSection}>
                        <img src={profileSetting} alt="Profile" className={styles.profileImg} />
                    </section>

                    <section className={styles.formSection}>
                        <form onSubmit={handleSave} className={styles.form}>

                            <div className={styles.formGroup}>
                                <label>Email <i>(read only)</i></label>
                                <input value={user.email || ""} readOnly className={styles.inputReadonly} />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Name</label>
                                <input
                                    name="name"
                                    value={form.name}
                                    // from the form update user name
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className={styles.input}
                                    placeholder="Your name"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Phone</label>
                                <input
                                    name="phone"
                                    value={form.phone}
                                    // from the form update user phone number
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className={styles.input}
                                    placeholder="Phone number"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Bio</label>
                                <textarea
                                    name="bio"
                                    value={form.bio}
                                    // from the form update user bio
                                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                                    className={styles.textarea}
                                    rows={4}
                                    placeholder="Tell us about yourself"
                                />
                            </div>

                            <div className={styles.buttonRow}>
                                <button
                                    type="submit"
                                    disabled={!hasChanges}
                                    className={`${styles.button} ${hasChanges ? styles.buttonActive : styles.buttonDisabled}`}
                                >
                                    Save
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className={styles.buttonSecondary}
                                >
                                    Skip
                                </button>
                            </div>

                            <p className={styles.joined}>
                                Joined: {formatTimestamp(user.createdAt)}
                            </p>

                        </form>
                    </section>

                </div>

            </div>
        </>
    );
}

export default StudentProfile;
