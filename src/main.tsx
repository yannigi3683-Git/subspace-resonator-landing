import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import PrivacyPolicy from './pages/PrivacyPolicy.tsx';
import AccessibilityStatement from './pages/AccessibilityStatement.tsx';

// MPA served from index.html; dev/preview + Vercel rewrite /privacy and
// /accessibility to this entry (see vite.config.ts and vercel.json).
const path = window.location.pathname.replace(/\/+$/, '');
const Page =
  path === '/privacy' ? PrivacyPolicy
  : path === '/accessibility' ? AccessibilityStatement
  : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
