import { createClient } from '@supabase/supabase-js';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ADD THESE LOGS:
console.log('🔍 Supabase Config:');
console.log('  URL:', supabaseUrl);
console.log('  Key exists:', !!supabaseAnonKey);
console.log('  Key length:', supabaseAnonKey?.length);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env file');
}

// export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
//     accessToken: async () => {
//         try {
//             const auth = getAuth();

//             // Wait for Firebase to initialize the current user
//             await new Promise((resolve) => {
//                 const unsub = onAuthStateChanged(auth, (user) => {
//                     unsub();
//                     resolve(user);
//                 });
//             });

//             const user = auth.currentUser;
//             if (!user) return null;

//             // 🚀 Force-refresh the ID token so the custom claim (role=admin) is included
//             const freshToken = await user.getIdToken(true);
//             console.log("🔑 Fresh Firebase token fetched with custom claims.");
//             return freshToken;
//         } catch (err) {
//             console.warn("⚠️ Could not refresh Firebase token:", err);
//             return null;
//         }
//     },
// });

export const supabase = createClient(supabaseUrl, supabaseAnonKey);