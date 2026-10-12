import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// KaTeX ships its own stylesheet; it must load before the app's rules so the
// project typography does not override the maths layout (fractions, radicals,
// big operators all depend on KaTeX's own display metrics).
import 'katex/dist/katex.min.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
