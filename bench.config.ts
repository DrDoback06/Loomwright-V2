import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('/home/user/Loomwright-V2', import.meta.url)),
  resolve: {
    alias: {
      '@': '/home/user/Loomwright-V2/src',
    },
  },
  test: {
    include: [
      '/tmp/claude-0/-home-user-Loomwright-V2/700e6e5f-dbf0-5dbd-a13a-2b990be279e6/scratchpad/bench2.spec.ts',
    ],
    environment: 'node',
    setupFiles: ['/home/user/Loomwright-V2/tests/unit/setup.ts'],
    testTimeout: 600000,
    hookTimeout: 600000,
  },
});
