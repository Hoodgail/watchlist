import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { OfflineProvider } from './context/OfflineContext';
import { SpoilerProvider } from './context/SpoilerContext';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ToastProvider>
          <OfflineProvider>
            <SpoilerProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </SpoilerProvider>
          </OfflineProvider>
        </ToastProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
