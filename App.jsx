import { useEffect } from "react";
import { authListener } from "./src/auth/authBootstrap.js";
import { createBrowserRouter, createRoutesFromElements, RouterProvider } from "react-router-dom";
import store from './src/ReduxToolKit/Store/store.js';
import { getRouteElements } from './src/Routes/UserRoutes.jsx'

function App() {
  // create router from route elements exported by UserRoutes
  const router = createBrowserRouter(createRoutesFromElements(getRouteElements()));
  
  useEffect(() => {
  /* The useEffect hook is used to establish a Firebase authentication listener when app first loads.
    - It synchronizes the user's login session with our Redux state.
    - It auto checks if a user is logged in & dispatches actions to either set user's data or clear state.
    - This id done to ensure UI always reflects the correct authentication status for a seamless user exp. */
    const unsubscribe = authListener(store.dispatch);
    return () => unsubscribe?.();
  }, []);

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
