/**
 * 路由壳：/ → 落地页（懒加载），/editor → 编辑器，其余重定向到落地页
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Editor from './pages/Editor';

const Landing = lazy(() => import('./pages/Landing'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={null}>
              <Landing />
            </Suspense>
          }
        />
        <Route path="/editor" element={<Editor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
