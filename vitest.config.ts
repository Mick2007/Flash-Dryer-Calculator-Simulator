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
    server: {
      deps: {
        // jspdf must be inlined rather than externalised. The generator loads it
        // with a dynamic `await import('jspdf')` while the test imports it
        // statically; if Vite externalises the dependency those two resolve to
        // SEPARATE module instances, so patching the jsPDF prototype in the test
        // would not affect the copy the generator draws with, and every captured
        // string would be empty. Inlining routes both through the same instance.
        inline: ['jspdf'],
      },
    },
  },
});
