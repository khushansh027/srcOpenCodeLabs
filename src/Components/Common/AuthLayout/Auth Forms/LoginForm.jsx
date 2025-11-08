import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../../../../ReduxToolKit/Slices/UserSlice.js";
import styles from './Login.module.css';

function LoginForm() {
    // hooks & states
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    // where to redirect after login (fallback '/')
    const from = location.state?.from?.pathname || "/";
    // get login status from redux
    const { status } = useSelector((state) => state.user || {});
    // local state for form data
    const [formData, setFormData] = useState({ email: "", password: "" });
    // local state for error handling
    const [error, setError] = useState("");

    // function to handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!formData.email || !formData.password) {
            setError("Both email and password are required");
            return;
        }
        
        try {
            // Trim inputs before sending
            const payload = { 
                email: formData.email.trim(), 
                password: formData.password 
            };
            
            // We await the dispatch and use .unwrap() to returns the
            // fulfilled value on success or throws the rejected value
            await dispatch(loginUser(payload)).unwrap(); 
            
            // This code runs only if the thunk was successful
            // success -> navigate to original attempted page (replace history)
            navigate(from, { replace: true });
            console.log("User logged in successfully");
            
            // Reset form data
            setFormData({ email: "", password: "" });

        } catch (err) {
            // unwrap may throw either Error or plain string; handle both
            const message = (err && err.message) || String(err) || "Login failed. Please try again.";
            setError(message);
            console.error("Login failed:", err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };
    
    return (
        <form className={styles.loginForm} onSubmit={handleSubmit}>
            <h2 className={styles.heading}>LOGIN</h2>

            <input
                type="email"
                name="email"
                placeholder="abc@xyz.com"
                value={formData.email}
                onChange={handleChange}
                className={styles.input}
                required
            />
            <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                className={styles.input}
                required
            />

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Logging in..." : "Login"}
            </button>

            <div style={{ marginTop: 12,  textAlign: "center" }}>
                <p className="text-slate-200 text-lg font-mono">
                    New here?{" "}
                    {/* forward `from` so registration can also return the user */}
                    <NavLink className="text-indigo-300" to="/register" state={{ from }}>
                        Register
                    </NavLink>
                </p>
            </div>
        </form>
    );
}

export default LoginForm;