import { serverTimestamp } from "firebase/firestore";

export const courseSchema = (course = {}, instructor = "") => ({
    title: course.title || "Untitled Course",
    desc: course.desc || "Some description",
    price: course.price ?? 0, // always number
    thumbnail: course.thumbnail || "",
    instructor: instructor || "",
    published: course.published ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
});