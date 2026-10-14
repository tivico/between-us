import { useRef, useState } from 'react';
import type { RoundStatus } from '../domain/round';
import { api, createPrivateToken, messageOf } from '../lib/api';
import { forgetRound, rememberRound, roundPath, absoluteLink } from '../lib/history';

export function RoundManagement({ id, token, round, disabled, saveFailed, settle, onBusy }: { id: string; token: string; round: RoundStatus; disabled: boolean; saveFailed: boolean; settle: (action: 'rotate' | 'withdraw') => Promise<void>; onBusy: (value: boolean) => void }) {
  const [action, setAction] = useState<'rotate' | 'withdraw' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replacement, setReplacement] = useState('');
  const [rotationConfirmed, setRotationConfirmed] = useState(false);
  const nextToken = useRef<string | null>(null);
  async function execute() {
    if (!action || busy || disabled || !confirmed) return;
    setBusy(true); onBusy(true); setError('');
    try {
      await settle(action);
      if (action === 'rotate') {
        nextToken.current ??= createPrivateToken();
        const path = roundPath(id, nextToken.current);
        setReplacement(absoluteLink(path));
        // 先保留待確認入口，回應遺失／重整時仍能嘗試新連結；不移除舊入口。
        rememberRound({ id, token: nextToken.current, title: `${round.quiz.title}（連結更換待確認）`, nickname: round.own.nickname, createdAt: round.createdAt });
        await api(`/rounds/${id}/rotate`, { method: 'POST', token, body: { privateToken: nextToken.current } });
        setRotationConfirmed(true);
        // 先在畫面保留新入口；瀏覽器索引失敗時也能帶走新連結。
        setReplacement(absoluteLink(path));
        rememberRound({ id, token: nextToken.current, title: round.quiz.title, nickname: round.own.nickname, createdAt: round.createdAt });
        try { forgetRound(id, token); } catch { /* 舊入口已由後端撤銷。 */ }
        location.replace(absoluteLink(path));
      } else {
        await api(`/rounds/${id}/withdraw`, { method: 'POST', token, body: { confirm: 'withdraw' } });
        try { forgetRound(id, token); } catch { /* 退出仍已完成。 */ }
        location.replace(absoluteLink('#/history'));
      }
    } catch (failure) { setError(messageOf(failure)); }
    finally { setBusy(false); onBusy(false); }
  }
  return <details className="round-management"><summary>管理這一輪：保存期限、連結與退出</summary><h2>你的資料選擇</h2><p>{round.expiresAt ? `本輪保存到 ${new Intl.DateTimeFormat('zh-TW', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(new Date(round.expiresAt))}，加入或續答不延長期限。` : '這是既有未設定期限的回合，目前保留，沒有回溯自動刪除。'}</p><p><a href="#/privacy">閱讀資料保存與分享說明 →</a></p>
    <div className="demo-actions"><button className="button secondary" disabled={disabled || busy || saveFailed} onClick={() => { setAction('rotate'); setConfirmed(false); setError(''); }}>更換私人返回連結</button><button className="button secondary" disabled={disabled || busy} onClick={() => { setAction('withdraw'); setConfirmed(false); setError(''); }}>刪除本人答案並退出</button></div>
    {action && <div className="management-confirm"><h3>{action === 'rotate' ? '讓舊連結失效' : '確認刪除本人答案並退出'}</h3><p>{action === 'rotate' ? '更換後請保留新私人連結。發起者的舊邀請也會失效；尚未加入的對方需要新邀請。' : '你的答案與暱稱會從運行資料庫移除，共同結果關閉，邀請失效。對方保留自己的答案。本輪不能復原或重新加入，也無法收回先前的截圖或清除平台備份。'}</p><label className="consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} /><span>{action === 'rotate' ? '我理解舊連結失效，會保留新連結。' : '我理解本輪無法復原，確認刪除本人答案並退出。'}</span></label><div className="demo-actions"><button className="button secondary" disabled={busy} onClick={() => setAction(null)}>取消</button><button className="button primary" disabled={!confirmed || disabled || busy} onClick={() => void execute()}>{busy ? '正在處理…' : action === 'rotate' ? '確認更換連結' : '確認刪除並退出'}</button></div></div>}
    {error && <p className="flow-error" role="alert">{error}</p>}{replacement && <p role="status">{rotationConfirmed ? '新連結已建立，請保留：' : '更換尚待確認；若服務回應中斷，可重試或嘗試這個預留入口：'}<a href={replacement}>開啟新的私人返回連結</a></p>}
  </details>;
}
