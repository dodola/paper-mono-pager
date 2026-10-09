import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    cssCodeSplit: false,
    // 纹理图以 data URL 内联进产物，使用方无需额外配置静态资源
    assetsInlineLimit: 1024 * 1024,
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^three($|\/)/, /^lucide-react($|\/)/],
    },
  },
});
