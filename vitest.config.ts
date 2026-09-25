/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig gives tests the same Vite setup as Astro (import.meta.env.BASE_URL etc.).
export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
