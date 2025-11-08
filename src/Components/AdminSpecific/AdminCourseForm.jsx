import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useMatch } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { auth } from "../../auth/auth.js";
import { uploadImageToSupabase, deleteImageFromSupabase } from "../../database/supabaseStorage.js";
import { buildLessonOps } from "../../ReduxToolKit/Slices/CourseAndLessons/courseHelpers.js";
import { useToast } from "../../middleware/ToastProvider.jsx";

import { fetchVideoDurationInMinutes, extractYouTubeId, convertYouTubeToEmbed,
    fetchYouTubeDurationViaIframe } from "../StudentSpecific/CoursesAndLessons/mediaHelper.js";
import {fetchCourseById, selectCourseById, updateCourse, createCourse} from "../../ReduxToolKit/Slices/CourseAndLessons/CourseSlice.js";
    

// helper function to compute course patch
const computeCoursePatch = (original = {}, draft = {}) => {
    const dataPatched = {};
    Object.keys(draft).forEach((key) => {
        if (key === "id") return;
        if (draft[key] !== original[key]) dataPatched[key] = draft[key];
    });
    return dataPatched;
};

// main component
function AdminCourseForm() {
    // State hooks
    const [draftCourse, setDraftCourse] = useState(null);
    const [originalCourse, setOriginalCourse] = useState(null);
    const [draftLessons, setDraftLessons] = useState([]);
    const [originalLessons, setOriginalLessons] = useState([]);
    const [saving, setSaving] = useState(false);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // variables that use hooks
    const previewUrlRef = useRef(null);
    const params = useParams();
    const courseId = params.courseId ?? params.id ?? null;
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const toast = useToast();

    // Warn if editing route but no courseId param
    const isEditRoute = !!useMatch("/admin/courses/edit/:courseId") || window.location.pathname.includes("/admin/courses/edit");
    if (isEditRoute && !courseId) {
        toast.warning(
            "AdminCourseForm: expected route param courseId but none was found. Current path:",
            window.location.pathname
        );
    }

    // Redux store selectors
    const storeCourseData = useSelector((state) => selectCourseById(state, courseId));
    const { loading, error } = useSelector((state) => state.courses || {});

    
    useEffect(() => {
        if (courseId) dispatch(fetchCourseById(courseId));
    }, [dispatch, courseId]);

    useEffect(() => {
        let courseToUse = null;
        let lessonsToUse = [];

        if (courseId) {
            if (!storeCourseData) return;
            courseToUse = storeCourseData;
            lessonsToUse = courseToUse.lessons || [];
        } else {
            courseToUse = {
                id: null,
                title: "Untitled Course",
                desc: "Some description",
                price: 0,
                thumbnail: "",
                instructor: "",
                published: false,
                createdAt: null,
                updatedAt: null,
            };
            lessonsToUse = [];
        }

        setOriginalCourse(courseToUse);
        setDraftCourse({ ...courseToUse });

        const normalizedLessons = Array.isArray(lessonsToUse)
            ? lessonsToUse
            : Object.keys(lessonsToUse).map((k) => ({ id: k, ...lessonsToUse[k] }));

        setOriginalLessons(normalizedLessons);
        setDraftLessons(normalizedLessons.map((lsn) => ({ ...lsn })));
    }, [storeCourseData, courseId]);

    // derive change tracking info
    const { coursePatch, lessonOps, hasChanges } = useMemo(() => {
        if (!originalCourse || !draftCourse) {
            return {
                coursePatch: {},
                lessonOps: { toCreate: [], toUpdate: [], toDelete: [] },
                hasChanges: false,
            };
        }

        const coursePatchLocal = computeCoursePatch(originalCourse, draftCourse);
        const lessonOpsLocal = buildLessonOps(draftLessons, originalLessons);
        const has =
            Object.keys(coursePatchLocal).length > 0 ||
            lessonOpsLocal.toCreate.length > 0 ||
            lessonOpsLocal.toUpdate.length > 0 ||
            lessonOpsLocal.toDelete.length > 0;

        return {
            coursePatch: coursePatchLocal,
            lessonOps: lessonOpsLocal,
            hasChanges: has,
        };
    }, [originalCourse, draftCourse, originalLessons, draftLessons]);

    // update draft fields and set state
    const updateDraftField = (key, value) => {
        setDraftCourse((s) => ({
            ...(s || {}),
            [key]: value,
        }));
    };

    // Lesson management functions
    const addLesson = () => {
        setDraftLessons((arr) => [
            ...(arr || []),
            {
                id: undefined,
                title: "New lesson",
                desc: "",
                duration: 0,
                videoUrl: "",
                order: (arr?.length || 0) + 1,
            },
        ]);
    };

    // update lesson fields and set state
    const updateLessonField = useCallback((index, key, value) => {
        setDraftLessons((arr = []) => {
            const copy = arr.map((it) => ({ ...it }));
            if (!copy[index]) return copy;
            copy[index][key] = value;
            return copy;
        });
    }, []);

    // handle video url changes with debounced duration fetch
    const VIDEO_DEBOUNCE_MS = 600;
    const durationTimers = useRef(new Map());

    const performDurationFetch = useCallback(
        async (index, url) => {
            if (!url) return;
            const isDirectMedia = /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url);
            if (isDirectMedia) {
                try {
                    const mins = await fetchVideoDurationInMinutes(url);
                    if (mins != null) updateLessonField(index, "duration", mins);
                } catch (err) {
                    console.warn("Direct media duration failed", err);
                }
                return;
            }
            const ytId = extractYouTubeId(url);
            if (ytId) {
                try {
                    const embed = convertYouTubeToEmbed(url);
                    if (embed) updateLessonField(index, "embedUrl", embed);
                    const mins = await fetchYouTubeDurationViaIframe(url, 8000);
                    if (mins != null) updateLessonField(index, "duration", mins);
                } catch (err) {
                    console.warn("YT duration fetch failed (non-critical):", err);
                }
            }
        },
        [updateLessonField]
    );

    // handle video url change with debounce
    const handleLessonVideoUrlChange = (index, url) => {
        updateLessonField(index, "videoUrl", url);
        const map = durationTimers.current;
        if (map.has(index)) {
            clearTimeout(map.get(index));
            map.delete(index);
        }
        if (!url) return;
        const timer = setTimeout(() => {
            performDurationFetch(index, url);
            map.delete(index);
        }, VIDEO_DEBOUNCE_MS);
        map.set(index, timer);
    };

    // handle video url blur to immediately fetch duration
    const handleLessonVideoUrlBlur = (index, url) => {
        const map = durationTimers.current;
        if (map.has(index)) {
            clearTimeout(map.get(index));
            map.delete(index);
        }
        performDurationFetch(index, url);
    };

    const removeLesson = (index) => {
        setDraftLessons((arr = []) => {
            const copy = arr.map((it) => ({ ...it }));
            copy.splice(index, 1);
            return copy;
        });
    };

    const handleUploadThumbnail = async (file, idOverride) => {
        try {
            if (!auth?.currentUser) {
                throw new Error("You must be signed in to upload thumbnails.");
            }

            if (!file.type.startsWith("image/")) {
                throw new Error("Please select a valid image file");
            }

            if (file.size > 5 * 1024 * 1024) {
                throw new Error("Image size must be less than 5MB");
            }

            const url = await uploadImageToSupabase(file, "course-thumbnails");
            setUploading(false);
            return url;
        } catch (err) {
            setUploading(false);
            console.error("handleUploadThumbnail failed:", err);
            throw err;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            let usedCourseId = courseId || null;

            if (!courseId) {
                let thumbnailUrl = draftCourse.thumbnail || "";
                if (thumbnailFile) {
                    try {
                        setUploading(true);
                        thumbnailUrl = await handleUploadThumbnail(
                            thumbnailFile,
                            `temp-${Date.now()}`
                        );
                        setUploading(false);
                    } catch (err) {
                        setUploading(false);
                        toast.error("Thumbnail upload failed. Creating course without it.");
                        thumbnailUrl = "";
                    }
                }

                // create course
                const coursePayload = {
                    title: draftCourse.title,
                    desc: draftCourse.desc,
                    price: Number(draftCourse.price || 0),
                    thumbnail: thumbnailUrl,
                    instructor: draftCourse.instructor || "",
                    published: !!draftCourse.published,
                };

                const seen = new Set();
                const lessonsToSave = (draftLessons || [])
                    // remove duplicates
                    .filter((l) => {
                        const key = `${(l.title || "").trim()}-${(l.videoUrl || "").trim()}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    })
                    // normalize lesson data
                    .map((l, i) => ({
                        title: l.title || `Lesson ${i + 1}`,
                        desc: l.desc || "",
                        duration: Number(l.duration || 0),
                        videoUrl: l.videoUrl || "",
                        order: l.order ?? i + 1,
                    }));
                
                // dispatch createCourse action
                const createdAction = await dispatch(
                    createCourse({ courseData: coursePayload, lessons: lessonsToSave })
                ).unwrap();

                const createdCourseId = createdAction?.id;
                if (!createdCourseId) throw new Error("Create returned no course id");
                usedCourseId = createdCourseId;

                // update state with created course data
                const serverCourse = createdAction;
                setOriginalCourse(serverCourse);
                // important to set id from server
                setDraftCourse((prev) => ({
                    ...(prev || {}),
                    ...serverCourse,
                    id: createdCourseId,
                }));
                igo(serverCourse.lessons || []);
                setDraftLessons((serverCourse.lessons || []).map((l) => ({ ...l })));
            }

            // handle thumbnail upload if a new file is selected
            if (courseId && thumbnailFile) {
                try {
                    setUploading(true);
                    const url = await handleUploadThumbnail(thumbnailFile, courseId);
                    setUploading(false);

                    await dispatch(
                        updateCourse({
                            courseId: courseId,
                            coursePatch: { thumbnail: url },
                            lessonOps: {},
                        })
                    ).unwrap();

                    setDraftCourse((prev) => ({ ...(prev || {}), thumbnail: url }));
                    setOriginalCourse((prev) => ({ ...(prev || {}), thumbnail: url }));
                } catch (err) {
                    setUploading(false);
                    toast.error("Thumbnail upload failed. Continuing without updating it.");
                }
            }

            // handle course and lesson updates
            const cp = computeCoursePatch(originalCourse, draftCourse);
            const lo = buildLessonOps(draftLessons, originalLessons);

            const hasCoursePatch = cp && Object.keys(cp).length > 0;
            const hasLessonOps =
                lo &&
                (lo.toCreate?.length || 0) +
                (lo.toUpdate?.length || 0) +
                (lo.toDelete?.length || 0) >
                0;

            if (hasCoursePatch || hasLessonOps) {
                await dispatch(
                    updateCourse({
                        courseId: usedCourseId,
                        coursePatch: cp,
                        lessonOps: lo,
                    })
                ).unwrap();
            }

            await dispatch(fetchCourseById(usedCourseId));
            toast.success("Course saved successfully!!")
            navigate("/admin/courses");
        } catch (err) {
            console.error("Save failed:", err);
            toast.error(`Save failed: ${err.message || err}`);
        } finally {
            setSaving(false);
            setUploading(false);
        }
    };

    const handleCancel = () => navigate(
        "/admin/courses",
        { replace: true }
    );

    // cleanup timers and object URLs on unmount
    useEffect(() => () => durationTimers.current.forEach(clearTimeout), []);

    // cleanup preview URL on unmount
    useEffect(
        () => () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }
        },
        []
    );

    if (loading || !draftCourse) return <p className="p-6">Loading form...</p>;
    if (error) return <p className="p-6 text-red-500">Error: {error}</p>;

    return (
        <div className="min-h-screen bg-stone-900 text-gray-100 py-10 px-6">
            <div className="max-w-5xl mx-auto space-y-10">
                {/* Header */}
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-indigo-100">
                            {courseId ? "Edit Course" : "Create Course"}
                        </h1>
                        <p className="text-gray-400">
                            Manage course content, lessons, and metadata.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-stone-700 hover:bg-stone-600 rounded text-sm border border-stone-600"
                            disabled={saving || uploading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={
                                courseId ? !hasChanges || saving || uploading : saving || uploading
                            }
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium text-white disabled:opacity-50 border border-indigo-500"
                        >
                            {saving || uploading
                                ? "Saving..."
                                : courseId
                                    ? "Save Changes"
                                    : "Create Course"}
                        </button>
                    </div>
                </header>

                {/* Course Info Section */}
                <section className="bg-stone-800 rounded-xl p-6 space-y-5 shadow border border-indigo-900/30">
                    <h2 className="text-lg font-semibold border-b border-indigo-800/40 pb-2 text-indigo-200">
                        Course Information
                    </h2>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Title</label>
                        <input
                            value={draftCourse.title}
                            onChange={(e) => updateDraftField("title", e.target.value)}
                            className="w-full bg-stone-700 border border-stone-600 text-gray-100 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Description</label>
                        <textarea
                            value={draftCourse.desc}
                            onChange={(e) => updateDraftField("desc", e.target.value)}
                            className="w-full bg-stone-700 border border-stone-600 text-gray-100 px-3 py-2 rounded h-28 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Price</label>
                            <input
                                type="number"
                                value={draftCourse.price}
                                onChange={(e) =>
                                    updateDraftField("price", Number(e.target.value))
                                }
                                className="w-full bg-stone-700 border border-stone-600 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <label className="flex items-center gap-2 mt-7">
                            <input
                                type="checkbox"
                                checked={!!draftCourse.published}
                                onChange={(e) =>
                                    updateDraftField("published", e.target.checked)
                                }
                                className="accent-indigo-600"
                            />
                            <span className="text-sm text-gray-300">Make Course Live</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Instructor</label>
                        <input
                            type="text"
                            value={draftCourse.instructor || ""}
                            onChange={(e) =>
                                updateDraftField("instructor", e.target.value)
                            }
                            className="w-full bg-stone-700 border border-stone-600 text-gray-100 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            placeholder="Instructor name"
                        />
                    </div>

                    <div className="grid gap-3">
                        <label className="text-sm text-gray-300">Thumbnail URL</label>
                        <input
                            value={draftCourse.thumbnail}
                            onChange={(e) =>
                                updateDraftField("thumbnail", e.target.value)
                            }
                            className="w-full bg-stone-700 border border-stone-600 text-gray-100 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setThumbnailFile(file);
                                if (previewUrlRef.current) {
                                    URL.revokeObjectURL(previewUrlRef.current);
                                    previewUrlRef.current = null;
                                }
                                if (file) {
                                    previewUrlRef.current = URL.createObjectURL(file);
                                    updateDraftField("thumbnail", "");
                                }
                            }}
                            className="text-sm text-gray-400"
                        />
                        {previewUrlRef.current || draftCourse.thumbnail ? (
                            <img
                                src={previewUrlRef.current || draftCourse.thumbnail}
                                alt="Thumbnail Preview"
                                className="mt-2 h-24 w-auto rounded border border-indigo-700/50 object-contain"
                            />
                        ) : null}
                    </div>
                </section>

                {/* Lessons Section */}
                <section className="bg-stone-800 rounded-xl p-6 shadow space-y-5 border border-indigo-900/30">
                    <div className="flex items-center justify-between border-b border-indigo-800/40 pb-2">
                        <h2 className="text-lg font-semibold text-indigo-200">Lessons</h2>
                        <button
                            onClick={addLesson}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-sm border border-indigo-500"
                        >
                            + Add Lesson
                        </button>
                    </div>

                    {draftLessons.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">
                            No lessons yet. Click "Add Lesson" to create one.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {draftLessons.map((lesson, idx) => (
                                <div
                                    key={idx}
                                    className="bg-stone-700 rounded-lg p-4 space-y-3 border border-indigo-800/30"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-indigo-300">
                                            Lesson {idx + 1}
                                        </span>
                                        <button
                                            onClick={() => removeLesson(idx)}
                                            className="text-red-400 hover:text-red-300 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-300 mb-1">
                                            Title
                                        </label>
                                        <input
                                            value={lesson.title}
                                            onChange={(e) =>
                                                updateLessonField(idx, "title", e.target.value)
                                            }
                                            className="w-full bg-stone-600 border border-stone-500 text-gray-100 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-300 mb-1">
                                            Description
                                        </label>
                                        <textarea
                                            value={lesson.desc}
                                            onChange={(e) =>
                                                updateLessonField(idx, "desc", e.target.value)
                                            }
                                            className="w-full bg-stone-600 border border-stone-500 text-gray-100 px-3 py-2 rounded h-20 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-300 mb-1">
                                                Video URL
                                            </label>
                                            <input
                                                value={lesson.videoUrl}
                                                onChange={(e) =>
                                                    handleLessonVideoUrlChange(idx, e.target.value)
                                                }
                                                onBlur={(e) =>
                                                    handleLessonVideoUrlBlur(idx, e.target.value)
                                                }
                                                className="w-full bg-stone-600 border border-stone-500 text-gray-100 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                placeholder="https://..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-gray-300 mb-1">
                                                Duration (minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={lesson.duration}
                                                onChange={(e) =>
                                                    updateLessonField(
                                                        idx,
                                                        "duration",
                                                        Number(e.target.value)
                                                    )
                                                }
                                                className="w-full bg-stone-600 border border-stone-500 text-gray-100 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Debug Panel */}
                <section className="bg-stone-800 rounded-xl p-6 shadow border border-indigo-900/20">
                    <h3 className="text-sm font-semibold text-indigo-300 mb-3">
                        Debug Info
                    </h3>
                    <div className="space-y-2 text-xs text-gray-400 font-mono">
                        <p>Has Changes: <span className="text-indigo-400">{hasChanges ? "Yes" : "No"}</span></p>
                        <p>Course Patch Keys: <span className="text-indigo-400">{Object.keys(coursePatch).join(", ") || "none"}</span></p>
                        <p>Lessons to Create: <span className="text-indigo-400">{lessonOps.toCreate.length}</span></p>
                        <p>Lessons to Update: <span className="text-indigo-400">{lessonOps.toUpdate.length}</span></p>
                        <p>Lessons to Delete: <span className="text-indigo-400">{lessonOps.toDelete.length}</span></p>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default AdminCourseForm;