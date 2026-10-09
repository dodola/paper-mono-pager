import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const lib = path.resolve(__dirname, '../../packages/paper-mono-pager/src');

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // 通过源码接入组件库：无需先构建，改动即时热更新
  resolve: {
    alias: [
      { find: 'paper-mono-pager/style.css', replacement: path.join(lib, 'styles.css') },
      { find: /^paper-mono-pager$/, replacement: path.join(lib, 'index.ts') },
    ],
  },
  server: {
    port: 3000,
    open: false,
  },
});
