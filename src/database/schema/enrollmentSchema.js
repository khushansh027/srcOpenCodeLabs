import { serverTimestamp } from "firebase/firestore";

export const enrollmentSchema = (userId = "", courseId = "") => ({
    // link to the student
    userId: userId || "",          
    // link to the course
    courseId: courseId || "",       
    enrolledAt: serverTimestamp(),  
    // lessonId: true/false map
    completedLessons: []
});
