// setup store
import { configureStore } from '@reduxjs/toolkit';
import { userReducer } from '../Slices/UserSlice.js';
import { courseReducer } from '../Slices/CourseAndLessons/CourseSlice.js';
import { enrollmentReducer } from '../Slices/EnrollmentSlice.js';

const store = configureStore({
    reducer: {
        user: userReducer,
        courses: courseReducer,
        enrollment: enrollmentReducer
    },
});
console.log('*debug* store.getState() after configureStore =>', store.getState());
export default store;