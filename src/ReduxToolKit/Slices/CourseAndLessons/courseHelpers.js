import { doc, setDoc, updateDoc, addDoc, collection, getDocs, getDoc, writeBatch, serverTimestamp, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../../../database/firebaseInit.js";
import { courseSchema } from "../../../database/schema/courseSchema.js";
import { lessonSchema } from "../../../database/schema/lessonSchema.js";

// convert Firestore Timestamp -> number (ms) or null
export const tsToMillis = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v ?? null);

// sanitize lesson object read from Firestore
const sanitizeLessonDoc = (id, raw = {}) => ({
    id,
    title: raw.title ?? null,
    desc: raw.desc ?? null,
    duration: raw.duration ?? null,
    videoUrl: raw.videoUrl ?? null,
    order: raw.order ?? null,
    embedUrl: raw.embedUrl ?? null,
    createdAt: tsToMillis(raw.createdAt),
    updatedAt: tsToMillis(raw.updatedAt),
});

// sanitize course doc (minimal fields, you can expand)
const sanitizeCourseDoc = (id, raw = {}) => ({
    id,
    title: raw.title ?? null,
    desc: raw.desc ?? null,
    price: raw.price ?? 0,
    thumbnail: raw.thumbnail ?? "",
    instructor: raw.instructor ?? "",
    published: !!raw.published,
    createdAt: tsToMillis(raw.createdAt),
    updatedAt: tsToMillis(raw.updatedAt),
});

// createCourseDoc: create course, allow auto-ID if courseId not given
export const createCourseDoc = async (courseId, courseData, instructor) => {
    // build normalized course payload
    const finalCourse = courseSchema(courseData, instructor);
    const payload = {
        ...finalCourse,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    if (courseId) {
        // create or overwrite doc with explicit id
        await setDoc(doc(db, "courses", courseId), payload);

        // read back the stored doc to obtain server timestamps
        const snap = await getDoc(doc(db, "courses", courseId));
        const raw = snap.exists() ? snap.data() : finalCourse;

        return { id: courseId, ...sanitizeCourseDoc(courseId, raw) };
    } else {
        // auto-id path
        const ref = await addDoc(collection(db, "courses"), payload);

        // read back created doc to get server timestamps
        const snap = await getDoc(doc(db, "courses", ref.id));
        const raw = snap.exists() ? snap.data() : finalCourse;

        // FIX: return the ref.id, not courseId
        return { id: ref.id, ...sanitizeCourseDoc(ref.id, raw) };
    }
};

// createLessonDoc: create lesson, allow Firestore auto-ID when lessonId omitted
export const createLessonDoc = async (courseId, lessonId, lessonData) => {
    const finalLesson = lessonSchema(lessonData); // includes serverTimestamp()
    const payload = { ...finalLesson, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

    if (lessonId) {
        // write with explicit id
        await setDoc(doc(db, "courses", courseId, "lessons", lessonId), payload);
        // read back to obtain server timestamps
        const snap = await getDoc(doc(db, "courses", courseId, "lessons", lessonId));
        const raw = snap.exists() ? snap.data() : finalLesson;
        return sanitizeLessonDoc(lessonId, raw);
    } else {
        // auto-id flow
        const ref = doc(collection(db, "courses", courseId, "lessons")); // auto-id ref
        await setDoc(ref, payload);
        const snap = await getDoc(ref);
        const raw = snap.exists() ? snap.data() : finalLesson;
        return sanitizeLessonDoc(ref.id, raw);
    }
};

// updateCourseDoc: update course metadata (applies schema normalization)
export const updateCourseDoc = async (courseId, updates) => {
    const finalUpdates = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, "courses", courseId), finalUpdates);

    // Read back saved value to get real timestamp
    const snap = await getDoc(doc(db, "courses", courseId));
    const raw = snap.exists() ? snap.data() : {};
    // return patch-like object with updatedAt as millis
    return { ...updates, updatedAt: tsToMillis(raw.updatedAt) };
};

// updateLessonDoc: update a lesson (applies updatedAt)
export const updateLessonDoc = async (courseId, lessonId, updates) => {
    const finalUpdates = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, "courses", courseId, "lessons", lessonId), finalUpdates);

    // read back to get server timestamp value
    const snap = await getDoc(doc(db, "courses", courseId, "lessons", lessonId));
    const raw = snap.exists() ? snap.data() : {};
    // return patch-like object with updatedAt as millis
    return { ...updates, updatedAt: tsToMillis(raw.updatedAt) };
};

