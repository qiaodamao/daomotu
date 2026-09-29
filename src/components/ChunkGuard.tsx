/**
 * 3D 分包加载保护：线上更新后旧缓存会指向已不存在的 chunk 文件，
 * 动态 import 失败会让整棵 React 树崩掉（页面变白），这里兜住并自动刷新一次。
 */
import { Component, type ReactNode } from 'react';

const KEY = 'chunkReloadAt';
const COOLDOWN = 30000;

type S = { failed: boolean };

export class ChunkGuard extends Component<{ children: ReactNode }, S> {
  state: S = { failed: false };

  static getDerivedStateFromError(): S {
    return { failed: true };
  }

  componentDidCatch(err: Error) {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > COOLDOWN) {
      sessionStorage.setItem(KEY, String(Date.now()));
      location.reload();
      return;
    }
    console.error(err);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="canvas-wrap">
          <div className="chunk-fail">
            <p>3D 模块加载失败，网站可能刚更新过</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                sessionStorage.removeItem(KEY);
                location.reload();
              }}
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
