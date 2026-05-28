import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'sql.js/dist/sql-wasm.wasm?url': path.resolve(__dirname, 'test/mocks/sql-wasm-url.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/unit/**/*.test.ts', 'test/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 87,
        functions: 82,
        branches: 83,
        statements: 86,
      },
    },
  },
});
