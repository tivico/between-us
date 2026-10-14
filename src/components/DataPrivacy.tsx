import { retentionDays } from '../domain/retention';

export const retentionNote = `新回合自建立起保存 ${retentionDays} 天；既有未設定期限的回合先保留。`;
export function DataPrivacy() {
  return <div className="flow-page"><p className="eyebrow">YOUR DATA, YOUR CHOICE</p><h1 id="page-heading" tabIndex={-1}>資料保存與你的選擇。</h1>
    <p className="flow-intro">免會員，以每輪私人返回連結識別本人。請把自己的連結保留給自己。</p>
    <section className="preview-notice"><h2>保存什麼、保存多久？</h2><p>後端保存暱稱、題目與規則快照、願意分享的選項、建立與提交時間，以及憑證雜湊。原始私人憑證不存進資料庫；私人答案不送外部 AI。</p><p>{retentionNote}加入、續答或更換連結不延長期限，回合頁會顯示到期日。到期即停止存取，每日清理從運行資料庫移除兩人的回合資料。</p></section>
    <section className="preview-notice"><h2>何時看得到對方的答案？</h2><p>只有本輪參與者，而且雙方都提交，才解鎖共同結果。每個活動在開始前列出分享內容；可選「暫不分享」的題目會以未分享狀態取代目前選項。</p></section>
    <section className="preview-notice"><h2>服務維護會記錄什麼？</h2><p>維運日誌只記操作種類、狀態碼、耗時及隨機服務代碼，不記答案、暱稱、私人網址或憑證。建立頻率保護會短期使用來源網路的雜湊識別值；不以它解讀你們的答案或關係。</p><p>出錯時可以提供畫面上的服務代碼，請保留自己的私人返回連結，不必提供答案。</p></section>
    <section className="preview-notice"><h2>刪除答案並退出</h2><p>在私人回合頁展開「管理這一輪」，確認後刪除本人答案與暱稱，停止本輪共同結果並撤銷邀請。對方不能再透過網站取得你的答案，仍可在保存期限內查看或刪除自己的答案。本輪不能恢復或重新加入；想再探索可另開一輪。</p><p>這會移除運行資料庫中的本人答案，但不能收回對方先前看過、截圖或另存的內容，也不代表立即清除平台備份及復原副本。</p></section>
    <section className="preview-notice"><h2>連結外流與遺失</h2><p>持有私人返回連結的人可以使用你的身份開啟本輪。若你仍可返回，可在「管理這一輪」更換連結；舊私人連結立即失效。發起者更換時，舊邀請也會失效，尚未加入的對方需收到新邀請；已加入者的私人連結不變。</p><p>目前沒有帳號或身份驗證找回。若私人連結與此裝置入口都遺失，無法自動找回；網站不會用暱稱把私人答案交給他人。</p></section>
    <section className="preview-notice"><h2>此裝置的最近紀錄</h2><p>此瀏覽器只保存最近 20 個返回入口，入口包含存取權，但不保存答案。共用此瀏覽器的人也能開啟。移除入口不會刪除後端答案；要刪除答案請先返回該回合操作。</p></section>
    <a className="button secondary" href="#/">回到主題館 →</a>
  </div>;
}
