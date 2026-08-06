import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@lingcoo/frame-ui/toast';

import { App } from './App';
import { ConfirmProvider } from './components/shared/ConfirmProvider';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>,
);
