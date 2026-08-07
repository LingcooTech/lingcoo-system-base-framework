import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@lingcoo/frame-ui/toast';
import { PublicErrorBoundary } from '@lingcoo/frame-web/system-states';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <PublicErrorBoundary>
        <App />
      </PublicErrorBoundary>
    </ToastProvider>
  </StrictMode>,
);
