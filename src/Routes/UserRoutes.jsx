import { Route, Outlet, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { userSelector } from "../ReduxToolKit/Slices/UserSlice.js";

// Public pages 
  import ProtectedRoutes from "./ProtectedRoutes.jsx";
  import Layout from "../Components/Common/AuthLayout/Layout Nav/Layout.jsx";
  import LoginPage from '../Pages/public/LoginPage.jsx';
  import RegisterPage from '../Pages/public/RegistrationPage.jsx';
  import AboutUsPage from '../Pages/public/AboutUsPage.jsx';
  import CourseDetailsPage from '../Pages/public/CourseDetailsPage.jsx';
  import CommonCourseListPage from "../Pages/public/CourseListPage.jsx";
  import UnauthorizedPage from "../Pages/public/UnauthorizedPage.jsx";


// Student (protected) pages
  import StudentDashboardPage from "../Pages/student/StudentDashboardPage.jsx";
  import StudentProfilePage from '../Pages/student/StudentProfilePage.jsx';
  import StudentEnrolledCoursesPage from "../Pages/student/StudentEnrolledCoursesPage.jsx";
  import LessonPlayerPage from '../Pages/student/LessonPlayerPage.jsx';

// Admin pages (protected admin)
  import AdminDashboardPage from '../Pages/admin/AdminDashboardPage.jsx';
  import AdminCoursesListPage from '../Pages/admin/AdminCoursesListPage.jsx';
  import AdminCourseFormPage from '../Pages/admin/AdminCourseFormPage.jsx';
import ContactUsPage from "../Pages/public/ContactUsPage.jsx";


// Root redirect component
function RootRedirect() {
  const user = useSelector(userSelector);
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role === "admin") return <Navigate to="/admin" replace />;
    
  return <Navigate to="/student/dashboard" replace />;
}

// StudentLayout: protects student subtree
function StudentLayout() {
  return (
    <ProtectedRoutes allowedRoles={["student"]}>
      <Outlet />
    </ProtectedRoutes>
  );
}

// AdminLayout: protects admin subtree
function AdminLayout() {
  return (
    <ProtectedRoutes allowedRoles={["admin"]}>
      <Outlet />
    </ProtectedRoutes>
  );
}

export const getRouteElements = () => {
  return(
    <Route path="/" element={<Layout />}>
      {/* Root Redirectory */}
      <Route index element={<RootRedirect />} />
      {/* Public routes */}
      <Route path="register" element={<RegisterPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="about-us" element={<AboutUsPage />} />
      <Route path="contact-us" element={<ContactUsPage />} />
      <Route path="courses" element={<CommonCourseListPage />} />

      {/* Course detail + nested lesson player */}
      <Route path="courses/:courseId" element={<CourseDetailsPage />} />
        {/* ✅ Wrap lesson player in protection */}
        <Route
          path="courses/:courseId/lessons/:lessonId" 
          element={
            <ProtectedRoutes allowedRoles={["student", "admin"]}>
              <LessonPlayerPage />
            </ProtectedRoutes>
          } 
        />

      {/* Student routes */}
      <Route path="student" element={<StudentLayout />}>
        <Route index element={<StudentDashboardPage />} />
        <Route path="dashboard" element={<StudentDashboardPage />} />
        <Route path="my-courses" element={<StudentEnrolledCoursesPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
      </Route>

      {/* Admin routes */}
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="courses" element={<AdminCoursesListPage />} />
        <Route
          path="courses/new"
          element={<AdminCourseFormPage mode="create" />}
        />
        <Route
          path="courses/edit/:courseId"
          element={<AdminCourseFormPage mode="edit" />}
        />
      </Route>

      {/* Unauthorized */}
      <Route path="unauthorized" element={<UnauthorizedPage />} />
    </Route>    
  )
};
