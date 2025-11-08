import { serverTimestamp } from "firebase/firestore";

export const lessonSchema = (lesson = {}) => ({
    order: lesson.order ?? 1,
    title: lesson.title || "Untitled Lesson",
    desc: lesson.desc || "Some description",
    duration: lesson.duration ?? 0, // in minutes/seconds
    videoUrl: lesson.videoUrl || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
});
