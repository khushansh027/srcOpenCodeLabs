import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
// import { doc, onSnapshot } from "firebase/firestore";
// import { db } from "../../../database/firebaseInit.js";
import { userSelector } from "../../../ReduxToolKit/Slices/UserSlice.js";
import { fetchEnrolledCourses, enrollmentSelector } from "../../../ReduxToolKit/Slices/EnrollmentSlice.js";

import profile from '../../../icons/profile.png';
import courses from '../../../icons/courses.png';
import styles from './StudentDashboard.module.css';


function StudentDashboard() {
    
    const dispatch = useDispatch();
    const user = useSelector(userSelector);
    
    // Get enrollment count from Redux
    const enrollmentState = useSelector(enrollmentSelector);
    const enrolledCount = enrollmentState?.allIds?.length || 0;
  
    const userId = user?.uid;
    const userRole = user?.role;
    console.log("Redux user:", user ?? "⏳ not yet synced");
    console.log("Enrolled count:", enrolledCount);
    // Redux manages global auth state, but asynchronous delays can leave it empty for a short time.
    // So I use a local fallback state to fetch user data directly from Firestore if Redux hasn't caught up yet.
    // This ensures the UI always shows something consistent.
    // const redux = useSelector(userSelector);
    // const reduxUser = redux?.user ?? null;
    // const [localUser, setLocalUser] = useState(null);
    // const user = reduxUser || localUser;
    // console.log("Redux user:", user ?? "⏳ not yet synced (using Firestore fallback)");// debug

    // state to track enrolled courses
    // const [enrolledCourses, setEnrolledCourses] = useState(0);

    // If Redux didn't hydrate in time, fall back to Firestore directly so the dashboard can still display user data
    // useEffect(() => {
    //     let mounted = true;
    //     async function tryLoadFromFirestore() {
    //         if (!reduxUser) {
    //             try {
    //                 // fetch auth and usr doc from database
    //                 const { auth, getUserDoc: getUserDocHelper } = await import("../../../auth/auth.js");
    //                 const uid = auth?.currentUser?.uid;
    //                 // if it exists fetch user id and set user
    //                 if (uid) {
    //                     const userDoc = await getUserDocHelper(uid);
    //                     if (mounted && userDoc) setLocalUser(userDoc);
    //                 }
    //             } catch (err) {
    //                 // silent fallback
    //                 console.error('Error during fetching data from Firestore:', err);
    //             }
    //         }
    //     }
    //     tryLoadFromFirestore();
    //     // cleanup:  why? : We add cleanup inside useEffect so that when a component unmounts,this not only avoids memory leaks 
    //     return () => { mounted = false; };
    // },
    //     [reduxUser] // dependency array
    // );

    // useEffect(() => {
    //     let unsub = null;
    //     const uid = reduxUser?.uid ?? localUser?.uid ?? null;
    //     if (!uid) return;

    //     unsub = onSnapshot(doc(db, "users", uid), (snap) => {
    //         if (snap.exists()) {
    //             const data = snap.data();
    //             setEnrolledCourses(data.enrolledCourses?.length || 0);
    //             // keep local fallback in sync
    //             setLocalUser(prev => ({ ...(prev || {}), ...data, uid }));
    //         } else {
    //             setEnrolledCourses(0);
    //         }
    //     });

    //     // we close Firebase listeners and prevent React from updating state on dead components this stops unnecessary Firestore reads.
    //     // Which directly reduces costs in production since providers like Firebase and AWS bill per read/write
    //     return () => { if (unsub) unsub(); };
    // },
    //     [reduxUser?.uid, localUser?.uid]
    // );

    //  Fetch enrollments when component mounts
    useEffect(() => {
        if (userId && userRole === "student") {
            dispatch(fetchEnrolledCourses());
        }
    }, [dispatch, userId, userRole]);

    return (
        <div className={styles.studentDashboardContainer}>
            
            <h1>{user?.displayName || user?.name || "Student"}'s Dashboard</h1>

            <div className={styles.studentDashboardGrid}>
                {/* Card 1 - Enrolled Courses */}
                <div className={styles.profileCard}>
                    <div className={styles.cardHeader}>
                        <img src={courses} alt="profileImg" className={styles.profileIcon}></img>
                    </div>
                    <div className={styles.cardContent}>
                        <h2 className="hover:scale-120 transition-transform duration-300">
                            Enrolled Courses
                        </h2>
                        <p className={styles.courseCount}>
                            {enrolledCount}
                        </p>
                        <Link
                            to="/student/my-courses"
                            className="hover:scale-110 transition-transform duration-300"
                        >
                            <span className={styles.courseLink}>View My Courses</span>
                        </Link>
                    </div>
                </div>

                {/* Card 2 - Profile */}
                <div className={styles.profileCard}>
                    <div className={styles.cardHeader}>
                        <img src={profile} alt="profileImg" className={styles.profileIcon}></img>
                    </div>
                    <div className={styles.cardContent}>
                        <h2 className="hover:scale-120 transition-transform duration-300">
                            Profile
                        </h2>
                        <p className="text-xl font-medium text-violet-500">
                            Name: <span className="text-xl font-bold text-white">{user?.name}</span>
                        </p>
                        <p className="text-xl font-medium text-violet-500">
                            Email: <span className="text-xl font-bold text-white">{user?.email}</span>
                        </p>
                        <Link
                            to="/student/profile"
                            className="hover:scale-110 transition-transform duration-300"
                        >
                            Edit Profile
                        </Link>
                    </div>
                </div>
            </div>
        </div>        
    );
}

export default StudentDashboard;