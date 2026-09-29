import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 改成 .json：EdgeOne 对 .webmanifest 只会给 application/octet-stream，
      // 而 .json 实测能拿到 application/json（安卓读清单更稳）。
      manifestFilename: 'manifest.json',
      includeAssets: ['icon.svg', 'logo.svg', 'favicon.ico'],
      manifest: {
        name: '纸箱纸盒设计工具',
        short_name: '纸箱纸盒设计',
        description: '参数化纸箱/纸盒刀模图在线生成：2D 展开图 + 3D 折叠预览，导出 SVG / DXF / PDF',
        lang: 'zh-CN',
        theme_color: '#171717',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          // 安卓"添加到桌面"要的是真实位图：192 给启动器，512 给自适应图标
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // 实色底 + 图形缩进安全区，防止被圆形/方圆形蒙版切掉边角
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico}'],
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
