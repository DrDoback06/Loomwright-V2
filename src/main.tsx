import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
