import { useEffect, useRef, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams, Navigate } from "react-router-dom";
import { userSelector } from "../../../ReduxToolKit/Slices/UserSlice.js";
import { fetchCourseById, selectCourseById, selectLessonById } from "../../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
import { selectEnrollmentByCourseId, markLessonCompletedByEnrollment, fetchEnrollmentForCourse } from "../../../ReduxToolKit/Slices/EnrollmentSlice.js";
import { fetchVideoDurationInMinutes, extractYouTubeId, convertYouTubeToEmbed, fetchYouTubeDurationViaIframe, loadYouTubeIframeAPI } from "./mediaHelper.js";
// css
import { useToast } from "../../../middleware/ToastProvider.jsx";
import styles from "./LessonPlayer.module.css";

function LessonPlayer() {
    // hooks & states
    const { courseId, lessonId } = useParams();
    const location = useLocation();
    const dispatch = useDispatch();

    // get lesson from location state (if available) or from store
    const locationLesson = location?.state?.lesson || null;
    const storeLesson = useSelector((s) => selectLessonById(s, courseId, lessonId));
    const course = useSelector((s) => selectCourseById(s, courseId));
    const toast = useToast();
    
    // get logged-in user
    const user = useSelector(userSelector);
    const userId = user?.uid;
    if (!userId) return <div className={styles.loading}>Loading…</div>;

    // get enrollment for this course
    const enrollment = useSelector((s) => selectEnrollmentByCourseId(s, courseId));
    const completedLessons = enrollment?.completedLessons || [];
    const completedSet = useMemo(() => new Set(completedLessons), [completedLessons]);
    const stableEnrollmentId = enrollment?.id;
    const lesson = locationLesson || storeLesson;
    const youtubeEmbed = convertYouTubeToEmbed(lesson?.videoUrl);

    // ref to track if we've shown the admin toast
    const adminToastShownRef = useRef(false);
    
    // Debug logs    
    useEffect(() => {
        console.log('=== LessonPlayer State ===');
        console.log('courseId:', courseId);
        console.log('lessonId:', lessonId);
        console.log('userId:', userId);
        console.log('enrollment:', enrollment);
        console.log('completedLessons:', completedLessons);
        console.log('========================');
    }, [courseId, lessonId, userId, enrollment, completedLessons]);

    // fetch course if not in store
    useEffect(() => {
        if (courseId && !course) {
            dispatch(fetchCourseById(courseId));
        }
    }, [dispatch, courseId, course]);

    // fetch enrollment if not in store
    useEffect(() => {
        // Only fetch if we have both IDs and don't already have the enrollment
        if (courseId && userId && !enrollment) {
            console.log('📥 Dispatching fetchEnrollmentForCourse');
            console.log('   - courseId:', courseId);
            console.log('   - userId:', userId);
            
            dispatch(fetchEnrollmentForCourse({ userId, courseId }));
        } else {
            console.log('⏭️ Skipping enrollment fetch:');
            console.log('   - courseId:', courseId);
            console.log('   - userId:', userId);
            console.log('   - enrollment exists:', !!enrollment);
        }
    }, [dispatch, courseId, userId, enrollment]);

    // refs and state for video tracking
    const videoRef = useRef(null);
    const didDispatchRef = useRef(false);
    const durationFetchRef = useRef(false);
    const [videoDuration, setVideoDuration] = useState(null);

    // const completedKey = useMemo(() => {
    //     const arr = Array.isArray(completedLessons) ? completedLessons.slice() : [];
    //     arr.sort();
    //     return arr.join("|");
    // }, [completedLessons]);

    // reset didDispatchRef when lessonId or enrollment changes
    useEffect(() => {
        didDispatchRef.current = false;
        // Also reset duration fetch for new lessons
        durationFetchRef.current = false;
    }, 
        // [lessonId, enrollment?.id, completedKey]
        [lessonId, enrollment?.id]
    ); 

    useEffect(() => {
        let mounted = true;
        if (!lesson?.videoUrl || durationFetchRef.current) return;
        durationFetchRef.current = true;

        (async () => {
            try {
                if (convertYouTubeToEmbed(lesson.videoUrl)) {
                    const mins = await fetchYouTubeDurationViaIframe(lesson.videoUrl);
                    if (!mounted) return;
                    if (typeof mins === "number") setVideoDuration(mins * 60);
                    return;
                }

                const mins2 = await fetchVideoDurationInMinutes(lesson.videoUrl);
                if (!mounted) return;
                if (typeof mins2 === "number") setVideoDuration(mins2 * 60);
            } catch (err) {
                console.warn("Could not prefetch video duration:", err);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [lesson?.videoUrl]);

    // track video progress and mark lesson complete at 80%
    useEffect(() => {
        const v = videoRef.current;
        if (!lesson) return;

        if (!youtubeEmbed && v) {
            const onTimeUpdate = () => {
                console.log('🎥 TimeUpdate Event Fired');
                console.log('didDispatchRef.current:', didDispatchRef.current);
                console.log('enrollment?.id:', enrollment?.id);
                console.log('lessonId:', lessonId);
                console.log('completedSet.has(lessonId):', completedSet.has(lessonId));
                
                if (didDispatchRef.current) {
                    console.log('⏭️ Already dispatched, skipping');
                    return;
                }

                const nativeDuration =
                    typeof v.duration === "number" && isFinite(v.duration) && v.duration > 0 ? v.duration : null;
                const duration = nativeDuration || videoDuration || 0;

                console.log('Video duration:', duration);
                console.log('Current time:', v.currentTime);

                if (duration <= 0) {
                    console.log('⚠️ Duration is 0 or invalid, skipping');
                    return;
                }
                
                const percent = (v.currentTime / duration) * 100;
                console.log('Progress:', percent.toFixed(2) + '%');

                if (percent >= 80 && !completedSet.has(lessonId)) {
                    console.log('✅ 80% reached! Marking as complete...');
                    
                    if (enrollment?.id) {
                        console.log('📤 Dispatching markLessonCompletedByEnrollment');
                        dispatch(
                            markLessonCompletedByEnrollment({
                                enrollmentId: enrollment.id,
                                lessonId,
                            })
                        );
                        didDispatchRef.current = true;
                        console.log('✅ Dispatch complete, didDispatchRef set to true');
                    } else {
                        // Show toast only once for admins
                        if (user?.role === 'admin' && !adminToastShownRef.current) {
                            toast.info('Progress not tracked in admin preview mode', { duration: 5000 });
                            adminToastShownRef.current = true;
                            console.log('ℹ️ No enrollment found (admin preview mode)');
                        }else{
                            console.warn('⚠️ Cannot mark complete: no enrollment');
                            console.log('enrollment object:', enrollment);
                        }                        
                    }
                } else if (percent >= 80) {
                    console.log('ℹ️ Already in completedSet, skipping dispatch');
                }
            };

            v.addEventListener("timeupdate", onTimeUpdate);
            v.addEventListener("ended", onTimeUpdate);

            console.log('🎬 Event listeners attached to video element');

            return () => {
                v.removeEventListener("timeupdate", onTimeUpdate);
                v.removeEventListener("ended", onTimeUpdate);
                console.log('🧹 Event listeners removed');
            };
        }

        // YouTube embed handling with debug logs
        if (youtubeEmbed) {
            let playerInstance = null;
            let mounted = true;
            let intervalId = null;

            const initYT = async () => {
                try {
                    await loadYouTubeIframeAPI();
                    if (!mounted) return;

                    const iframeId = `yt-player-${lessonId}`;
                    console.log('🔍 Waiting for iframe with id:', iframeId);

                    // FIXED: Wait for iframe to exist in DOM (retry up to 10 times)
                    const waitForIframe = () => {
                        return new Promise((resolve, reject) => {
                            let attempts = 0;
                            const maxAttempts = 20; // 20 attempts = 2 seconds max wait
                            
                            const checkIframe = () => {
                                attempts++;
                                const iframe = document.getElementById(iframeId);
                                
                                if (iframe) {
                                    console.log('✅ Found iframe after', attempts, 'attempts');
                                    resolve(iframe);
                                } else if (attempts >= maxAttempts) {
                                    console.error('❌ Iframe not found after', maxAttempts, 'attempts');
                                    
                                    // Debug info
                                    const allIframes = document.querySelectorAll('iframe');
                                    console.log('All iframes on page:', allIframes.length);
                                    allIframes.forEach((iframe, idx) => {
                                        console.log(`  iframe ${idx}:`, {
                                            id: iframe.id || '(no id)',
                                            class: iframe.className,
                                        });
                                    });
                                    
                                    reject(new Error('Iframe not found'));
                                } else {
                                    // Try again in 100ms
                                    setTimeout(checkIframe, 100);
                                }
                            };
                            
                            checkIframe();
                        });
                    };

                    // Wait for iframe to exist
                    try {
                        const iframe = await waitForIframe();
                        if (!mounted) return;

                        console.log('🎬 Initializing YouTube player');

                        playerInstance = new window.YT.Player(iframeId, {
                            events: {
                                onReady: (event) => {
                                    console.log('✅ YouTube player ready');
                                    
                                    intervalId = setInterval(() => {
                                        if (!playerInstance || didDispatchRef.current || !mounted) {
                                            return;
                                        }

                                        try {
                                            const duration = playerInstance.getDuration();
                                            const currentTime = playerInstance.getCurrentTime();
                                            
                                            if (duration > 0 && currentTime > 0) {
                                                const percent = (currentTime / duration) * 100;
                                                
                                                // Log every 10 seconds
                                                if (Math.floor(currentTime) % 10 === 0) {
                                                    console.log('📊', currentTime.toFixed(0), '/', duration.toFixed(0), 's -', percent.toFixed(1) + '%');
                                                }
                                                
                                                if (percent >= 80 && !completedSet.has(lessonId)) {
                                                    if (enrollment?.id) {
                                                        console.log('🎉 80% REACHED! Marking complete...');
                                                        dispatch(
                                                            markLessonCompletedByEnrollment({
                                                                enrollmentId: enrollment.id,
                                                                lessonId,
                                                            })
                                                        );
                                                        didDispatchRef.current = true;
                                                        
                                                        // Clear interval after marking complete
                                                        if (intervalId) {
                                                            clearInterval(intervalId);
                                                            intervalId = null;
                                                        }
                                                    } else {
                                                        // Show toast only once for admins
                                                        if (user?.role === 'admin' && !adminToastShownRef.current) {
                                                            toast.info('Progress not tracked in admin preview mode', { duration: 5000 });
                                                            adminToastShownRef.current = true;
                                                            console.log('ℹ️ No enrollment found (admin preview mode)');
                                                        }else{
                                                            console.warn('⚠️ Cannot mark complete: no enrollment');
                                                            console.log('enrollment object:', enrollment);
                                                        }
                                                    }
                                                }
                                            }
                                        } catch (e) {
                                            console.warn("Error tracking progress:", e);
                                        }
                                    }, 2000); // Check every 2 seconds
                                },
                                onStateChange: (event) => {
                                    const states = {
                                        '-1': 'unstarted',
                                        '0': 'ended',
                                        '1': 'playing',
                                        '2': 'paused',
                                        '3': 'buffering',
                                        '5': 'cued'
                                    };
                                    console.log('🎬 Player state:', states[event.data] || event.data);
                                },
                                onError: (event) => {
                                    console.error('❌ YouTube player error:', event.data);
                                }
                            },
                        });
                    } catch (err) {
                        console.error('❌ Failed to find iframe:', err);
                    }

                } catch (err) {
                    console.error("❌ Failed to initialize YouTube player:", err);
                }
            };

            initYT();

            return () => {
                console.log('🧹 Cleaning up YouTube player');
                mounted = false;
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                if (playerInstance && typeof playerInstance.destroy === 'function') {
                    try {
                        playerInstance.destroy();
                        playerInstance = null;
                    } catch (e) {
                        console.warn('Error destroying player:', e);
                    }
                }
            };
        }
    }, [
        dispatch,
        lessonId,
        youtubeEmbed,
        stableEnrollmentId
    ]);


    if (!lesson) return <p className={styles.loading}>Loading lesson...</p>;

    // derive some lightweight metadata for display
    const displayDuration =
        typeof lesson.duration === "number" && lesson.duration > 0 ? `${lesson.duration} min` : null;
    const isCompleted = completedSet.has(lessonId);

    // Debug logs
    console.log('🎬 Render check:');
    console.log('  youtubeEmbed:', youtubeEmbed);
    console.log('  lesson.videoUrl:', lesson?.videoUrl);
    console.log('  lessonId:', lessonId);

    return (
        
        <div className={styles.page}>

            <div className={styles.container}>
                {/* LEFT: Player */}
                <main className={styles.playerColumn} role="main" aria-labelledby="lesson-title">
                    <header className={styles.header}>
                        <h1 id="lesson-title" className={styles.title}>
                            {lesson.title || "Untitled Lesson"}
                        </h1>

                        <div className={styles.meta}>
                            <div className={styles.metaLeft}>
                                <span className={styles.instructor}>{course?.instructor || "Instructor"}</span>
                                {displayDuration && <span className={styles.bullet}>•</span>}
                                {displayDuration && <span className={styles.duration}>{displayDuration}</span>}
                            </div>

                            <div className={styles.metaRight}>
                                {isCompleted ? (
                                    <span className={styles.completed}>Completed ✅</span>
                                ) : (
                                    <span className={styles.notCompleted}>Not completed</span>
                                )}
                            </div>
                        </div>
                    </header>

                    <section className={styles.playerWrap} aria-label="Video player">
                        {youtubeEmbed ? (
                            <div className={styles.embed}>
                                <iframe
                                    id={`yt-player-${lessonId}`}
                                    className={styles.iframe}
                                    title={lesson.title || "lesson-video"}
                                    src={`https://www.youtube.com/embed/${extractYouTubeId(lesson.videoUrl)}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        ) : (
                            <div className={styles.nativePlayer}>
                                <video ref={videoRef} src={lesson.videoUrl} controls className={styles.video} />
                            </div>
                        )}
                    </section>

                    <section className={styles.controlsRow} aria-hidden={true}>
                        {/* subtle hint text — non-functional, purely presentational */}
                        <small className={styles.hint}>
                            Progress auto-saves — reach 80% to mark this lesson as completed.
                        </small>
                    </section>

                    <section className={styles.content} aria-label="Lesson content">
                        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: lesson.desc || "" }} />
                    </section>
                </main>

                {/* RIGHT: Sidebar with course context, resources, and notes */}
                <aside className={styles.sidebar} aria-label="Lesson details and notes">
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>Course</div>
                        <div className={styles.cardBody}>
                            <div className={styles.courseTitle}>{course?.title || "Course"}</div>
                            <div className={styles.smallMeta}>{course?.instructor || "Unknown"}</div>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>Resources</div>
                        <div className={styles.cardBody}>
                            <p className={styles.smallMeta}>
                                No resources attached.
                            </p>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>Your Notes</div>
                        <div className={styles.cardBody}>
                            <textarea className={styles.notes} placeholder="Take quick notes about this lesson (local only)"></textarea>
                            <small className={styles.smallMeta}>Notes are stored locally in your browser.</small>
                        </div>
                    </div>
                </aside>
            </div>

        </div>
    );
}

export default LessonPlayer;
