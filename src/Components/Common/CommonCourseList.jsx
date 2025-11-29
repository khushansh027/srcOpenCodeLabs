import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { userSelector } from "../../ReduxToolKit/Slices/UserSlice.js"
import { fetchCourses } from "../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
import { fetchEnrolledCourses, enrollInCourse} from "../../ReduxToolKit/Slices/EnrollmentSlice.js";
import { useToast } from "../../middleware/ToastProvider.jsx";
import "./CommonCourseList.css";

export default function CommonCourseList() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const toast = useToast();

    const { allIds, byId, loading, error } = useSelector((state) => state.courses);

    // verify user
    const user = useSelector(userSelector);
    const userId = user?.uid;
    const userRole = user?.role;
  
    // Get user's enrollments to show "Enrolled" badge
    const enrollments = useSelector((state) => state.enrollment?.byId || {});
    
    // CRITICAL DEBUG: Log the entire enrollments state
    console.log('🔴 FULL ENROLLMENT STATE:', useSelector((state) => state.enrollment));
    
    // MEMOIZE the Set to prevent unnecessary rerenders
    const enrolledCourseIds = useMemo(() => {
        const enrolled = new Set();
        Object.values(enrollments).forEach(e => {
            // Check multiple possible user ID formats
            const eUserId = String(e?.userId || e?.user_id || e?.studentId || '');
            const currentUserId = String(userId || '');
            
            if (eUserId === currentUserId && e?.courseId) {
                // Only add the courseId as-is (keep original type)
                enrolled.add(e.courseId);
            }
        });
        
        // Debug log - remove after fixing
        console.log('🔍 Enrollment Check:', {
            userId,
            enrollmentsCount: Object.keys(enrollments).length,
            enrolledCourseIds: Array.from(enrolled),
            sampleEnrollment: Object.values(enrollments)[0]
        });
        
        return enrolled;
    }, [enrollments, userId]);


    // Also fetch user's enrollments when component mounts
    useEffect(() => {
        if (userId && userRole === "student") {
            dispatch(fetchEnrolledCourses());
        }
    }, [dispatch, userId, userRole]);

    // Fetch all courses on mount
    useEffect(() => {
        dispatch(fetchCourses());
    }, [dispatch]);

    // Handle enrollment
    const handleEnroll = async (courseId) => {
        if (!userId) {
            // Redirect to login if not authenticated
            navigate('/login', { state: { from: `/courses/${courseId}` } });
            return;
        }
        // Debug logs
        console.log('🔍 User object:', user);
        console.log('🔍 User ID:', userId);
        console.log('🔍 User role:', userRole);

        try {
            const result = await dispatch(enrollInCourse({ userId, courseId })).unwrap();
            console.log('✅ Enrollment result:', result);
            toast.success("Successfully enrolled in course!");
            
            // FORCE REFETCH enrollments after successful enrollment
            await dispatch(fetchEnrolledCourses());
            console.log('🔄 Refetched enrollments');
        } catch (err) {
            toast.error(`Enrollment failed: ${err.message || err}`);
        }
    };
  
    // DEBUGGING:
    console.log(
        '🔍 CommonCourseListPage state:',
        { allIds, byId, loading, error, totalCourses: allIds.length }
    );

    // Filter only published courses for public view
    const publishedCourses = allIds
        .map(id => byId[id])
        .filter(course => course?.published === true);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading courses...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <p className="text-red-500">Error loading courses: {error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-8xl mx-auto px-20 py-15 bg-stone-950 min-h-screen">
            <h1 className={`${root.fontfamily} text-4xl font-bold mb-8 text-amber-50`}>Available Courses</h1>
            
            {
                publishedCourses.length === 0
                ? (
                    <div className="text-center py-12">
                        <svg
                            className="mx-auto h-16 w-16 text-gray-400 mb-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                        </svg>
                        <p className="text-gray-500 text-lg">No courses available yet.</p>
                        <p className="text-gray-400 text-sm mt-2">Check back soon for new courses!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        {publishedCourses.map((course) => {
                            // Direct comparison - keep types consistent
                            const isEnrolled = enrolledCourseIds.has(course.id);
                            
                            // Debug log for each course - remove after fixing
                            console.log(`Course ${course.id} (${course.title}):`, {
                                courseId: course.id,
                                courseIdType: typeof course.id,
                                isEnrolled,
                                enrolledCourseIds: Array.from(enrolledCourseIds)
                            });
                            
                            return (
                                <div
                                    key={course.id}
                                    className="group border rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 bg-white flex flex-col"
                                >
                                    {/* Thumbnail */}
                                    <Link to={`/courses/${course.id}`} className="block">
                                        <div className="relative h-48 bg-gray-200 overflow-hidden">
                                            {course.thumbnail ? (
                                            <img
                                                src={course.thumbnail}
                                                alt={course.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                onError={(e) => {
                                                e.target.src = '/placeholder.png';
                                                }}
                                            />
                                            ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-indigo-500 to-purple-600">
                                                <svg
                                                className="h-16 w-16 text-white opacity-50"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                                />
                                                </svg>
                                            </div>
                                            )}
                                            
                                            {/* Enrolled Badge */}
                                            {isEnrolled && (
                                            <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                                Enrolled ✓
                                            </div>
                                            )}
                                        </div>
                                    </Link>

                                    {/* Content */}
                                    <Link to={`/courses/${course.id}`} className="block p-4 grow">
                                        <h3
                                            className="font-bold text-lg mb-2 text-gray-800 group-hover:text-indigo-400 transition-colors line-clamp-2"
                                        >
                                            {course.title}
                                        </h3>
                                        
                                        <p className="text-slate-200 text-lg mb-3 line-clamp-2">
                                            {course.desc || "No description available."}
                                        </p>

                                        {/* Footer */}
                                        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                            {/* Price */}
                                            <span className="text-xl font-bold text-indigo-400">
                                                {course.price === 0 || !course.price ? 'Free' : `₹${course.price}`}
                                            </span>

                                            {/* Instructor */}
                                            <div className="flex items-center text-sm text-slate-100">
                                                <svg
                                                    className="h-4 w-4 text-yellow-400 mr-1"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="truncate max-w-[120px]">
                                                    {course.instructor || 'Unknown'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Lessons count */}
                                        {course.lessons && course.lessons.length > 0 && (
                                            <div className="mt-2 text-xs text-gray-500">
                                            {course.lessons.length} lesson{course.lessons.length !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </Link>

                                    {/* Enrollment Button */}
                                    <div className="p-4 pt-0">
                                        {userRole === "admin" ? (
                                            // Admin sees "Manage" button
                                            <button
                                                onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
                                                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition font-semibold"
                                            >
                                                Manage Course
                                            </button>
                                        ) : isEnrolled ? (
                                            // Already enrolled - show "Continue Learning"
                                            <Link
                                                to={`/courses/${course.id}`}
                                                className="block w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-semibold text-center"
                                            >
                                                Continue Learning →
                                            </Link>
                                        ) : userId ? (
                                            // Logged in student - show "Enroll" button
                                            <button
                                                onClick={() => handleEnroll(course.id)}
                                                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition font-semibold"
                                            >
                                                Enroll Now
                                            </button>
                                        ) : (
                                            // Not logged in - show "Login to Enroll"
                                            <button
                                                onClick={() => navigate('/login', { state: { from: `/courses/${course.id}` } })}
                                                className="w-full bg-gray-400 text-white py-2 px-4 rounded-lg hover:bg-gray-500 transition font-semibold"
                                            >
                                                Login to Enroll
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }
        </div>
    );
}
