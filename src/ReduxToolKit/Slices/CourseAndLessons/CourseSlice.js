import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { collection, doc, getDoc, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../../../database/firebaseInit.js";
import { createCourseDoc, createLessonDoc, updateCourseWithOps, deleteCourseDoc } from "./courseHelpers.js";

/* -----------------------Async thunks----------------------- */

// 1. Get all courses (sanitized timestamps)
// const fetchCourses = createAsyncThunk("courses/fetchAll", async (_, thunkAPI) => {
//     try {
//         const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "desc")));
//         const courses = snap.docs.map((d) => {
//             const data = d.data();
//             return {
//                 id: d.id,
//                 ...data,
//                 createdAt: data.createdAt?.toMillis?.() ?? null,
//                 updatedAt: data.updatedAt?.toMillis?.() ?? null,
//             };
//         });
//         return courses;
//     } catch (err) {
//         console.error("Error in fetching courses.", err);
//         return thunkAPI.rejectWithValue(err.message || "Courses could not be fetched");
//     }
// });
// 1. Get all courses (sanitized timestamps) + lessonsCount per course
const fetchCourses = createAsyncThunk("courses/fetchAll", async (_, thunkAPI) => {
    try {
        // fetch all courses as before
        const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "desc")));
        const courses = snap.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toMillis?.() ?? null,
                updatedAt: data.updatedAt?.toMillis?.() ?? null,
            };
        });

        // If no courses, return early
        if (!courses || courses.length === 0) return courses;

        // For each course, fetch lessons subcollection to count docs.
        // We parallelize reads to speed things up.
        const counts = await Promise.all(
            courses.map(async (c) => {
                try {
                    const lessonsSnap = await getDocs(collection(db, "courses", c.id, "lessons"));
                    return { id: c.id, lessonsCount: lessonsSnap.size };
                } catch (err) {
                    console.warn("Failed to fetch lessons count for course", c.id, err);
                    return { id: c.id, lessonsCount: 0 };
                }
            })
        );

        // Merge counts into courses
        const countsById = counts.reduce((acc, cur) => {
            acc[cur.id] = cur.lessonsCount ?? 0;
            return acc;
        }, {});

        // Final courses with lessonsCount
        const coursesWithCounts = courses.map((c) => ({
            ...c,
            lessonsCount: countsById[c.id] ?? 0,
        }));

        return coursesWithCounts;
    }
    catch (err) {
        console.error("Error in fetching courses.", err);
        return thunkAPI.rejectWithValue(err.message || "Courses could not be fetched");
    }
});

// 2. Get one course + its lessons (sanitized)
const fetchCourseById = createAsyncThunk("courses/fetchById", async (courseId, thunkAPI) => {
    try {
        // fetch course doc
        const courseSnap = await getDoc(doc(db, "courses", courseId));
        if (!courseSnap.exists()) throw new Error("Course not found");

        // sanitize course data
        const course = {
            id: courseSnap.id,
            ...courseSnap.data(),
            createdAt: courseSnap.data().createdAt?.toMillis?.() ?? null,
            updatedAt: courseSnap.data().updatedAt?.toMillis?.() ?? null,
        };
        
        // fetch lessons subcollection ordered by 'order' field
        const lessonsSnap = await getDocs(
            query(collection(db, "courses", courseId, "lessons"), orderBy("order", "asc"))
        );
        
        // sanitize lesson data
        const lessons = lessonsSnap.docs.map((lsn) => ({
            id: lsn.id,
            ...lsn.data(),
            createdAt: lsn.data().createdAt?.toMillis?.() ?? null,
            updatedAt: lsn.data().updatedAt?.toMillis?.() ?? null,
        }));

        // ✅ Debug log
        console.log('🔥 Fetched lessons from Firestore:', lessons);
        console.log('🔥 Lesson count:', lessons.length);
        console.log('🔥 Lesson IDs:', lessons.map(l => l.id));

        return { course, lessons };
    } catch (err) {
        console.error("Error in fetching course by id.", err);
        return thunkAPI.rejectWithValue(err.message);
    }
});

