import { useEffect, useRef, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams, useNavigate } from "react-router-dom";
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
    const navigate = useNavigate();
    const iframeRef = useRef(null);

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
    const lesson = storeLesson || locationLesson;
    const youtubeEmbed = convertYouTubeToEmbed(lesson?.videoUrl);

    // sidebar visibility state
    const [showSidebar, setShowSidebar] = useState(true);
    // refs and state for video tracking
    const videoRef = useRef(null);
    const didDispatchRef = useRef(false);
    const durationFetchRef = useRef(false);
    const playerContainerRef = useRef(null);
    const ytPlayerRef = useRef(null); // store the YT player instance
    const [videoDuration, setVideoDuration] = useState(null);
    // notes state
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const notesTimeoutRef = useRef(null);

    // Generate unique key for this lesson's notes
    const notesKey = `lesson-notes-${courseId}-${lessonId}`;

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

    // prefetch video duration
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
    useEffect(() => {
        if (!lesson) return;

        // --- Native <video> handling (HTML5 video element) ---
        if (!youtubeEmbed) {
            const v = videoRef.current;
            if (!v) return;

            const onTimeUpdate = () => {
                console.log('🎥 TimeUpdate Event Fired');
                if (didDispatchRef.current) {
                    console.log('⏭️ Already dispatched, skipping');
                    return;
                }

                const nativeDuration =
                    typeof v.duration === 'number' && isFinite(v.duration) && v.duration > 0
                        ? v.duration
                        : null;
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
                        } else {
                            console.warn('⚠️ Cannot mark complete: no enrollment');
                            console.log('enrollment object:', enrollment);
                        }
                    }
                } else if (percent >= 80) {
                    console.log('ℹ️ Already in completedSet, skipping dispatch');
                }
            };

            v.addEventListener('timeupdate', onTimeUpdate);
            v.addEventListener('ended', onTimeUpdate);
            console.log('🎬 Event listeners attached to video element');

            return () => {
                v.removeEventListener('timeupdate', onTimeUpdate);
                v.removeEventListener('ended', onTimeUpdate);
                console.log('🧹 Event listeners removed from video element');
            };
        }

        // --- YouTube embed handling (use API to create iframe inside a container div) ---
        let mounted = true;
        let progressInterval = null;

        const initYouTubePlayer = async () => {
            try {
                await loadYouTubeIframeAPI(); // your existing loader that resolves when YT API ready
                if (!mounted) return;

                const container = playerContainerRef?.current;
                if (!container) {
                    console.error('❌ YT container not mounted');
                    return;
                }

                // extract videoId from lesson.videoUrl or youtubeEmbed
                const videoId =
                    (typeof extractYouTubeId === 'function' && extractYouTubeId(lesson.videoUrl)) ||
                    (youtubeEmbed && (() => {
                        // youtubeEmbed might be like https://www.youtube.com/embed/<id>?...
                        try {
                            const m = youtubeEmbed.match(/\/embed\/([^?&/]+)/);
                            return m ? m[1] : null;
                        } catch (e) {
                            return null;
                        }
                    })()) ||
                    null;

                if (!videoId) {
                    console.error('❌ Could not extract videoId for YouTube player:', lesson?.videoUrl, youtubeEmbed);
                    return;
                }

                // Destroy previous YT player if any
                if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
                    try {
                        ytPlayerRef.current.destroy();
                    } catch (e) {
                        console.warn('Error destroying previous YT player:', e);
                    }
                    ytPlayerRef.current = null;
                }

                // Create player: pass the container element so the API creates the iframe
                ytPlayerRef.current = new window.YT.Player(container, {
                    height: '100%',
                    width: '100%',
                    videoId,
                    playerVars: {
                        rel: 0,
                        enablejsapi: 1,
                        origin: window.location.origin,
                    },
                    events: {
                        onReady: () => {
                            console.log('✅ YT player ready (API-created iframe)', { videoId });

                            // Poll progress every 2 seconds (mirrors previous behavior)
                            progressInterval = setInterval(() => {
                                try {
                                    if (!ytPlayerRef.current || didDispatchRef.current || !mounted) return;

                                    const duration = ytPlayerRef.current.getDuration();
                                    const currentTime = ytPlayerRef.current.getCurrentTime();

                                    if (duration > 0 && typeof currentTime === 'number') {
                                        const percent = (currentTime / duration) * 100;

                                        // occasional log for debugging
                                        if (Math.floor(currentTime) % 10 === 0) {
                                            console.log('📊', Math.floor(currentTime), '/', Math.floor(duration), 's -', percent.toFixed(1) + '%');
                                        }

                                        if (percent >= 80 && !completedSet.has(lessonId)) {
                                            if (enrollment?.id) {
                                                console.log('🎉 80% REACHED! Marking complete (YT)...');
                                                dispatch(
                                                    markLessonCompletedByEnrollment({
                                                        enrollmentId: enrollment.id,
                                                        lessonId,
                                                    })
                                                );
                                                didDispatchRef.current = true;

                                                // stop interval after dispatch
                                                if (progressInterval) {
                                                    clearInterval(progressInterval);
                                                    progressInterval = null;
                                                }
                                            } else {
                                                if (user?.role === 'admin' && !adminToastShownRef.current) {
                                                    toast.info('Progress not tracked in admin preview mode', { duration: 5000 });
                                                    adminToastShownRef.current = true;
                                                    console.log('ℹ️ No enrollment found (admin preview mode)');
                                                } else {
                                                    console.warn('⚠️ Cannot mark complete: no enrollment');
                                                    console.log('enrollment object:', enrollment);
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {
                                    // Ignore transient API timing errors
                                }
                            }, 2000);
                        },

                        onStateChange: (event) => {
                            const states = {
                                '-1': 'unstarted',
                                '0': 'ended',
                                '1': 'playing',
                                '2': 'paused',
                                '3': 'buffering',
                                '5': 'cued',
                            };
                            console.log('🎬 Player state:', states[event.data] || event.data);
                        },

                        onError: (event) => {
                            console.error('❌ YouTube player error:', event?.data ?? event);
                        },
                    },
                });
            } catch (err) {
                console.error('❌ Failed to initialize YouTube player:', err);
            }
        };

        initYouTubePlayer();

        return () => {
            mounted = false;
            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }
            if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
                try {
                    ytPlayerRef.current.destroy();
                } catch (e) {
                    console.warn('Error destroying YT player during cleanup:', e);
                }
                ytPlayerRef.current = null;
            }
        };
        // NOTE: include stableEnrollmentId and others that affect dispatch logic
    }, [
        dispatch,
        lessonId,
        youtubeEmbed,
        stableEnrollmentId,
        videoDuration,
        // completedSet is likely a Set from redux; include it so updates retrigger effect if it changes
        completedSet,
        enrollment?.id,
        user?.role,
        lesson,
    ]);

    // Refetch lesson when lessonId changes (for navigation)
    useEffect(() => {
        if (courseId && lessonId && !storeLesson) {
            console.log('🔄 Lesson not in store, fetching course data');
            dispatch(fetchCourseById(courseId));
        }
    }, [dispatch, courseId, lessonId, storeLesson]);

    // Get all lessons for navigation
    const allLessons = useMemo(() => {
        return course?.lessons || [];
    }, [course?.lessons]);

    // Find current lesson index
    const currentLessonIndex = useMemo(() => {
        return allLessons.findIndex(l => l.id === lessonId);
    }, [allLessons, lessonId]);

    // Get previous and next lessons
    const previousLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
    const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

    // Navigation handlers
    const handlePreviousLesson = () => {
        if (previousLesson) {
            // Force a clean navigation with state
            navigate(`/courses/${courseId}/lessons/${previousLesson.id}`, {
                state: { lesson: previousLesson },
                replace: false
            });
            // Force scroll to top
            window.scrollTo(0, 0);
        }
    };

    const handleNextLesson = () => {
        if (nextLesson) {
            // Force a clean navigation with state
            navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, {
                state: { lesson: nextLesson },
                replace: false
            });
            // Force scroll to top
            window.scrollTo(0, 0);
        }
    };

    if (!lesson || !course) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>Loading lesson...</div>
            </div>
        );
    }

    // derive some lightweight metadata for display
    const displayDuration =
        typeof lesson.duration === "number" && lesson.duration > 0 ? `${lesson.duration} min` : null;
    const isCompleted = completedSet.has(lessonId);

    // Load notes from localStorage on mount or lesson change
    useEffect(() => {
        try {
            const savedNotes = localStorage.getItem(notesKey);
            if (savedNotes) {
                setNotes(savedNotes);
                console.log('📝 Loaded notes from localStorage');
            } else {
                setNotes("");
            }
        } catch (error) {
            console.error("Error loading notes:", error);
            setNotes("");
        }
    }, [notesKey]);

    // Save notes to localStorage
    const saveNotes = (noteText) => {
        try {
            localStorage.setItem(notesKey, noteText);
            setLastSaved(new Date());
            setIsSaving(false);
            console.log('✅ Notes saved to localStorage');
        } catch (error) {
            console.error("Error saving notes:", error);
            toast.error("Failed to save notes");
            setIsSaving(false);
        }
    };

    // Handle notes change with auto-save debounce
    const handleNotesChange = (e) => {
        const newNotes = e.target.value;
        setNotes(newNotes);
        setIsSaving(true);

        // Clear previous timeout
        if (notesTimeoutRef.current) {
            clearTimeout(notesTimeoutRef.current);
        }

        // Auto-save after 1.5 seconds of no typing
        notesTimeoutRef.current = setTimeout(() => {
            saveNotes(newNotes);
        }, 1500);
    };

    // Manual save handler
    const handleManualSave = () => {
        // Clear any pending auto-save
        if (notesTimeoutRef.current) {
            clearTimeout(notesTimeoutRef.current);
        }
        setIsSaving(true);
        saveNotes(notes);
        toast.success("Notes saved successfully!");
    };

    // Format time since last save
    const formatTimeSince = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (notesTimeoutRef.current) {
                clearTimeout(notesTimeoutRef.current);
            }
        };
    }, []);

    // Debug logs
    console.log('🎬 Render check:');
    console.log('  youtubeEmbed:', youtubeEmbed);
    console.log('  lesson.videoUrl:', lesson?.videoUrl);
    console.log('  lessonId:', lessonId);

    return (
        <div className={styles.page}>
            {/* Toggle Lesson Panel Button */}
            <button
                className={styles.togglePanelBtn}
                onClick={() => setShowSidebar(!showSidebar)}
            >
                {showSidebar ? '◄ Hide' : '☰ Lessons'}
            </button>

            {/* Lesson Navigation Panel (LEFT) */}
            <div className={`${styles.lessonPanel} ${!showSidebar ? styles.lessonPanelHidden : ''}`}>
                <div className={styles.lessonPanelHeader}>
                    <div className={styles.lessonPanelTitle}>{course?.title || "Course"}</div>
                    <div className={styles.lessonPanelSubtitle}>
                        {allLessons.length} lesson{allLessons.length !== 1 ? 's' : ''}
                    </div>
                </div>

                <div className={styles.lessonList}>
                    {allLessons.map((l, index) => {
                        const isActive = l.id === lessonId;
                        const isCompleted = completedSet.has(l.id);

                        return (
                            <div
                                key={l.id}
                                className={`${styles.lessonItem} ${isActive ? styles.lessonItemActive : ''}`}
                                onClick={() => {
                                    if (l.id !== lessonId) {
                                        navigate(`/courses/${courseId}/lessons/${l.id}`, {
                                            state: { lesson: l },
                                            replace: false
                                        });
                                        window.scrollTo(0, 0);
                                    }
                                }}
                            >
                                <span className={styles.lessonNumber}>{index + 1}</span>
                                <span className={styles.lessonTitle}>{l.title || "Untitled"}</span>
                                {isCompleted && <span className={styles.lessonCompleted}>✓</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className={`${styles.container} ${showSidebar ? styles.containerWithPanel : styles.containerWithoutPanel}`}>
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
                                {/* <iframe
                                    ref={iframeRef}
                                    id={`yt-player-${lessonId}`}
                                    className={styles.iframe}
                                    title={lesson.title || "lesson-video"}
                                    src={`https://www.youtube.com/embed/${extractYouTubeId(lesson.videoUrl)}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                /> */}
                                <div
                                    id={`yt-player-container-${lessonId}`}
                                    ref={playerContainerRef}
                                    className={styles.iframeContainer}
                                    title={lesson.title || "lesson-video-container"}
                                />
                            </div>
                        ) : (
                            <div className={styles.nativePlayer}>
                                <video ref={videoRef} src={lesson.videoUrl} controls className={styles.video} />
                            </div>
                        )}
                    </section>

                    {/* Navigation Buttons */}
                    <div className={styles.navigationButtons}>
                        <button
                            className={styles.navButton}
                            onClick={handlePreviousLesson}
                            disabled={!previousLesson}
                        >
                            <span style={{ fontSize: '16px' }}>← Previous</span>
                            {previousLesson && (
                                <span style={{ fontSize: '11px', opacity: 0.7, textAlign: 'center' }}>
                                    {previousLesson.title?.slice(0, 30)}{previousLesson.title?.length > 30 ? '...' : ''}
                                </span>
                            )}
                        </button>

                        <button
                            className={styles.navButton}
                            onClick={handleNextLesson}
                            disabled={!nextLesson}
                        >
                            <span style={{ fontSize: '16px' }}>Next →</span>
                            {nextLesson && (
                                <span style={{ fontSize: '11px', opacity: 0.7, textAlign: 'center' }}>
                                    {nextLesson.title?.slice(0, 30)}{nextLesson.title?.length > 30 ? '...' : ''}
                                </span>
                            )}
                        </button>
                    </div>

                    <section className={styles.controlsRow} aria-hidden={true}>
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
                            <textarea
                                className={styles.notes}
                                placeholder="Take quick notes about this lesson (local only)"
                                value={notes}
                                onChange={handleNotesChange}
                            />
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: '8px'
                                }}
                            >
                                <small className={styles.smallMeta}>
                                    {isSaving && "Saving..."}
                                    {!isSaving && lastSaved && `Saved ${formatTimeSince(lastSaved)}`}
                                    {!isSaving && !lastSaved && "Notes are stored locally in your browser."}
                                </small>

                                <button
                                    onClick={handleManualSave}
                                    disabled={isSaving}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '13px',
                                        backgroundColor: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        opacity: isSaving ? 0.6 : 1,
                                    }}
                                >
                                    {isSaving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default LessonPlayer;
