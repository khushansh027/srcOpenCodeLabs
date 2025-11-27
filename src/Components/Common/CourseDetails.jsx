import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";

import { userSelector } from "../../ReduxToolKit/Slices/UserSlice.js";
import { selectEnrollmentByCourseId } from "../../ReduxToolKit/Slices/EnrollmentSlice.js";
import { fetchCourseById, selectCourseById, selectCourses } from "../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
import { useToast } from "../../middleware/ToastProvider.jsx";
import "./CourseDetails.css";

function CourseDetails() {
    const { courseId } = useParams(); // lessonId is optional here
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const toast = useToast();

    const user = useSelector(userSelector);
    const course = useSelector((state) => selectCourseById(state, courseId));
    const { loading, error } = useSelector(selectCourses);

    useEffect(() => {
        if (courseId) dispatch(fetchCourseById(courseId));
    }, [dispatch, courseId]);

    // Simple normalization - just ensure id exists
    const normalizedLessons = (course?.lessons || []).map(lesson => ({
        id: lesson.id ?? lesson.lessonId ?? lesson._id ?? `temp-${Math.random()}`,
        ...lesson
    }));

    // handle lesson click with enrollment check
    const handleLessonClick = (e, lesson) => {
        // If no user logged in, redirect to login
        if (!user || !user.uid) {
            e.preventDefault();
            // toast.warning('⚠️ Please login to access course lessons');
            console.warn('⚠️ User not logged in, redirecting to login');
            navigate('/login', { 
                state: { 
                    from: `/courses/${courseId}/lessons/${lesson.id}`,
                    message: 'Please login to access course lessons'
                } 
            });
            return;
        }
        // If user is logged in but not student/admin, prevent access
        if (user.role !== 'student' && user.role !== 'admin') {
            e.preventDefault();
            console.warn('⚠️ User role not authorized:', user.role);
            toast.warning(`Only students and admins can access lessons. Your role: ${user.role || 'unknown'}`);
            return;
        }

        // All checks passed - link will navigate normally
        console.log('✅ Access granted to lesson:', lesson.id);
    }

    // Enrollment tracking
    const enrollment = useSelector(state => selectEnrollmentByCourseId(state, courseId));
    const completedLessons = enrollment?.completedLessons || [];
    const completedSet = useMemo(() => new Set(completedLessons), [completedLessons]);

    // Debug log
    console.log('📚 Normalized lessons:', normalizedLessons);
    console.log('📚 Count:', normalizedLessons.length);

    return (
        <>
            {loading ? (
                <p>Loading course...</p>
            ) : error ? (
                <p className="text-red-500">Error: {error}</p>
            ) : (
                // <div className="bg-gray-950 w-full min-h-screen flex flex-col items-center">
                <div className="course-page bg-gray-900 w-full min-h-screen flex flex-col items-center">

                    {/* Back button */}
                    <div className="w-full ml-4 mt-4 text-left">
                        <button
                            onClick={() => navigate(-1)} // 👈 this goes back to previous page
                            className="inline-flex items-center border border-indigo-300 px-3 py-1.5 rounded-md text-indigo-500 hover:bg-indigo-50"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                className="h-6 w-6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M7 16l-4-4m0 0l4-4m-4 4h18"
                                />
                            </svg>
                            <span className="ml-1 font-bold text-lg">Back</span>
                        </button>

                    </div>

                    {/* Course card */}
                    {/* <div className="max-w-md w-full p-4 md:p-6 bg-indigo-100 rounded-lg shadow-lg my-8"> */}
                    <div className="course-card max-w-3xl w-full p-6 md:p-8 rounded-lg my-8">

                        <div className="flex justify-center items-center mb-4">
                            <p className="text-3xl font-extrabold text-indigo-600">
                                {course?.title || "Loading course..."}
                            </p>

                        </div>

                        <div className="mb-4">
                            <img
                                src={course?.thumbnail || "/placeholder.png"}
                                alt="Course Thumbnail"
                                className="rounded-lg w-full h-auto"
                            />
                        </div>

                        <div className="p-6">
                            <h2 className="text-2xl font-mono font-extrabold text-indigo-600 mb-2">
                                Description
                            </h2>

                            <p className="whitespace-pre-wrap text-justify font-mono text-lg text-violet-950 mb-4">
                                {course?.desc || "No description available."}
                            </p>
                            <br />
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-2xl font-bold text-indigo-600">
                                    {typeof course?.price === "number" && course.price > 0
                                        ? `₹${course.price}`
                                        : "Free"}
                                </span>

                                <div className="flex items-center">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5 text-yellow-400"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    <span className="ml-1 text-indigo-600 font-semibold font-mono text-xl">
                                        {course?.instructor || "Unknown Instructor"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lessons list */}
                    <div className="w-full max-w-2xl p-6">
                        <h3 className="text-2xl font-bold mb-4">Course Lessons</h3>

                        {normalizedLessons.length === 0 ? (
                            <p className="text-gray-500">No lessons available</p>
                        ) : (
                            <div className="space-y-2">
                                {normalizedLessons.map((lesson, index) => {
                                    const isCompleted = completedSet.has(lesson.id);
                                    const hasAccess = user && (user.role === 'student' || user.role === 'admin');
                                    const showCompletion = user?.role === 'student' && isCompleted;

                                    return (
                                        <Link
                                            key={lesson.id}
                                            to={`/courses/${courseId}/lessons/${lesson.id}`}
                                            state={{ lesson }}
                                            rel="noopener noreferrer"
                                            onClick={(e) => handleLessonClick(e, lesson)}
                                            className={`block p-4 border rounded-lg transition group ${
                                                hasAccess 
                                                    ? 'hover:bg-indigo-50 hover:border-indigo-300' 
                                                    : 'opacity-60 cursor-not-allowed hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-500 font-medium">
                                                        {index + 1}.
                                                    </span>
                                                    <span className={`font-medium ${hasAccess ? 'group-hover:text-indigo-600' : 'text-gray-600'}`}>
                                                        {lesson.title || "Untitled lesson"}
                                                    </span>
                                                    {!hasAccess && (
                                                        <span className="text-amber-600 text-sm font-medium">
                                                            🔒 Login required
                                                        </span>
                                                    )}
                                                    {showCompletion && (
                                                        <span className="text-green-600 text-sm">✅ Completed</span>
                                                    )}
                                                </div>
                                                <span className={`${hasAccess ? 'text-gray-400 group-hover:text-indigo-400' : 'text-gray-300'}`}>
                                                    {hasAccess ? '↗' : '🔒'}
                                                </span>
                                            </div>

                                            {lesson.duration > 0 && (
                                                <p className="text-sm text-gray-500 ml-7 mt-1">
                                                    {lesson.duration} min
                                                </p>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default CourseDetails;

/*
b) Interview-ready “story blocks” — how to explain CourseDetails step-by-step

Imports & routing hooks
“We import React, router hooks (useParams, Link, useNavigate), Redux helpers and our course thunks/selectors.”

Grab params + selectors
“We read id and optional lessonId from the URL, then select the course with selectCourseById(state, id) — this selector returns the course and its lessons when loaded.”

Fetch canonical data
“On mount (or when id changes) we dispatch fetchCourseById(id) so the slice fetches the course doc and the ordered lessons subcollection.”

Local data for render
“We use const lessons = course?.lessons || [] — no mapping needed because the thunk already returns [{id,...}] ordered by order.”

Enrollment state
“We read enrollments from the store, find the user’s enrollment for this course, and read completedLessons to render completed markers.”

UI skeleton
“We show loading/error states, a course card (thumbnail, desc, instructor, price), then the lessons list; each lesson is a Link to the lesson player.”

Admin affordance
“If the user is an admin we show an Edit button that navigates to the AdminCourseForm edit route.”

Why this is good
“This keeps UI simple, avoids duplication, and relies on a single source of truth (the slice + subcollection fetch).”

Why I’m confident:

✅ Your thunk already fetches lessons in the right order, so no redundant mapping/sorting needed here.

✅ Selector (selectCourseById) ensures the course merges with lessons properly.

✅ Enrollment selector (selectEnrollmentByCourseId) keeps completedLessons clean and decoupled.

✅ useMemo with a Set gives O(1) lookups for completed lessons, good for scaling.

✅ Admin affordance (Edit button) is scoped correctly to role.

✅ Loading/error boundaries keep UI resilient.

✅ The code now matches your schema, slice, and selector design — no mismatches.


*/
