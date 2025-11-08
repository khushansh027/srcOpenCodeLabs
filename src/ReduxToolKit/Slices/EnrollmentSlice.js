import {query, where, doc, setDoc, updateDoc, addDoc, collection, getDocs, deleteDoc, arrayUnion, serverTimestamp} from "firebase/firestore";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../database/firebaseInit.js";
import { enrollmentSchema } from "../../database/schema/enrollmentSchema.js";

// Helper function to normalize Firestore timestamps
const normalizeEnrollment = (enrollment) => {
    const normalized = { ...enrollment };
    
    // Convert Firestore Timestamps to milliseconds
    if (normalized.enrolledAt?.toMillis) {
        normalized.enrolledAt = normalized.enrolledAt.toMillis();
    }
    if (normalized.updatedAt?.toMillis) {
        normalized.updatedAt = normalized.updatedAt.toMillis();
    }
    
    return normalized;
};

/* ---------------------------------------Async thunks--------------------------------------- */
const fetchEnrolledCourses = createAsyncThunk("enrollment/fetchByUser", async (_, thunkAPI) => {
    
    const state = thunkAPI.getState();
    const user = state.user.user;
    
    try{
        // authentication
        if (user?.role !== "student") {
            return thunkAPI.rejectWithValue("Only students can fetch enrollments");
        }
        const uid = user?.uid;
        if (!uid) return thunkAPI.rejectWithValue("User not found. Please login again.");

        // firestore query
        const colRef = collection(db, "enrollments");
        const q = query(colRef, where("userId", "==", uid));
        const querySnapshot = await getDocs(q);
        
        // ✅ Map + normalize timestamps
        const enrolledCourses = querySnapshot.docs.map(enCourse => 
            normalizeEnrollment({
                id: enCourse.id,
                ...enCourse.data()
            })
        );

        return {
            allIds: enrolledCourses.map(c => c.id),
            byId: enrolledCourses.reduce((acc, c) => {
                acc[c.id] = c;
                return acc;
            }, {}),
            count: enrolledCourses.length,
        };  
    }
    catch(err){
        console.log("Error in fetching student's enrolled course.", err);
        return thunkAPI.rejectWithValue(err.message || "Enrolled Course by UserId could not be fetched");
    }
});

// Fetch user's enrollment for a specific course
export const fetchEnrollmentForCourse = createAsyncThunk(
    "enrollment/fetchForCourse",
    async ({ userId, courseId }, thunkAPI) => {
        try {
            if (!userId || !courseId) return thunkAPI.rejectWithValue("Missing userId or courseId");
            console.log('🔍 Fetching enrollment - userId:', userId, 'courseId:', courseId);

            const colRef = collection(db, "enrollments");
            const q = query(
                colRef,
                where("userId", "==", userId),
                where("courseId", "==", courseId)
            );
            
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                console.log('⚠️ No enrollment found - user not enrolled in this course');
                return null;
            }

            const doc = querySnapshot.docs[0];
            const enrollmentData = {
                id: doc.id,
                ...doc.data(),
            };
            console.log('✅ Enrollment found:', enrollmentData);
            // Use your normalizeEnrollment function if you have one
            return normalizeEnrollment ? normalizeEnrollment(enrollmentData) : enrollmentData;

        } catch (err) {
            console.error("❌ Error fetching enrollment:", err);
            return thunkAPI.rejectWithValue(err.message || "Failed to fetch enrollment");
        }
    }
);

export const fetchAllEnrollmentsForUser = createAsyncThunk(
    "enrollment/fetchAllForUser",
    async ({ userId }, thunkAPI) => {
        try {
            if (!userId) {
                return thunkAPI.rejectWithValue("Missing userId");
            }

            console.log('📥 Fetching all enrollments for userId:', userId);

            const colRef = collection(db, "enrollments");
            const q = query(colRef, where("userId", "==", userId));
            
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                console.log('ℹ️ No enrollments found');
                return [];
            }

            const enrollments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            console.log('✅ Found', enrollments.length, 'enrollment(s)');
            
            return enrollments.map(normalizeEnrollment);

        } catch (err) {
            console.error("❌ Error fetching enrollments:", err);
            return thunkAPI.rejectWithValue(err.message || "Failed to fetch enrollments");
        }
    }
);

