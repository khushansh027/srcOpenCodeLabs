import axios from "axios";
import { getAuth } from "firebase/auth";

// declare base URL for all API request
const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || "/api",
});

// axios middleware that runs before every request
axiosClient.interceptors.request.use(async (config) => {
    // if using Firebase ID tokens:
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
        // unique jwt token 
        const token = await user.getIdToken();
        // add token in header config header
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }
    return config;
});

export default axiosClient;