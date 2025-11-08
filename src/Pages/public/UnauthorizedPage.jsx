import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

function UnauthorizedPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#0b0620_0%,#05030b_60%)] text-gray-200 px-6">
            <div className="text-center bg-white/5 backdrop-blur-lg border border-red-500/20 p-10 rounded-2xl shadow-2xl max-w-md w-full">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-red-600/10 rounded-full border border-red-500/30">
                        <ShieldAlert className="w-12 h-12 text-red-400" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-red-400 mb-2 tracking-wide">
                    Access Denied
                </h1>
                <p className="text-gray-400 mb-8 text-sm leading-relaxed">
                    You don’t have permission to view this page.
                    Please contact the administrator or go back to a safe route.
                </p>

                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-lg 
                     bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold 
                     border border-red-500/30 transition-all duration-200"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>
            </div>

            <footer className="mt-10 text-xs text-gray-500/70">
                ⚠️ Unauthorized Access Attempt Logged
            </footer>
        </div>
    );
}

export default UnauthorizedPage;