// updateCourseWithOps: atomic batch for course + lessonOps
export const updateCourseWithOps = async (courseId, coursePatch = {}, lessonOps = {}) => {
    const batch = writeBatch(db);

    // update course if needed
    if (coursePatch && Object.keys(coursePatch).length > 0) {
        batch.update(doc(db, "courses", courseId), { ...coursePatch, updatedAt: serverTimestamp() });
    }

    // toCreate: use auto-id for each
    (lessonOps.toCreate || []).forEach((lsn) => {
        const ref = doc(collection(db, "courses", courseId, "lessons"));
        const payload = { ...lessonSchema(lsn), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        batch.set(ref, payload);
    });

    // toUpdate
    (lessonOps.toUpdate || []).forEach(({ id, patch }) => {
        batch.update(doc(db, "courses", courseId, "lessons", id), { ...patch, updatedAt: serverTimestamp() });
    });

    // toDelete
    (lessonOps.toDelete || []).forEach((id) => {
        batch.delete(doc(db, "courses", courseId, "lessons", id));
    });

    await batch.commit();
    return { courseId, coursePatch, lessonOps };
};

// deleteCourseDoc: delete lessons (chunked) then delete course
export const deleteCourseDoc = async (courseId) => {
    // fetch lesson refs
    const lessonsRef = collection(db, "courses", courseId, "lessons");
    const snap = await getDocs(lessonsRef);
    const refs = snap.docs.map(d => d.ref);

    const CHUNK = 450; // safe under 500
    for (let i = 0; i < refs.length; i += CHUNK) {
        const batch = writeBatch(db);
        const chunk = refs.slice(i, i + CHUNK);
        chunk.forEach(r => batch.delete(r));
        await batch.commit();
    }

    // finally delete course doc
    await deleteDoc(doc(db, "courses", courseId));
    return courseId;
};

export async function cleanupDuplicateLessons(courseId) {
    try {
        console.log('🧹 Starting cleanup for course:', courseId);

        const lessonsRef = collection(db, "courses", courseId, "lessons");
        const q = query(lessonsRef, orderBy("order", "asc"));
        const snap = await getDocs(q);

        const lessons = snap.docs.map(d => ({
            id: d.id,
            ref: d.ref,
            ...d.data()
        }));

        console.log('📚 Found lessons:', lessons.length);

        const seen = new Map(); // key -> first lesson doc
        const toDelete = [];

        for (const lesson of lessons) {
            const key = `${(lesson.title || '').trim()}-${(lesson.videoUrl || '').trim()}`;

            if (seen.has(key)) {
                // Duplicate found - mark for deletion
                console.log('❌ Duplicate found:', lesson.title, lesson.id);
                toDelete.push(lesson.ref);
            } else {
                // First occurrence - keep it
                seen.set(key, lesson);
            }
        }

        console.log('🗑️ Deleting', toDelete.length, 'duplicates...');

        // Delete duplicates
        for (const ref of toDelete) {
            await deleteDoc(ref);
            console.log('✅ Deleted:', ref.id);
        }

        console.log('✅ Cleanup complete!');
        return {
            total: lessons.length,
            kept: lessons.length - toDelete.length,
            deleted: toDelete.length
        };

    } catch (err) {
        console.error('❌ Cleanup failed:', err);
        throw err;
    }
}

// ______________helper for course and lesson components not slice______________
export const buildLessonOps = (draftLessons = [], originalLessons = []) => {
    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];

    // Index originals by id for quick lookup
    const originalMap = {};
    originalLessons.forEach(lsn => {
        originalMap[lsn.id] = lsn;
    });

    // Walk draft lessons: detect new or updated
    draftLessons.forEach(lsn => {
        if (!lsn.id) {
            // No id → brand new lesson
            toCreate.push(lsn);
        } else if (originalMap[lsn.id]) {
            // Existing lesson → check if any field changed
            const original = originalMap[lsn.id];
            const patch = {};

            Object.keys(lsn).forEach(key => {
                if (key === "id") return; // skip id
                if (lsn[key] !== original[key]) {
                    patch[key] = lsn[key];
                }
            });

            if (Object.keys(patch).length > 0) {
                toUpdate.push({ id: lsn.id, patch });
            }

            // Mark this original as handled
            delete originalMap[lsn.id];
        }
    });

    // Remaining originals in map → deleted lessons
    Object.keys(originalMap).forEach(id => {
        toDelete.push(id);
    });

    return { toCreate, toUpdate, toDelete };
};