import { onAuthStateChangedFirebase, auth, subscribeUserDoc } from "./auth.js";
import { clearUser, setLoading, setError, setUser } from "../ReduxToolKit/Slices/UserSlice.js";

// Sync Firebase's login session with Redux
export const authListener = (dispatch) => {
    dispatch(setLoading(true));

    let unsubscribeUserDoc = null;
    let lastSetUserAt = 0; // ✅ Move OUTSIDE the callback

    const unsubscribeAuth = onAuthStateChangedFirebase(auth, async (curUser) => {
        console.log('[authListener] onAuthStateChanged fired. curUser ->', curUser?.uid ?? null);
        
        try {
            if (curUser) {
                // Tear down any old userDoc listener
                if (unsubscribeUserDoc) {
                    console.log('[authListener] tearing down previous userDoc listener');
                    unsubscribeUserDoc();
                    unsubscribeUserDoc = null;
                }

                // ✅ Subscribe to user document changes
                unsubscribeUserDoc = subscribeUserDoc(curUser.uid, (userDoc) => {
                    console.log('[authListener] subscribeUserDoc callback ->', userDoc);
                    
                    if (userDoc) {
                        lastSetUserAt = Date.now(); // ✅ Update timestamp
                        dispatch(setUser(userDoc));
                        console.log('[authListener] setUser ->', userDoc);
                    } else {
                        // Only clear if last setUser was > 1s ago
                        if (Date.now() - lastSetUserAt > 1000) {
                            dispatch(clearUser());
                            console.log('[authListener] userDoc null - dispatched clearUser');
                        } else {
                            console.log('[authListener] skipping quick clear due to recent setUser');
                        }
                    }
                });
            } else {
                // No user logged in
                if (unsubscribeUserDoc) {
                    unsubscribeUserDoc();
                    unsubscribeUserDoc = null;
                }
                dispatch(clearUser());
                console.log('[authListener] no curUser — dispatched clearUser');
            }
        } catch (err) {
            console.error('[authListener] error', err);
            dispatch(setError(err.message || "Auth listener failed"));
        } finally {
            dispatch(setLoading(false));
        }
    });

    // Cleanup function
    return () => {
        console.log('[authListener] cleaning up listeners');
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        unsubscribeAuth();
    };
};