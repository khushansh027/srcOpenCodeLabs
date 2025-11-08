import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../database/firebaseInit.js";
import { userSelector } from "../../ReduxToolKit/Slices/UserSlice.js";
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
    // state to keep track of users and courses 
    const [TotalCourses, setTotalCourses] = useState(0);
    const [TotalUsers, setTotalUsers] = useState(0);

    // hooks to access URL navigation and logged-in user
    const navigate = useNavigate();
    const user = useSelector(userSelector);

    useEffect(() => {
        // update live count of users from firestore
        const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            setTotalUsers(snapshot.size);
            // debug
            console.log("Total Users:", snapshot.size);
        });

        // update live count of courses from firestore
        const unsubCourses = onSnapshot(collection(db, "courses"), (snapshot) => {
            setTotalCourses(snapshot.size);;
            // debug
            console.log("Total Courses:", snapshot.size);
        });

        // cleanup: unsubscribe listeners when component unmounts
        return () => {
            unsubUsers();
            unsubCourses();
        };
    }, []); // dependecy array

    return (
        <section className={styles.dashboardRoot}>
            <h1 className={styles.header}>Admin Dashboard</h1>
            <p className={styles.subtext}>
                Welcome back, <span>{user?.name || 'Admin'}</span> 👋
            </p>

            <div className={styles.statsGrid}>
                <div className={`${styles.card} ${styles.purpleGlow}`}>
                    <h3>Total Courses</h3>
                    <p className={styles.value}>{TotalCourses}</p>
                </div>

                <div className={`${styles.card} ${styles.blueGlow}`}>
                    <h3>Total Users</h3>
                    <p className={styles.value}>{TotalUsers}</p>
                </div>
            </div>

            <div className={styles.actions}>
                <button
                    onClick={() => navigate("/admin/courses")}
                    className={`${styles.btn} ${styles.secondaryBtn}`}
                >
                    Manage Courses
                </button>
                <button
                    onClick={() => navigate("/admin/courses/new")}
                    className={`${styles.btn} ${styles.primaryBtn}`}
                >
                    Create Course
                </button>
            </div>
        </section>
    );
}

