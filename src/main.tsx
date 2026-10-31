import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/permanent-marker/400.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register the service worker that makes the app installable and lets it open
// when the store's wifi is being unreliable.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Relative, so it is found inside the site's GitHub Pages folder.
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
