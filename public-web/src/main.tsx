import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@lingcoo/frame-ui/toast';
import App from './App';
import { PublicErrorBoundary } from './components/site/SystemStates';
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
