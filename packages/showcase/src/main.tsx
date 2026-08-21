import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@partrunner-ai/ui/theme.css';
import '@partrunner-ai/shell/shell.css';
import { ReleaseReviewApp } from './ReleaseReviewApp';

const root = document.getElementById('root');

if (!root) throw new Error('Showcase root element is missing');

createRoot(root).render(
  <StrictMode>
    <ReleaseReviewApp />
  </StrictMode>,
);