const enrollInCourse = createAsyncThunk("enrollment/add", async ({ courseId }, thunkAPI) => {
    
    const state = thunkAPI.getState();
    const user = state.user.user;
    
    try{
        console.log('📝 Enrollment attempt:', { user, courseId });
        
        if (!user) {
            return thunkAPI.rejectWithValue("User not found. Please login again.");
        }
        
        if (user?.role !== "student") {
            return thunkAPI.rejectWithValue(
                `Only users registered as students can enrol in courses. Your role: ${user?.role || 'unknown'}`
            );
        }
        
        const uid = user?.uid;
        if (!uid){
            return thunkAPI.rejectWithValue("User ID not found. Please login again or try registering.");
        }

        // Check if already enrolled
        const colRef = collection(db, "enrollments");
        const q = query(
            colRef,
            where("userId", "==", uid),
            where("courseId", "==", courseId),
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return thunkAPI.rejectWithValue(
                `${user?.name || user?.displayName || 'Student'} is already enrolled in this course`
            );
        }
        
        // ✅ Create enrollment with serverTimestamp
        const enrolCourse = enrollmentSchema(uid, courseId);
        const ref = await addDoc(colRef, enrolCourse);
        
        console.log('✅ Enrollment successful:', ref.id);
        
        // ✅ Return normalized data (convert serverTimestamp to Date.now() for Redux)
        return normalizeEnrollment({
            id: ref.id,
            ...enrolCourse,
            enrolledAt: Date.now(), // Use current timestamp since serverTimestamp isn't resolved yet
        });

    }catch(err){
        console.error("❌ Error enrolling student in course:", err);
        return thunkAPI.rejectWithValue(err.message || "Enrollment failed");
    }
});

const unenrollFromCourse = createAsyncThunk("enrollment/remove", async ({ courseId }, thunkAPI) => {
    
    const state = thunkAPI.getState();
    const user = state.user.user;
    
    try{
        if (user?.role !== "student") {
            return thunkAPI.rejectWithValue("Only students can unenroll from courses.");
        }
        const uid = user?.uid;
        if (!uid){
            return thunkAPI.rejectWithValue("User not found. Please login again or try registering.");
        }

        const colRef = collection(db, "enrollments");
        const q = query(
            colRef,
            where("userId", "==", uid),
            where("courseId", "==", courseId),
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return thunkAPI.rejectWithValue("User is not enrolled in this course.");
        }

        await Promise.all(querySnapshot.docs.map(d => deleteDoc(d.ref)));
        return { deletedIds: querySnapshot.docs.map(d => d.id), courseId };

    }catch(err){
        console.log("Error in unenrolling student from an enrolled course.", err);
        return thunkAPI.rejectWithValue(err.message);
    }
});

const markLessonCompletedByEnrollment = createAsyncThunk(
    "enrollment/completeByEnrollmentId",
    async ({ enrollmentId, lessonId }, thunkAPI) => {
        try {
            if (!enrollmentId) return thunkAPI.rejectWithValue("Enrollment id missing");
            
            const ref = doc(db, "enrollments", enrollmentId);
            await updateDoc(ref, {
                completedLessons: arrayUnion(lessonId),
                updatedAt: serverTimestamp(),
            });

            return { enrollmentId, lessonId };
        }
        catch (err) {
            return thunkAPI.rejectWithValue(err.message || "Failed to mark lesson complete");
        }
    }
);

