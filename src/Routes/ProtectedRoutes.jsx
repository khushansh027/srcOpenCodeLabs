import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { userSelector } from "../ReduxToolKit/Slices/UserSlice.js";
import { useEffect, useState } from "react";

// Fallback while checking auth status
function LoadingFallback() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading...</p>
            </div>
        </div>
    );
}

/** ProtectedRoutes
    - children: element(s) to render when allowed
    - allowedRoles: optional array of roles (e.g. ['admin'] or ['student','admin'])
 */
export default function ProtectedRoutes({ children, allowedRoles = [] }) {
    const sliceState = useSelector((state) => state.user);
    const currentUser = useSelector(userSelector);
    const location = useLocation();
    
    // ✅ Add local loading state to prevent premature redirects
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        // Wait for initial auth check to complete
        if (!sliceState?.isLoading && sliceState?.status !== 'loading') {
            // Give it a small delay to ensure Firebase listener has fired
            const timer = setTimeout(() => {
                setIsCheckingAuth(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [sliceState?.isLoading, sliceState?.status]);

    // ✅ Show loading while checking auth OR during initial mount
    if (isCheckingAuth || sliceState?.isLoading || sliceState?.status === 'loading') {
        console.log('[ProtectedRoutes] Showing loading...', {
            isCheckingAuth,
            isLoading: sliceState?.isLoading,
            status: sliceState?.status,
            hasUser: !!currentUser
        });
        return <LoadingFallback />;
    }

    // If not a user, redirect to login page
    if (!currentUser) {
        console.log('[ProtectedRoutes] No user, redirecting to login');
        return <Navigate to='/login' state={{ from: location }} replace />;
    }

    // Check user role
    const userRole = currentUser?.role || "student";

    // If user authenticated but not authorized for this route
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        if (!allowedRoles.includes(userRole)) {
            console.log('[ProtectedRoutes] User role not allowed:', { userRole, allowedRoles });
            return <Navigate to="/unauthorized" replace />;
        }
    }

    console.log('[ProtectedRoutes] Rendering protected content for user:', currentUser?.uid);
    return children;
}