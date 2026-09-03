import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit layer for pure frontend logic (no DOM, no Tauri runtime).
// Component/IPC tests belong in the layers described in the testing-e2e skill.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
