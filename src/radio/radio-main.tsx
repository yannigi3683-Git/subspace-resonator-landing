import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '../index.css';
import './radio.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import RadioApp from './RadioApp.tsx';
import { ErrorBoundary } from './ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RadioApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
