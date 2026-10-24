import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { installR60BrowserDiagnostics } from './services/monitoring/r60BrowserDiagnostics'; // R60-CLIENT-DIAGNOSTICS
import './index.css';
import './modern-soft.css';
import './dashboard-compact-r46.css';

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

installR60BrowserDiagnostics();

createRoot(document.getElementById('root')!).render(<App />);

