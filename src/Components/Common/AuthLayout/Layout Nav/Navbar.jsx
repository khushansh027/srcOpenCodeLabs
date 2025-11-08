import { NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, userSelector } from "../../../../ReduxToolKit/Slices/UserSlice.js";
import styles from "./Navbar.module.css";
function Navbar() {
    const dispatch = useDispatch();
    const user = useSelector(userSelector);

    // 1. Determine if the user is an Admin
    const isAdmin = user && user.role === 'admin';

    // 2. Define the dynamic path for the Courses link
    // If the user is an Admin, the path is '/admin/courses', otherwise it's '/courses'
    const coursesPath = isAdmin ? "/admin/courses" : "/courses";

    return (
        <nav className={`${styles["nav-bg"]} w-full text-amber-50 px-6 py-4 shadow-lg`}>
            {/* Parent now stretches full width */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">

                {/* Left: Logo (hug left edge) */}
                <div className="text-2xl md:text-3xl text-indigo-400 font-extrabold tracking-wide hover:scale-105 transition-transform duration-300">
                    <NavLink to="/">OpenCodeLabs.dev</NavLink>
                </div>

                {/* Center: Common Links */}
                <div className={`${styles.root} flex flex-col md:flex-row items-center gap-4 md:gap-8 text-lg md:text-xl font-semibold`}>

                    <NavLink
                        to="/about-us"
                        className={({ isActive }) =>
                            `transition-transform duration-300 hover:scale-110 ${isActive ? "text-slate-200 underline" : "hover:text-indigo-300"
                            }`
                        }
                    >
                        About Us
                    </NavLink>

                    <NavLink
                        to={coursesPath}
                        className={({ isActive }) =>
                            `transition-transform duration-300 hover:scale-110 ${isActive ? "text-slate-300 underline" : "hover:text-indigo-300"
                            }`
                        }
                    >
                        Courses
                    </NavLink>
                </div>

                {/* Right: Auth Links (hug right edge) */}
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-lg md:text-xl font-semibold">

                    {/*Conditional Rendering*/}
                    {user ? (
                        <>
                            <NavLink
                                to={user.role === "admin" ? "/admin/dashboard" : `/student/dashboard`}
                                className={({ isActive }) =>
                                    `transition-transform duration-300 hover:scale-110 ${isActive ? "text-slate-200 underline" : "hover:text-indigo-400 underline"
                                    }`
                                }
                            >
                                Dashboard
                            </NavLink>

                            {/* <NavLink
                to={user.role === "admin" ? "/admin/courses" : "/courses"}
                className={({ isActive }) =>
                `transition-transform duration-300 hover:scale-110 ${
                    isActive ? "text-yellow-300 underline" : "hover:text-yellow-200"
                }`
                }
            >
                -Courses
            </NavLink> */}

                            <button
                                onClick={() => dispatch(logoutUser())}
                                className="bg-rose-500 hover:bg-rose-700 px-5 py-2 rounded text-white transition-transform duration-300 hover:scale-105"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink
                                to="/register"
                                className={({ isActive }) =>
                                    `transition-transform duration-300 hover:scale-110 ${isActive ? "text-yellow-300 underline" : "hover:text-yellow-200"
                                    }`
                                }
                            >
                                Register
                            </NavLink>

                            <NavLink
                                to="/login"
                                className={({ isActive }) =>
                                    `transition-transform duration-300 hover:scale-110 ${isActive ? "text-yellow-300 underline" : "hover:text-yellow-200"
                                    }`
                                }
                            >
                                Login
                            </NavLink>
                        </>
                    )}
                </div>
            </div>
        </nav>

    );
}

export default Navbar;
