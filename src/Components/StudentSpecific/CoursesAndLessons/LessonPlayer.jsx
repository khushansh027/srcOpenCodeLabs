import { useEffect, useRef, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { userSelector } from "../../../ReduxToolKit/Slices/UserSlice.js";
import {
  fetchCourseById,
  selectCourseById,
  selectLessonById,
} from "../../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
import {
  selectEnrollmentByCourseId,
  markLessonCompletedByEnrollment,
  fetchEnrollmentForCourse,
} from "../../../ReduxToolKit/Slices/EnrollmentSlice.js";
import {
  fetchVideoDurationInMinutes,
  extractYouTubeId,
  convertYouTubeToEmbed,
  fetchYouTubeDurationViaIframe,
  loadYouTubeIframeAPI,
} from "./mediaHelper.js";
import { useToast } from "../../../middleware/ToastProvider.jsx";
import styles from "./LessonPlayer.module.css";

function LessonPlayer() {
  // routing / redux
  const { courseId, lessonId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  // refs & local state
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null); // container for YouTube API to create iframe
  const ytPlayerRef = useRef(null); // YT player instance
  const didDispatchRef = useRef(false);
  const durationFetchRef = useRef(false);
  const adminToastShownRef = useRef(false);
  const notesTimeoutRef = useRef(null);

  const [videoDuration, setVideoDuration] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // user & store selectors
  const user = useSelector(userSelector);
  const userId = user?.uid;
  const storeLesson = useSelector((s) => selectLessonById(s, courseId, lessonId));
  const course = useSelector((s) => selectCourseById(s, courseId));
  const enrollment = useSelector((s) => selectEnrollmentByCourseId(s, courseId));

  // immediate guard
  if (!userId) return <div className={styles.loading}>Loading…</div>;

  // data derived
  const completedLessons = enrollment?.completedLessons || [];
  const completedSet = useMemo(() => new Set(completedLessons), [completedLessons]);
  const stableEnrollmentId = enrollment?.id;
  const locationLesson = location?.state?.lesson || null;
  const lesson = storeLesson || locationLesson;
  const youtubeEmbed = convertYouTubeToEmbed(lesson?.videoUrl);

  // notes key
  const notesKey = `lesson-notes-${courseId}-${lessonId}`;

  // Minimal helpful debug
  useEffect(() => {
    console.log("LessonPlayer mounted:", { courseId, lessonId, userId });
  }, [courseId, lessonId, userId]);

  // fetch course if missing
  useEffect(() => {
    if (courseId && !course) {
      dispatch(fetchCourseById(courseId));
    }
  }, [dispatch, courseId, course]);

  // fetch enrollment if missing
  useEffect(() => {
    if (courseId && userId && !enrollment) {
      dispatch(fetchEnrollmentForCourse({ userId, courseId }));
    }
  }, [dispatch, courseId, userId, enrollment]);

  // reset dispatch flags on lesson/enrollment change
  useEffect(() => {
    didDispatchRef.current = false;
    durationFetchRef.current = false;
  }, [lessonId, enrollment?.id]);

  // prefetch video duration (YT or generic)
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

  // Combined effect: native video listeners OR YouTube API player
  useEffect(() => {
    if (!lesson) return;

    // NATIVE VIDEO: HTML5 <video> timeupdate/ended listener
    if (!youtubeEmbed) {
      const v = videoRef.current;
      if (!v) return;

      const onTimeUpdate = () => {
        if (didDispatchRef.current) return;

        const nativeDuration =
          typeof v.duration === "number" && isFinite(v.duration) && v.duration > 0 ? v.duration : null;
        const duration = nativeDuration || videoDuration || 0;
        if (duration <= 0) return;

        const percent = (v.currentTime / duration) * 100;
        if (percent >= 80 && !completedSet.has(lessonId)) {
          if (enrollment?.id) {
            dispatch(
              markLessonCompletedByEnrollment({
                enrollmentId: enrollment.id,
                lessonId,
              })
            );
            didDispatchRef.current = true;
          } else if (user?.role === "admin" && !adminToastShownRef.current) {
            toast.info("Progress not tracked in admin preview mode", { duration: 5000 });
            adminToastShownRef.current = true;
          }
        }
      };

      v.addEventListener("timeupdate", onTimeUpdate);
      v.addEventListener("ended", onTimeUpdate);

      return () => {
        v.removeEventListener("timeupdate", onTimeUpdate);
        v.removeEventListener("ended", onTimeUpdate);
      };
    }

    // YOUTUBE EMBED: Let YT API create iframe inside container
    let mounted = true;
    let progressInterval = null;

    const initYouTubePlayer = async () => {
      try {
        await loadYouTubeIframeAPI();
        if (!mounted) return;

        const container = playerContainerRef?.current;
        if (!container) {
          console.error("YT container not mounted");
          return;
        }

        // extract videoId
        const videoId =
          (typeof extractYouTubeId === "function" && extractYouTubeId(lesson.videoUrl)) ||
          (youtubeEmbed && (() => {
            try {
              const m = youtubeEmbed.match(/\/embed\/([^?&/]+)/);
              return m ? m[1] : null;
            } catch (e) {
              return null;
            }
          })()) ||
          null;

        if (!videoId) {
          console.error("Could not extract videoId for YouTube player:", lesson?.videoUrl, youtubeEmbed);
          return;
        }

        // destroy previous player if present
        if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
          try {
            ytPlayerRef.current.destroy();
          } catch (e) {
            console.warn("Error destroying previous YT player:", e);
          }
          ytPlayerRef.current = null;
        }

        // create new player (YT API will create the iframe)
        ytPlayerRef.current = new window.YT.Player(container, {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: {
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              // start polling progress
              progressInterval = setInterval(() => {
                try {
                  if (!ytPlayerRef.current || didDispatchRef.current || !mounted) return;

                  const duration = ytPlayerRef.current.getDuration();
                  const currentTime = ytPlayerRef.current.getCurrentTime();

                  if (duration > 0 && typeof currentTime === "number") {
                    const percent = (currentTime / duration) * 100;
                    if (percent >= 80 && !completedSet.has(lessonId)) {
                      if (enrollment?.id) {
                        dispatch(
                          markLessonCompletedByEnrollment({
                            enrollmentId: enrollment.id,
                            lessonId,
                          })
                        );
                        didDispatchRef.current = true;

                        if (progressInterval) {
                          clearInterval(progressInterval);
                          progressInterval = null;
                        }
                      } else if (user?.role === "admin" && !adminToastShownRef.current) {
                        toast.info("Progress not tracked in admin preview mode", { duration: 5000 });
                        adminToastShownRef.current = true;
                      }
                    }
                  }
                } catch (e) {
                  // transient API errors are ignored
                }
              }, 2000);
            },

            onStateChange: (event) => {
              // optional: state debug
              // console.log("YT state:", event.data);
            },

            onError: (event) => {
              console.error("YouTube player error:", event?.data ?? event);
            },
          },
        });
      } catch (err) {
        console.error("Failed to initialize YouTube player:", err);
      }
    };

    if (youtubeEmbed) {
      initYouTubePlayer();
    }

    return () => {
      mounted = false;
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying YT player during cleanup:", e);
        }
        ytPlayerRef.current = null;
      }
    };
    // keep deps that affect dispatch / player creation
  }, [
    dispatch,
    lessonId,
    youtubeEmbed,
    stableEnrollmentId,
    videoDuration,
    completedSet,
    enrollment?.id,
    user?.role,
    lesson,
    toast,
  ]);

  // refetch lesson if not present when lessonId changes
  useEffect(() => {
    if (courseId && lessonId && !storeLesson) {
      dispatch(fetchCourseById(courseId));
    }
  }, [dispatch, courseId, lessonId, storeLesson]);

  // navigation helpers
  const allLessons = useMemo(() => course?.lessons || [], [course?.lessons]);
  const currentLessonIndex = useMemo(() => allLessons.findIndex((l) => l.id === lessonId), [
    allLessons,
    lessonId,
  ]);
  const previousLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  const handlePreviousLesson = () => {
    if (previousLesson) {
      navigate(`/courses/${courseId}/lessons/${previousLesson.id}`, {
        state: { lesson: previousLesson },
        replace: false,
      });
      window.scrollTo(0, 0);
    }
  };

  const handleNextLesson = () => {
    if (nextLesson) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, {
        state: { lesson: nextLesson },
        replace: false,
      });
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

  const displayDuration =
    typeof lesson.duration === "number" && lesson.duration > 0 ? `${lesson.duration} min` : null;
  const isCompleted = completedSet.has(lessonId);

  // notes load
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem(notesKey);
      if (savedNotes) {
        setNotes(savedNotes);
      } else {
        setNotes("");
      }
    } catch (error) {
      console.error("Error loading notes:", error);
      setNotes("");
    }
  }, [notesKey]);

  // notes save helpers
  const saveNotes = (noteText) => {
    try {
      localStorage.setItem(notesKey, noteText);
      setLastSaved(new Date());
      setIsSaving(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
      setIsSaving(false);
    }
  };

  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    setIsSaving(true);

    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }

    notesTimeoutRef.current = setTimeout(() => {
      saveNotes(newNotes);
    }, 1500);
  };

  const handleManualSave = () => {
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    setIsSaving(true);
    saveNotes(notes);
    toast.success("Notes saved successfully!");
  };

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
    };
  }, []);

  const formatTimeSince = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // render
  return (
        <div className={styles.page}>
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

            {/* Main Content (container includes the header where toggle lives) */}
            <div className={`${styles.container} ${showSidebar ? styles.containerWithPanel : styles.containerWithoutPanel}`}>
                <main className={styles.playerColumn} role="main" aria-labelledby="lesson-title">
                    <header className={styles.header}>
                        {/* Toggle Lesson Panel Button (moved into header to avoid overlapping navbar) */}
                        <button
                            className={styles.togglePanelBtn}
                            onClick={() => setShowSidebar(!showSidebar)}
                            aria-expanded={showSidebar}
                            aria-label={showSidebar ? 'Hide lessons' : 'Show lessons'}
                        >
                            {showSidebar ? '◄ Hide' : '☰ Lessons'}
                        </button>

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