/* -----------------------------------------Slice--------------------------------------------- */
const EnrollmentSlice = createSlice({
    name: "enrollment",
    initialState: {
        allIds: [],
        byId:{},
        loading: false,
        error: null,
        completedLessons: {}
    },
    reducers: {
        resetEnrollments(state) {
            state.allIds = [];
            state.byId = {};
            state.loading = false;
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        //________________________fetchEnrolledCourses__________________________________
        builder
        .addCase(fetchEnrolledCourses.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
        .addCase(fetchEnrolledCourses.fulfilled, (state, action) => {
            state.loading = false;
            state.allIds = action.payload.allIds;
            state.byId = action.payload.byId;
        })
        .addCase(fetchEnrolledCourses.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || action.error.message;
        });
        //________________________fetchEnrollmentForCourse__________________________________
        builder
        .addCase(fetchEnrollmentForCourse.pending, (state) => {
            state.loading = true;
            state.error = null;
            console.log('⏳ Fetching enrollment...');
        })
        .addCase(fetchEnrollmentForCourse.fulfilled, (state, action) => {
            state.loading = false;
            
            const enrollment = action.payload;
            
            if (enrollment) {
                console.log('✅ Storing enrollment in Redux:', enrollment);
                
                // Add to byId
                state.byId[enrollment.id] = enrollment;
                
                // Add to allIds if not already there
                if (!state.allIds.includes(enrollment.id)) {
                    state.allIds.push(enrollment.id);
                }
            } else {
                console.log('ℹ️ No enrollment to store (user not enrolled)');
            }
        })
        .addCase(fetchEnrollmentForCourse.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || action.error.message;
            console.error('❌ Failed to fetch enrollment:', state.error);
        });
        //____________________________enrollInCourse____________________________________
        builder
        .addCase(enrollInCourse.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
        .addCase(enrollInCourse.fulfilled, (state, action) => {
            state.loading = false;
            // add completed lessons to enrollment object
            const newEnrollment = {...action.payload, completedLessons: []};
            // store the enrollment object with its id as key.
            state.byId[newEnrollment.id] = newEnrollment;
            // if enrollment id not already tracked, add it to list         
            if (!state.allIds.includes(newEnrollment.id)) state.allIds.unshift(newEnrollment.id);
        })
        .addCase(enrollInCourse.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || action.error.message;
        });
        //__________________________unenrollFromCourse___________________________________
        builder
        .addCase(unenrollFromCourse.pending, (state) => {
            state.loading = true;
            state.error = null;
        })
        .addCase(unenrollFromCourse.fulfilled, (state, action) => {
            state.loading = false;
            // safely read deletedIds from payload, default to empty array
            const deletedIds = action.payload?.deletedIds || [];
            // for each id fetches delete the corresponding data
            deletedIds.forEach(id => {
                delete state.byId[id];
            });
            // rebuild allIds array, excluding any deletedIds
            state.allIds = state.allIds.filter(id => !deletedIds.includes(id));
        })
        .addCase(unenrollFromCourse.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || action.error.message;
        });
        //_______________________markLessonCompletedByEnrollment___________________________
        builder
        .addCase(markLessonCompletedByEnrollment.pending, (s) => {
            s.loading = true;
            s.error = null;
        })
        .addCase(markLessonCompletedByEnrollment.fulfilled, (s, a) => {
            s.loading = false;

            // store the returned Ids from payload
            const { enrollmentId, lessonId } = a.payload || {}; 
            // If either id is missing, return.
            if (!enrollmentId || !lessonId) return; 

            // fetch the enrollement object by id
            const enrol = s.byId[enrollmentId]; 
            // return if object doesnt exist
            if (!enrol) return; 

            // Ensure the completedLessons array exists so we can push into it.
            enrol.completedLessons = enrol.completedLessons || []; 
            // Add the lessonId only once — avoid duplicate entries.
            if (!enrol.completedLessons.includes(lessonId)) enrol.completedLessons.push(lessonId); 
        })
        .addCase(markLessonCompletedByEnrollment.rejected, (s, a) => {
            s.loading = false;
            s.error = a.payload || a.error.message;
        })
    }
})

// Thunks
    export {fetchEnrolledCourses, enrollInCourse, unenrollFromCourse, markLessonCompletedByEnrollment}
// Reducer
    export const enrollmentReducer = EnrollmentSlice.reducer;
// Selectors
    export const enrollmentSelector = (state) => state.enrollment;

    export const selectEnrollmentByCourseId = (state, courseId) => Object.values(
        state.enrollment.byId || {}
    ).find(
        e => e.courseId === courseId
    ) || null;