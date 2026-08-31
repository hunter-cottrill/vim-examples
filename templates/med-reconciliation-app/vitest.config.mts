import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // fileURLToPath, not new URL(...).pathname: pathname percent-encodes, so a
  // project directory containing a space resolves to a path that does not
  // exist and every '@/...' import fails to resolve.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
});
