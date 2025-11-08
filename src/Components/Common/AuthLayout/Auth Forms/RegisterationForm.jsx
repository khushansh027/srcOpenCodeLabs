import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { registerUser } from '../../../../ReduxToolKit/Slices/UserSlice.js';
import styles from './Register.module.css';

function RegistrationForm(){
    // hooks & states
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    // where to redirect after login (fallback '/')
    const from = location.state?.from?.pathname || "/";
    // local state for getting form data
    const [formData, setFormData] = useState({name: '', email:'', password:''});
    // local state for error handling
    const [error, setError] = useState('');

    // use hooks ans state to manage form data
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(""); // Clear previous error

        // Validate form data
        if(!formData.name || !formData.email || !formData.password){
            setError("All fields are required");
            return;
        }
        try {
            // unwrap() throws when the thunk rejects
            const user = await dispatch(registerUser(formData)).unwrap();
            // on success, redirect back to attempted page
            navigate(from, { replace: true });
            // reset form
            setFormData({ name: "", email: "", password: "" });
        }
        catch (err) {
            // err could be Error or string — normalize it
            const msg = (err && err.message) || String(err) || "Unexpected Error Occurred !!";
            setError(msg);
        }
        finally {
            setLoading(false);
        }
    };
        
    const handleChange = (e) => {
        setFormData(
            prev => ({
                ...prev,
                [e.target.name]: e.target.value,
            })
        )
    };
        
        
        // form ui
    return (
        <>
            <form className={styles.signupForm} onSubmit={handleSubmit}>
                <h2 className={styles.heading}>REGISTER</h2>
                {/* Name Input */}
                <input
                    type="text"
                    name="name"
                    placeholder="Enter Name"
                    value={formData.name}
                    onChange={handleChange}
                    className={styles.input}
                    required
                /> 
                {/* Email Input */}
                <input
                    type="email"
                    name="email"
                    placeholder="abc@xyz.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={styles.input}
                    required
                /> 
                {/* Password Input */}
                <input
                    type="password"
                    name="password"
                    placeholder="Eg: abcdE@10"
                    value={formData.password}
                    onChange={handleChange}
                    className={styles.input}
                    required
                    /> 
                {/* Error Message Displaying */}
                {error && <p className={styles.error}>{error}</p>}
                <button type="submit">Register</button>
                <br />
                <b className="text-center">
                    <p className="text-slate-200 text-xl font-mono">
                        Already a user? <NavLink className="text-indigo-300" to="/login">Login</NavLink>
                    </p>
                </b>
            </form>

        </>
    )
}

export default RegistrationForm;
