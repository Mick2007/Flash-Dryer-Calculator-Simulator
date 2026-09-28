import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Test configuration is kept separate from vite.config.ts so the production build
// is not affected by test-only settings.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Node is the default because the calculation engine, DXF and PDF modules are
    // all pure TypeScript with no DOM dependency. Component tests opt in per-file
    // with a `// @vitest-environment jsdom` pragma.
    globals: false,
  },
});
