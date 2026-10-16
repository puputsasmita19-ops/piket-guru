import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept Firebase Auth SDK internal assertion errors in iframe context
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    (
      (typeof event.reason?.message === 'string' && event.reason.message.includes('Pending promise was never set')) ||
      (typeof event.reason === 'string' && event.reason.includes('Pending promise was never set'))
    )
  ) {
    console.warn('[Firebase Auth Suppressed Exception]', event.reason);
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (
    (event.message && event.message.includes('Pending promise was never set'))
  ) {
    console.warn('[Firebase Auth Suppressed Error]', event.message);
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);