// 3. Create new course (+ optional lessons)
const createCourse = createAsyncThunk("courses/create", async ({ courseId, courseData, lessons = [], instructor }, thunkAPI) => {
    try {
        // authenticate user and user role
        const user = thunkAPI.getState().user?.user ?? null; // reliable getter
        const role = user?.role;
        if (role !== "admin") {
            return thunkAPI.rejectWithValue(
                `Dear ${user?.name || user?.displayName || "User"}, You are not authorized to create a course !!`
            );
        }

        // create course doc and get sanitized result (createCourseDoc returns sanitized)
        const createdCourse = await createCourseDoc(courseId, courseData, instructor);
        const usedCourseId = createdCourse.id;

        // ✅ Deduplicate lessons before creating (safety check)
        const seen = new Set();
        const uniqueLessons = (lessons || []).filter((lsn) => {
            const key = `${(lsn.title || '').trim()}-${(lsn.videoUrl || '').trim()}`;
            if (seen.has(key)) {
                console.warn('⚠️ Thunk: Skipping duplicate lesson:', lsn.title);
                return false;
            }
            seen.add(key);
            return true;
        });
        // debug
        console.log('🔥 Creating lessons in Firestore:', uniqueLessons.length);

        // create lessons as subcollection documents
        for (const lsn of lessons || []) {
            await createLessonDoc(usedCourseId, undefined, lsn);
        }

        return { id: usedCourseId, ...createdCourse };
    } catch (err) {
        console.error("Error in creating course.", err);
        return thunkAPI.rejectWithValue(err.message || "Course could not be created");
    }
});

// 4. Update course + lessons
const updateCourse = createAsyncThunk("courses/update", async ({ courseId, coursePatch = {}, lessonOps = {} }, thunkAPI) => {
    try {
        // authenticate user and user role
        const user = thunkAPI.getState().user?.user ?? null;
        const role = user?.role;
        if (role !== "admin") {
            return thunkAPI.rejectWithValue(
                `Dear ${user?.name || user?.displayName || "User"}, You are not authorized to edit courses !!`
            );
        }
        // helper to update course and perform lesson operations
        await updateCourseWithOps(courseId, coursePatch, lessonOps);
        return { courseId, coursePatch, lessonOps };
    }
    catch (err) {
        console.error("Error in updateCourse:", err);
        return thunkAPI.rejectWithValue(err.message || "Course could not be edited");
    }
});

// 5. Delete course
const deleteCourse = createAsyncThunk("courses/delete", async (courseId, thunkAPI) => {
    try {
        // authenticate user and user role
        const user = thunkAPI.getState().user?.user ?? null;
        const role = user?.role;
        if (role !== "admin") {
            return thunkAPI.rejectWithValue(
                `Dear ${user?.name || user?.displayName || "User"}, You are not authorized to delete courses !!`
            );
        }

        // helper deletes lessons (chunked) then remove course
        await deleteCourseDoc(courseId);
        await deleteDoc(doc(db, "courses", courseId));
        return courseId;
    } catch (err) {
        console.error("Error in deleteCourse:", err);
        return thunkAPI.rejectWithValue(err.message || "Failed to delete course");
    }
});

