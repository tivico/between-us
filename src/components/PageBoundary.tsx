import { Component } from 'react';
import type { ReactNode } from 'react';
export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section className="flow-page" role="alert"><h1 id="page-heading" tabIndex={-1}>這個頁面暫時沒有載入完成。</h1><p>請確認網路後重新整理。已保存的雙人答案仍在後端，單人預覽的未保存選擇會清除。</p><button className="button primary" onClick={() => location.reload()}>重新整理頁面</button></section> : this.props.children;
  }
}
