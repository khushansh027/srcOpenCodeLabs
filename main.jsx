import { StrictMode } from 'react'
import { Provider } from 'react-redux'
import { createRoot } from 'react-dom/client'

import store from './src/ReduxToolKit/Store/store.js'
import {ToastProvider} from './src/middleware/ToastProvider.jsx'
import App from './App.jsx'

import './index.css'



createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Provider>
  </StrictMode>
);