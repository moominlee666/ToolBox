import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    outDir: fileURLToPath(new URL('./assets', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        'pdf-lock': fileURLToPath(new URL('./src/main.js', import.meta.url)),
        'pdf-edit': fileURLToPath(new URL('../pdf-edit/main.js', import.meta.url)),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
});
