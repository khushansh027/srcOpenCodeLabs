import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { userSelector } from "../../../ReduxToolKit/Slices/UserSlice.js";
import { enrollmentSelector, fetchEnrolledCourses, unenrollFromCourse } from "../../../ReduxToolKit/Slices/EnrollmentSlice.js";
import { fetchCourses, selectCourses } from "../../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
// css
import styles from "./MyCourses.module.css";

function EnrolledCourses() {
    // hooks & states
    const dispatch = useDispatch();
    const user = useSelector(userSelector);
    const firstName = user?.name?.split(" ")[0] || "Student";
    const userId = user?.uid;
    const role = user?.role || "Guest";

    // get enrollment state from redux
    const enrollState = useSelector(enrollmentSelector) || {};
    // destructure enrollment state
    const {
        allIds: enrollmentIds = [],
        byId: enrollById = {},
        loading = false,
        error = null,
    } = enrollState;

    // get courses state from redux
    const coursesState = useSelector(selectCourses) || {};
    // destructure courses state
    const coursesById = coursesState.byId || {};

    // fetch enrolled courses and all courses on component mount
    useEffect(() => {
        if (role === "student" && userId) {
            dispatch(fetchEnrolledCourses());
            dispatch(fetchCourses());
        }
    }, [dispatch, userId, role]);

    if (loading)
        return (
            <div className="min-h-screen flex justify-center items-center bg-gray-950 text-indigo-400 text-xl">
                Loading your courses…
            </div>
        );

    if (error)
        return (
            <p className="text-red-500 text-center mt-10 text-lg font-semibold">
                Error: {error}
            </p>
        );

    return (
        <div className="bg-gray-950 min-h-screen py-16 px-6 flex flex-col items-center">
            <div className="max-w-6xl w-full text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                    {firstName}'s Enrolled Courses
                </h1>
                <p className="text-indigo-400 text-lg">
                    Continue your learning journey or manage your enrollments below.
                </p>
            </div>

            {enrollmentIds.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-gray-400 mb-6 text-lg">
                        You haven’t enrolled in any courses yet.
                    </p>
                    <Link
                        to="/courses"
                        className="inline-block px-8 py-3 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-indigo-400/30 hover:scale-105 transition-transform duration-300"
                    >
                        Browse Courses
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
                    {enrollmentIds.map((enrollId) => {
                        const enrollment = enrollById[enrollId];
                        if (!enrollment) return null;

                        const course = coursesById[enrollment.courseId];
                        if (!course) {
                            return (
                                <div
                                    key={enrollId}
                                    className="rounded-xl p-6 bg-gray-800/60 text-gray-400 text-center"
                                >
                                    Loading course information…
                                </div>
                            );
                        }

                        return (
                            <div
                                key={enrollId}
                                className={`${styles.main_bg} group relative border border-gray-800 hover:border-indigo-600 hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between`}
                            >
                                {/* Thumbnail */}
                                <Link
                                    to={`/courses/${course.id}`}
                                    className="block overflow-hidden rounded-xl mb-4"
                                >
                                    <img
                                        src={course.thumbnail || "/placeholder.png"}
                                        alt={course.title}
                                        className="w-full h-48 object-cover rounded-xl group-hover:scale-110 transition-transform duration-500"
                                    />
                                </Link>

                                {/* Course Info */}
                                <div className="flex flex-col grow">
                                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors mb-2 line-clamp-2">
                                        {course.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm mb-3">
                                        {course.instructor || "Unknown Instructor"}
                                    </p>

                                    {enrollment.completedLessons?.length > 0 && (
                                        <p className="text-xs text-indigo-300 mb-2">
                                            {enrollment.completedLessons.length} lesson
                                            {enrollment.completedLessons.length !== 1 ? "s" : ""}{" "}
                                            completed
                                        </p>
                                    )}
                                </div>

                                {/* Buttons */}
                                <div className="flex justify-between items-center mt-4">
                                    <Link
                                        to={`/courses/${course.id}`}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors duration-300"
                                    >
                                        Continue →
                                    </Link>

                                    <button
                                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors duration-300"
                                        onClick={() =>
                                            dispatch(unenrollFromCourse({ courseId: course.id }))
                                        }
                                    >
                                        Unenroll
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default EnrolledCourses;
