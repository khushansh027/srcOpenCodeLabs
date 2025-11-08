import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { deleteImageFromSupabase } from "../../database/supabaseStorage.js";
import { fetchCourses, deleteCourse } from "../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
import { cleanupDuplicateLessons } from "../../ReduxToolKit/Slices/CourseAndLessons/courseHelpers.js";
import { useToast } from "../../middleware/ToastProvider.jsx";
import styles from "./AdminCoursesList.module.css";

function AdminCoursesList() {
    
    const { allIds, byId, loading, error } = useSelector((state) => state.courses);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const toast = useToast();

    // Derive courses array from allIds and byId
    const courses = allIds.map(id => byId[id]);
    console.log("course shape:", courses);

    // fetch courses on mount
    useEffect(() => {
        dispatch(fetchCourses());
    }, [dispatch]);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this course?")) {
            // Now courses array is available
            const course = courses.find(c => c.id === id);

            // Delete thumbnail from Supabase if it exists
            if (course?.thumbnail?.includes('supabase.co')) {
                try {
                    await deleteImageFromSupabase(course.thumbnail);
                } catch (err) {
                    console.warn("Thumbnail deletion failed, but continuing with course deletion:", err);
                }
            }

            // delete course from Firestore
            dispatch(deleteCourse(id));
        }
    };

    return (
        <div className={`${styles["main-content"]} ${styles["radial-bg"]}`}>
            <div className="mx-auto max-w-6xl">

                {/* Header row */}
                <div className="flex items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">All Courses</h1>
                        <p className="text-sm text-indigo-200/60 mt-1">Manage published courses, thumbnails, and lesson cleanup.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/admin/courses/new")}
                            className="inline-flex items-center gap-2 bg-linear-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-lg px-4 py-2 rounded-md text-sm font-semibold"
                        >
                            ➕ Add New Course
                        </button>
                    </div>
                </div>

                {/* Status / Messages */}
                <div className="mb-4">
                    {loading && <div className="text-indigo-200/60">Loading courses...</div>}
                    {error && <div className="text-red-400 font-medium">{error}</div>}
                </div>

                {/* Courses list container */}
                <div className="grid gap-4">
                    {Array.isArray(allIds) && allIds.length > 0 ? (
                        allIds.map((id) => {
                            const course = byId[id];
                            console.log("course shape in allIds:", course);
                            return (
                                <article
                                    key={id}
                                    onClick={() => navigate(`/courses/${id}`)}
                                    className="group relative w-full bg-linear-to-br from-[#0f1020] to-[#0b0c16] border border-transparent hover:border-indigo-600/30 hover:shadow-[0_20px_50px_rgba(97,95,255,0.12)] rounded-xl p-4 sm:p-5 transition-transform cursor-pointer"
                                >
                                    {/* Mobile: Stack vertically, Desktop: Flex horizontally */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
                                        
                                        {/* Thumbnail */}
                                        <div className="shrink-0 w-full sm:w-32">
                                            <div className="w-full sm:w-32 h-48 sm:h-24 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                                                {course?.thumbnail ? (
                                                    <img
                                                        src={course.thumbnail}
                                                        alt={course.title || "thumbnail"}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        onError={(e) => { e.target.src = '/placeholder.png'; }}
                                                    />
                                                ) : (
                                                    <div className="text-indigo-300/60 text-sm px-2">No image</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content Container */}
                                        <div className="flex-1 min-w-0 w-full space-y-3">
                                            {/* Title + Price Row */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <h2 className="text-lg sm:text-xl font-semibold truncate mb-2">
                                                        {course?.title || "Untitled Course"}
                                                    </h2>
                                                    <p className="text-sm text-indigo-200/60 line-clamp-2 leading-relaxed">
                                                        {course?.desc || "No description available."}
                                                    </p>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <div className="text-base sm:text-lg text-indigo-300 font-semibold whitespace-nowrap">
                                                        {typeof course?.price === 'number' && course.price > 0 ? `₹${course.price}` : "Free"}
                                                    </div>
                                                    <div className="text-xs text-indigo-200/50 mt-1.5 hidden sm:block">
                                                        {course?.instructor || "Unknown"}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Instructor (mobile only) */}
                                            <div className="text-sm text-indigo-200/60 sm:hidden">
                                                By {course?.instructor || "Unknown Instructor"}
                                            </div>

                                            {/* Tags Row */}
                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                <span className="px-3 py-1 bg-indigo-800/99 rounded-full text-indigo-50 font-medium shadow-sm shadow-indigo-600/20">
                                                    Lessons:&nbsp;
                                                    {Array.isArray(course?.lessons)
                                                        ? course.lessons.length
                                                        : course?.lessons && typeof course.lessons === "object"
                                                        ? Object.keys(course.lessons).length
                                                        : (course?.lessonsCount ?? course?.lessonCount ?? course?._lessonsCount ?? 0)
                                                    }
                                                </span>

                                                {course?.published ? (
                                                    <span className="px-3 py-1 bg-green-800/70 text-green-100 rounded-full font-medium shadow-sm shadow-green-500/20">
                                                        Published
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-yellow-700/70 text-yellow-100 rounded-full font-medium shadow-sm shadow-yellow-400/20">
                                                        Draft
                                                    </span>
                                                )}
                                            </div>

                                            {/* Action Buttons - Mobile Only */}
                                            <div className="flex gap-3 sm:hidden pt-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/edit/${id}`); }}
                                                    className="flex-1 px-4 py-2.5 bg-indigo-700/60 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(id); }}
                                                    className="flex-1 px-4 py-2.5 bg-rose-600/70 hover:bg-rose-600 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Delete
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        (async () => {
                                                            if (window.confirm('Clean up duplicates for this course?')) {
                                                                const result = await cleanupDuplicateLessons(course?.id);
                                                                toast.success(`Cleaned up! Deleted ${result.deleted} duplicates, kept ${result.kept} lessons.`);
                                                            }
                                                        })();
                                                    }}
                                                    className="px-4 py-2.5 bg-green-500 hover:bg-green-400 text-amber-50 rounded-lg text-sm font-semibold transition-colors"
                                                >
                                                    Clean
                                                </button>
                                            </div>
                                        </div>

                                        {/* Action Buttons - Desktop Only */}
                                        <div className="hidden sm:flex shrink-0 items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/edit/${id}`); }}
                                                className="px-4 py-2 bg-indigo-700/60 hover:bg-indigo-700 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleDelete(id); }}
                                                className="px-4 py-2 bg-rose-600/70 hover:bg-rose-600 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                                            >
                                                Delete
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    (async () => {
                                                        if (window.confirm('Clean up duplicates for this course?')) {
                                                            const result = await cleanupDuplicateLessons(course?.id);
                                                            toast.success(`Cleaned up! Deleted ${result.deleted} duplicates, kept ${result.kept} lessons.`);
                                                        }
                                                    })();
                                                }}
                                                className="px-3 py-2 bg-green-500 hover:bg-green-400 text-amber-50 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
                                            >
                                                Clean
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    ) : (
                        !loading && !error && (
                            <div className="py-8 text-center text-indigo-200/60">
                                <p className="mb-3">No courses yet. Add one to get started.</p>
                                <button
                                    onClick={() => navigate("/admin/courses/new")}
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 rounded-md text-sm font-semibold"
                                >
                                    Create your first course
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );

}

export default AdminCoursesList;