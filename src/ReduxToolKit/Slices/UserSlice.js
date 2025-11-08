// UserSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { Signup, Login, Logout } from "../../auth/auth.js";
import { fetchEnrolledCourses, enrollInCourse, unenrollFromCourse } from "./EnrollmentSlice.js";

const initialState = {
    user: null,
    status: "idle",    // 'idle' | 'loading' | 'succeeded' | 'failed'
    isLoading: false,
    error: null,
};

// Thunks
export const registerUser = createAsyncThunk(
    "user/register",
    async ({ name, email, password }, thunkAPI) => {
        try {
            const user = await Signup(name, email, password);
            console.log("Registering user: ", name);
            return user;
        } catch (error) {
            console.log("Error in fetching signup details of the user: ", error);
            return thunkAPI.rejectWithValue(error.message || "User could not be registered");
        }
    }
);

export const loginUser = createAsyncThunk(
    "user/login",
    async ({ email, password }, thunkAPI) => {
        try {
            const user = await Login(email, password);
            if (!user || !user.uid) {
                throw new Error("Invalid login response");
            }
            return user;
        } catch (error) {
            console.log("Error in fetching login details of the user: ", error);
            return thunkAPI.rejectWithValue(error.message || "Login attempt failed !!");
        }
    }
);

export const logoutUser = createAsyncThunk("user/logout", async (_, thunkAPI) => {
    try {
        await Logout();
        return true;
    } catch (error) {
        console.log("Error in logging-out the user: ", error);
        return thunkAPI.rejectWithValue(error.message || "Logout attempt failed !!");
    }
});

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        clearUser(state) {
            state.user = null;
            state.status = "idle";
            state.error = null;
            state.isLoading = false;
        },
        setLoading(state, action) {
            state.isLoading = !!action.payload;
        },
        setError(state, action) {
            state.error = action.payload;
        },
        setUser(state, action) {
            // store a reference to payload (if exists)
            const payload = action.payload || null;
            // debug
            console.log("🔄 setUser payload:", action.payload);

            // preserve role if payload doesn't include it
            if (payload) {
                const currentRole = state.user?.role;
                const role = payload.role ?? currentRole ?? "student";

                state.user = { ...payload, role };
            } else {
                state.user = null;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            // --- Signup ---
            .addCase(registerUser.pending, (state) => {
                state.status = "loading";
                state.error = null;
                state.isLoading = true;
            })
            .addCase(registerUser.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload || null;
                state.error = null;
                state.isLoading = false;
            })
            .addCase(registerUser.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error?.message || "Register failed";
                state.isLoading = false;
            })

            // --- Login ---
            .addCase(loginUser.pending, (state) => {
                state.status = "loading";
                state.error = null;
                state.isLoading = true;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.user = action.payload; // store user data
                state.error = null;
                state.isLoading = false;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error?.message || "Login failed";
                state.isLoading = false;
            })

            // --- Logout ---
            .addCase(logoutUser.pending, (state) => {
                state.status = "loading";
                state.isLoading = true;
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.status = "succeeded";
                state.user = null;
                state.error = null;
                state.isLoading = false;
            })
            .addCase(logoutUser.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error?.message || "Logout failed";
                state.isLoading = false;
            })
            // --- enrollment -> user sync ---
            .addCase(fetchEnrolledCourses.fulfilled, (state, action) => {
                // set user's enrollmentCount from fetch payload (safe fallback)
                const count = action.payload?.count ?? (Array.isArray(action.payload?.allIds) ? action.payload.allIds.length : 0);
                if (!state.user) return; // nothing to update when no user in store
                state.user = { ...state.user, enrollmentCount: count };
            })
            .addCase(enrollInCourse.fulfilled, (state, action) => {
                // increment local enrollmentCount when enroll succeeds
                if (!state.user) return;
                const current = Number(state.user.enrollmentCount || 0);
                state.user = { ...state.user, enrollmentCount: current + 1 };
            })
            .addCase(unenrollFromCourse.fulfilled, (state, action) => {
                // decrement local enrollmentCount when unenroll succeeds
                if (!state.user) return;
                const deleted = action.payload?.deletedIds || [];
                const current = Number(state.user.enrollmentCount || 0);
                const next = Math.max(0, current - deleted.length);
                state.user = { ...state.user, enrollmentCount: next };
            });
    },
});

// actions
export const { clearUser, setLoading, setError, setUser } = userSlice.actions;
// reducer
export const userReducer = userSlice.reducer;
// selector
export const userSelector = (state) => state.user.user;