/* ---------------------------- Slice ----------------------------- */
const CourseSlice = createSlice({
    name: "courses",
    initialState: {
        byId: {},
        allIds: [],
        current: null, // canonical loaded course (with lessons)
        lessons: [], // legacy per-slice lessons (kept for backward compatibility)
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        // fetchCourses
        builder
            .addCase(fetchCourses.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCourses.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                const courses = Array.isArray(action.payload) ? action.payload : [];
                state.byId = {};
                state.allIds = [];
                courses.forEach((course) => {
                    state.byId[course.id] = course;
                    state.allIds.push(course.id);
                });
            })
            .addCase(fetchCourses.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error?.message || "Failed to fetch courses";
            });

        // fetchCourseById
        builder
            .addCase(fetchCourseById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCourseById.fulfilled, (state, action) => {
                const { course, lessons } = action.payload || {};

                if (course) {
                    // ✅ Deduplicate lessons before storing
                    const uniqueLessons = Array.isArray(lessons) ? lessons : [];
                    const seen = new Set();
                    const dedupedLessons = [];

                    for (const lesson of uniqueLessons) {
                        if (!seen.has(lesson.id)) {
                            seen.add(lesson.id);
                            dedupedLessons.push(lesson);
                        }
                    }

                    // ✅ Store course with deduplicated lessons
                    state.current = {
                        ...course,
                        lessons: dedupedLessons
                    };

                    // ✅ Also update byId map (optional, for course list views)
                    state.byId[course.id] = {
                        ...course,
                        lessons: dedupedLessons
                    };

                    // ✅ Ensure course ID is in allIds (no duplicates)
                    if (!state.allIds.includes(course.id)) {
                        state.allIds.push(course.id);
                    }
                } else {
                    state.current = null;
                }

                state.lessons = []; // Clear legacy lessons field
                state.loading = false;
                state.error = null;
            })
            .addCase(fetchCourseById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error?.message || "Failed to fetch course";
            });

        // createCourse
        builder
            .addCase(createCourse.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createCourse.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                // payload should already be sanitized (createdAt/updatedAt in ms)
                state.byId[action.payload.id] = action.payload;
                state.allIds.unshift(action.payload.id);
            })
            .addCase(createCourse.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error?.message || "Failed to create course";
            });

        // updateCourse
        builder
            .addCase(updateCourse.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateCourse.fulfilled, (state, action) => {
                state.loading = false;
                const { courseId, coursePatch } = action.payload || {};
                if (courseId && coursePatch) {
                    state.byId[courseId] = { ...(state.byId[courseId] || {}), ...coursePatch };
                    // also update current if it's the same course
                    if (state.current?.id === courseId) {
                        state.current = { ...(state.current || {}), ...state.byId[courseId] };
                    }
                }
            })
            .addCase(updateCourse.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error?.message || "Failed to update course";
            });

        // deleteCourse
        builder
            .addCase(deleteCourse.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteCourse.fulfilled, (state, action) => {
                state.loading = false;
                const id = action.payload;
                if (id) {
                    delete state.byId[id];
                    state.allIds = state.allIds.filter((x) => x !== id);
                    if (state.current?.id === id) state.current = null;
                }
            })
            .addCase(deleteCourse.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error?.message || "Failed to delete course";
            });
    },
});

// Thunks
export { fetchCourses, fetchCourseById, createCourse, updateCourse, deleteCourse };

// Reducer
export const courseReducer = CourseSlice.reducer;

// Selectors
export const selectCourses = (state) => state.courses;

// I designed my selector to serve both list views and detail views:
// it falls back to byId for lightweight course data, but if the course is loaded in current, it also merges lessons.
// in same slice file (selectors)
export const selectCourseById = (state, id) => {
    // If the current loaded course matches, return it (stable ref)
    if (state.courses.current?.id === id) return state.courses.current;
    // otherwise fall back to lightweight byId map
    return state.courses.byId[id] || null;
};

// selectLessonById: check current.lessons first (canonical), then fallback to per-slice lessons or course.byId
export const selectLessonById = (state, courseId, lessonId) => {
    const current = state.courses.current;
    const lessonsFromCurrent = Array.isArray(current?.lessons) ? current.lessons : [];
    const lessonsFromSlice = Array.isArray(state.courses.lessons) ? state.courses.lessons : [];

    // prefer canonical current.lessons
    let found = lessonsFromCurrent.find((lsn) => lsn.id === lessonId);
    if (found) return found;

    // then fallback to slice-level lessons (legacy)
    found = lessonsFromSlice.find((lsn) => lsn.id === lessonId);
    if (found) return found;

    // last fallback to course.byId's lessons array (if present)
    const course = state.courses.byId[courseId];
    if (course?.lessons) return course.lessons.find((lsn) => lsn.id === lessonId) || null;

    return null;
};
