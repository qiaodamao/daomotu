import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'logo.svg'],
      manifest: {
        name: '纸箱纸盒设计工具',
        short_name: '纸箱纸盒设计',
        description: '参数化纸箱/纸盒刀模图在线生成：2D 展开图 + 3D 折叠预览，导出 SVG / DXF / PDF',
        lang: 'zh-CN',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // 导出下载不缓存；运行时按需
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\./,
            handler: 'CacheFirst',
          },
        ],
      },
    }),
  ],
});
