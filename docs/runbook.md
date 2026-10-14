# 維護與除錯

## 0.15.1 發布前時間修正

2026-10-14持有人要求「push+部署」。發布QA檢出created_at與expires_at分別讀時鐘可能差幾毫秒；Node／D1建立時改用已保存的建立時間作180天基準。只有新回合受此修正，既有期限、原題庫、分析與快照不改，無新增migration；首次生命週期發布仍必須先套0002。160項測試與本機check-lifecycle通過，公開發布結果另記下方；此段不是已部署證明。

資料流：`create`一次讀時鐘→保存`created_at`→`expiryFrom(Date.parse(created_at))`→固定`expires_at`。若日後調整天數，改`src/domain/retention.ts`，兩種store仍以同一建立時間計算，不在status或續答重新延長。檢查用自建QA的status相減，不能改既有使用者的expires_at來做測試。

## 0.15 來源核對、維運與首頁載入

2026-10-14：持有人同意改善6–7。本節補充0.14的生命週期，舊版本段落保留發布證據，產品現況以README、product、architecture及本節／0.14為準。本機0.15.0，尚未push／deploy；公開最後確認0.13.0，0002 remote migration未套用。健康監測workflow、Worker限流、日誌與維修開關都是待發布設定，不能把本機驗證當成公開已啟用。

### 已核對與保留疑點

已重新核對本機保留的PVQ-RR繁中／英文原件SHA256，與候選來源紀錄相符；q49繁中「永不被別人指出錯誤」與英文「never to be humiliated」確有措辭差異。作者庫實際列有Taiwan附件，但本次依頁面實際連結讀取得到403，未取得附件，也未完成翻譯專家或真實使用者理解核對。詳見`docs/quizzes/core-values-pvqrr.md`的2026-10-14稽核。本次只更新來源說明，題幹、候選JSON、工具版、計分及face敘事排除均保留；不以工程核對宣稱量表效度或改寫許可。

### API健康、錯誤代碼與限流

`server/operations.mjs`共用網站版本、固定操作分類、requestId與日誌欄位。`server/http.mjs`及`cloudflare/worker.mjs`每個API回應帶`X-Request-ID`；前端`src/lib/api.ts`只在伺服器異常時把它顯示為服務代碼，方便不用提供私人返回連結就能對照log。

```text
API入口 → 維修開關 → health 或原路由
POST /api/rounds → 來源網路短期雜湊 → 建立限流 → 原store建立snapshot與期限
其餘路由 → 原授權／到期／退出檢查 → 原store → 回應＋X-Request-ID
回應完成 → api log {requestId,operation,status,code,elapsedMs}
每日到期清理 → retention_cleanup log {outcome,removed}
```

日誌不收body、URL、Authorization、token、回合ID、IP、暱稱、答案或SQL錯誤物件。這是本程式的日誌政策，不保證Cloudflare／網路服務商沒有自己的流量紀錄。`wrangler.jsonc`關閉自動invocation logs，保留自訂白名單log；設定依[Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)。不要為了除錯加入`console.log(request)`或`console.error(error)`。

`GET /api/health`以`SELECT … LIMIT 0`確認生命週期欄位，成功回`{ok:true,mode,version,schema:2}`；只核對結構，不取私人資料。schema:2表示本程式的欄位契約，D1仍由migration紀錄管理，不等於D1的PRAGMA user_version。缺欄位／DB錯誤回503 `READINESS_FAILED`，Worker缺限流binding亦503；維修時全部API回503 `MAINTENANCE`。本機Node環境`API_MAINTENANCE=true`需重啟；Worker vars同名需發布才能生效。它不能遠端關閉仍在跑的舊Worker。

建立保護預設每來源網路60秒30次，429附`Retry-After:60`。Node只用socket來源IP，忽略使用者可偽造的X-Forwarded-For；反向代理部署可能把多人算同來源，先調整代理／部署設計，不能直接信任任意header。Worker用Cloudflare提供的CF-Connecting-IP作雜湊key。SHA256不是匿名保證，只是短期計數key，既不寫入資料庫也不打印。共享網路可能一起碰到限制。只限制建立，既有回合的存答、提交、結果、退出與更換入口仍可用；這是突發防護，不是完整防濫用系統。Cloudflare原生計數在各地機房各自運作、非精確全球配額，限制見[Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。

### 公開健康監測

`scripts/check-site-health.mjs`只GET健康、首頁HTML及同來源build資產，檢查HTTP／Content-Type；不建立回合、不讀私人連結、不帶憑證。失敗最多重試三次，log只有固定訊息；不能把私人返回網址當檢查參數。

```powershell
npm run health:check -- https://between-us.forest-between-us.workers.dev/
```

本次公開唯讀檢查成功，舊公開health無version，輸出`version=not-reported`。`.github/workflows/health.yml`推到default branch後每小時UTC第23分執行，也可手動觸發。通知由GitHub帳號／repository通知設定決定，本次沒有代為設定通知。schedule可能延遲或被平台停用，不能當即時SLA；見[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。它驗證可用性，沒有驗證真實使用者的雙人資料或每日刪除是否完成。

### 本機加密備份與隔離還原

`server/backup.mjs`用Node SQLite一致性backup，包含已提交WAL，再用scrypt衍生密鑰及AES-256-GCM加密／驗證完整性；CLI在`scripts/backup-sqlite.mjs`。技術依[Node SQLite backup](https://nodejs.org/api/sqlite.html)與[Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)。只接受schema1／2；執行integrity及外鍵檢查。`.bubak`是加密JSON封套，包含密文，不能當成一般SQLite直接開。

密語至少16字元，由密碼管理器保存，**不要寫進命令參數、.env、Git、issue或VITE_**。下例PowerShell 7隱藏輸入，只暫放process環境。路徑用自己可信任的實體目錄，勿用指向public/dist的junction／symlink；Windows檔案權限須靠Windows ACL與磁碟加密，Node mode不是Windows存取保證。

```powershell
$taskBackupSecret = Read-Host '備份密語' -AsSecureString
$env:BACKUP_PASSPHRASE = ConvertFrom-SecureString $taskBackupSecret -AsPlainText
try {
  node scripts/backup-sqlite.mjs backup --source .local/data/between-us.sqlite --output .local/backups/before-release.bubak
} finally {
  Remove-Item Env:BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
  Remove-Variable taskBackupSecret -ErrorAction SilentlyContinue
}
```

備份不覆寫已存在輸出；先在`.local/backup-stage`短暫建立一致性明文副本，正常完成或失敗清除。程序／電腦非正常中斷可能留副本，應確認沒有備份程序後，以檔案管理員核對該專用目錄再清除；不可批次刪整個`.local`。把加密`.bubak`另存受控的異地位置，與密語分開保存；本版沒有自動異地備份或保管密語。Vite禁止供應.local／SQLite及.bubak，Git忽略備份；不要把復原副本搬進public或dist。

還原只能建立新的`.local`隔離檔，不會替換現用資料庫、不會啟動API。先停止Node API寫入，取得**可信任的最新停寫DB**，密語輸入方式同上，再執行：

```powershell
node scripts/backup-sqlite.mjs restore --source .local/backups/before-release.bubak --output .local/restore/review.sqlite --current-state .local/data/between-us.sqlite --confirm-offline
```

`--confirm-offline`是維護者明確承諾來源已停寫，程式不能替你保證。流程：解密驗證→讀最新安全狀態→隔離還原→依最新snapshot／expires_at／邀請與token雜湊／withdrawn_at校正→清除已退出答案與已到期／已刪回合→檢查完整性。它不讀最新答案來補洞。備份後的新回合不能憑空復原；新加入者只保留最新身份狀態、答案為空；備份後填答可能遺失。原舊返回憑證保持撤銷。測試已驗證更換入口、退出、到期／刪除、WAL、錯密語、竄改與拒絕覆寫，**未對真實答案執行備份／還原**。

如果最新可信任狀態一併遺失，本工具拒絕直接恢復舊私人回合，避免復活已刪答案與撤銷連結。密語遺失也無法解密。這是安全與災難回復之間的取捨；本版尚未有獨立撤銷台帳。不要繞過current-state檢查，也不要把檢查通過直接視為可換庫；先對隔離庫以QA資料確認API、狀態與撤銷，再安排維修切換並保留原庫。

### D1還原點與發布順序

公開D1使用平台Time Travel；本次僅執行唯讀`npx wrangler d1 time-travel info between-us --json`確認有還原點，沒有export／restore／migration。bookmark不要貼公開issue。保留窗口依方案，官方free7天／paid30天，本次未核定帳號方案；見[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)。Time Travel是平台復原，不等於另有異地加密備份。

**不能直接把舊D1 bookmark還原成公開庫**：它可能復活已退出答案及原憑證。事故先關閉公開API寫入／讀取，保存最新可信任撤銷與期限狀態，在隔離環境演練及校正後才切換。Node的backup CLI不是D1還原工具，不可套到D1匯出檔並假設相容。沒有最新安全狀態時維持關閉，不能聲稱已安全復原。

未來有發布指令時：檢查原D1身份及可用還原點→確認0002待migration→套用0002→部署0.15 Worker及assets→health readiness→明示QA雙人流程與退出／更換續驗→確認logs／監測排程。維修模式會503而不是放寬權限；修復後再發布false。0.14以下的回復限制仍適用：首次使用退出後不可回退到0.13；遇問題先維修，再發布同樣理解生命週期的修正版。

### 首頁分包與效能驗證

`scripts/generate-catalog.mjs`從原registry／articles生成`src/content/quiz-catalog.json`，只留公開選題摘要；`catalog.ts`讀取。`App.tsx`先載入選題／privacy，主題與雙人流程在`ExplorationPage.tsx`，科普在`LearningPage.tsx`，依route延後下載。React Suspense顯示載入，`PageBoundary.tsx`提供失敗重試；重載可能清除單人暫存，後端已保存答案仍在。題目與研究來源仍來自完整registry，摘要不是第二份正式題庫。

修改題名、題數、topic-guide或文章後執行`npm run catalog:generate`；`catalog:check`會比對產生結果，CI拒絕過期摘要；predev／prebuild也生成。正常修改流程：內容原件→generator→摘要→check→兩種build→畫面驗證；不要直接手改生成JSON。

工程模擬`scripts/serve-performance.mjs`：只供應公開dist資產、不接DB，HTTP gzip、no-store，共享1.6Mbps頻寬及每次150ms延遲，在首頁render到#start-guide後兩幀取readyMs。各版本三次，中位數0.14=1.55秒／0.15=0.89秒（約42%改善），首頁JS傳輸180,377→77,626 bytes（約57%下降）。raw build main248.83KB、探索360.57KB；主題首開仍需額外下載探索分包。記錄在ignored `.local/performance-015.json`。

這是同環境的工程比較，不是實體手機、公開網站、CPU受限或人類可用性測試；外部字型沒有套頻寬模擬。此瀏覽器沒提供FCP／LCP數據，不能據此宣稱Core Web Vitals通過。可重現指令：

```powershell
npm run build:cloudflare
node scripts/serve-performance.mjs dist 5406
```

### 最常見症狀與維護範例

發布生命週期續驗使用`node scripts/check-lifecycle.mjs https://between-us.forest-between-us.workers.dev/`。腳本只新建明示QA，核對網站版／schema／180天、A/B更換、舊邀請及返回失效、重試、摘要實際作答依據與退出後只留對方本人資料；最後QA雙方退出。失敗只報固定phase，不打印token／答案／回合ID，不直接讀寫D1或刪使用者回合。退出已關閉後不能回退0.13。此腳本不是180天排程或舊回合NULL保留的遠端驗證。

本輪驗證：158項測試、一般／Cloudflare建置、Worker dry-run均通過；主題單人預覽、科普全文、雙人結果及分包下載503後的重試提示已實際檢查。畫面實際寬717／1265px；390px設定未生效，不計入手機尺寸驗收。沒有做真實使用者試答或正式災難還原。

1. 首頁可見、API503：先跑health:check，再看MAINTENANCE／READINESS_FAILED、0002欄位、DB與CREATE_RATE_LIMITER binding；不要先讀answers。讀requestId、固定operation與status定位，`npx wrangler tail --format json`的輸出亦勿貼含私人內容的完整平台log。
2. 新建429：等60秒，確認是否共享網路或Node代理把全部人合併；存答／提交應照常。如果要調整為45次，**同改**`server/operations.mjs.creationLimit`與`wrangler.jsonc.ratelimits.simple.limit`，更新此節／測試，再check及build／部署，不改答題API限制。
3. 首頁資產失敗／載入畫面後出現重試：先看health script是哪一層失敗、資產Content-Type、部署是否同一版HTML與chunks。確認不是離線後按重試；不要要求使用者提供私人連結。發布資產不可只替換index，hash分包必須一起上線。
4. BACKUP_DECRYPT_FAILED：核對密語與檔案來源，錯密語／竄改均同樣拒絕；無法靠修改封套或跳過tag補救。DESTINATION_EXISTS改用新的隔離檔名；UNSAFE_BACKUP_DESTINATION移到.local，勿停用Vite保護。
5. 來源措辭疑問：看q49稽核原件與指紋，取得作者庫正式Taiwan附件或適當專家核對後，另擬新版本與證據限制；不能改V1敘事或舊snapshot假裝一直正確。

## 0.14 選題、結果閱讀與資料生命週期

2026-10-14：持有人同意改善1–3，並選擇「新回合180天、既有回合先保留」。本機網站0.14.0；公開仍0.13.0，未推送或部署、未套用remote migration。題幹、題庫工具版、相近度及既有分析V1均不變。以下是現在的操作規則；舊版本段落中的「保存／退出待定」保留為歷史，現況以本節為準。

### 行為與重要檔案

- `src/domain/retention.ts`：建立時固定180×24小時，寫入`rounds.expires_at`。加入、續答、改連結均不延長；既有回合`NULL`先保留，不回溯刪除。到期即拒絕存取，不等清理排程。
- `server/store.mjs`／`cloudflare/store.mjs`：Node／D1均提供`withdraw`與`rotate`。退出清空本人`answers`、暱稱改為「已退出」、清除提交時間並寫`withdrawn_at`，撤銷邀請，阻止共同結果和後續填答。另一方`status.state=closed`只回本人答案，可再退出。保留最少的席位、時間與憑證雜湊以防止重新加入／支持安全重試；不聲稱平台備份或既有截圖立刻清除。
- `rotate`用新憑證雜湊取代本人`token_hash`，原雜湊記在`previous_token_hash`只作同一請求重試證據，不能授權讀取。A更換同時重建邀請雜湊，舊邀請失效；B已加入時其憑證不變。原始新／舊token皆不存資料庫，不打印。
- `src/components/RoundManagement.tsx`：回合下方管理區，先說明影響、勾選確認才送出；連結更換的網路重試使用同一新token，送出前在最近入口先保留「連結更換待確認」的新入口，成功後替換為正常標題並移除舊入口。若瀏覽器索引不可寫，畫面仍顯示預留新連結；離開前自行保留。刪除不受存檔錯誤阻擋；更換前需保存成功。結果輪詢在退出後清除共同畫面，但不能收回使用者已讀或另存的內容。
- `src/components/DataPrivacy.tsx`：`#/privacy`說明保存、分享、退出、備份限制、連結持有者權限、沒有帳號找回，以及最近入口與後端答案的差別。
- `src/content/topic-guide.ts`：首頁六種情境導引、題數、探索深度與預期收穫；沒有實測時間就不估分鐘。新增導引只改這份內容，主題定義仍在原registry。
- `src/domain/result-opening.ts`：Node／D1在解鎖後呼叫固定`buildResultOpeningV1`，只摘取本輪既有分析。`resultOpening.version=1.0.0, origin=reading-layer`，最多三張卡、每張及整體理解有`questionId/slot/prompt/label`證據。本人界線不作一致判定，未分享／特殊狀態不產生聊天卡，未分化不排序。`ResultOpening.tsx`呈現「看見什麼→自行挑一件→四步口頭交流」；完整原報告、分數及答案放在可展開區。聊天選擇只在React記憶體，不保存／同步、不送外部AI。舊報告明示加閱讀層，原快照與算法不改。未來新閱讀規則另加V2與分流，保留V1。

### 實際請求與清理流程

```text
首頁情境導引 → 主題介紹（題數／深度／收穫） → 分享同意 → POST /api/rounds
  → 固定題庫snapshot＋expires_at → 保存／提交／邀請／另一方提交
  → GET /results先授權、期限及退出檢查 → 原主題分析 → buildResultOpeningV1
  → 共用摘要與自選交流 → 展開原完整報告

管理區 → 等待現有存檔佇列 → POST /api/rounds/:id/withdraw {confirm:"withdraw"}
  → 本人答案清除＋withdrawn_at＋invite_hash=NULL → 對方只可讀自己的資料
管理區 → POST /api/rounds/:id/rotate {privateToken:新憑證}
  → 雜湊替換＋A邀請更新 → 保存新入口 → 本人跳到新返回連結

Node啟動及每24小時／Worker每日UTC19:00（台灣翌日03:00）
  → cleanupExpired → 同一交易先刪到期participants，再刪到期rounds
```

D1所有寫入在SQL再次核對token、退出與期限，避免跨await的舊授權覆蓋新狀態；讀取`readView`以batch把授權、回合與兩人資料放同一交易，結果不混讀退出前後。Node用`BEGIN IMMEDIATE`。D1 batch交易依[官方文件](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)，排程設定依[Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)。定期清理失敗也不能讓已到期資料重新可讀。

### Migration 與發布／回復

Node使用schema2，從schema0／1在本機啟動時依新增欄位升級，不覆寫更高`user_version`。不要開啟舊程式讓它寫schema2。D1必須先套用新增的`cloudflare/migrations/0002_lifecycle.sql`再部署；不能改已套用0001或重建原D1。0002只新增欄位／索引，既有expires_at保持NULL，原snapshot／answers保留。

這次未對公開庫操作。日後授權發布時，先完成備份／還原點，核對0002待套用，再依序：

```powershell
npx wrangler d1 migrations list between-us --remote
npx wrangler d1 migrations apply between-us --remote
npm run cloudflare:deploy
```

發布前必須保留舊資料與清除／撤銷狀態的相容性。**首次啟用退出或憑證更換後，不能直接回復0.13**：舊程式沒有檢查withdrawn_at，可能再次提供已關閉回合或接受舊邀請。可回復到同樣支援生命週期的已驗證版本；沒有此版本時先停止API存取，修復後再開放，不能靠還原備份恢復已退出的答案。平台復原副本的保留仍由平台管理，這版不提供即時備份清除承諾。

### 症狀、除錯與自行修改

1. 新頁面仍顯示期限待定：核對正在看的來源／版本；本機前端會熱更新，但Node後端要重啟才讀新程式。只push不會更新公開網站。
2. 管理操作401：舊連結已更換或憑證錯誤；使用新返回連結。回應遺失時用同一新token重試，不能每次生成不同token。不要把私人URL貼到公開issue或log。
3. 410：`ROUND_EXPIRED`是到期、`PARTICIPANT_WITHDRAWN`是本人退出、`ROUND_CLOSED`是另一方退出；清理後找不到權限可能回401。不是要繞過的限制。另一方應從status的closed頁讀本人答案，results不得再開。
4. 操作500或`no such column`：檢查migration是否0002、Node是否schema2；看`/api/health`、DB binding及固定錯誤碼。不要讀／打印私人answers來做健康診斷。
5. 到期還留在運行庫：檢查Cron、scheduled handler與`RETENTION_CLEANUP_FAILED`（Node）；以安全的彙總查詢縮小範圍：`SELECT COUNT(*) FROM rounds WHERE expires_at IS NOT NULL AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now');`。不要輸出任何snapshot／answers／token_hash。測試與cron清理覆蓋的是運行庫，不等於平台備份已消失。
6. 摘要與選項不符：先核對卡片evidence的slot、questionId與本輪snapshot，接著核對原分析及閱讀層分支；不要拿最新registry替換舊回合。內容不足時應無卡片，不補假的共同點。

修改例：若日後核定新回合改365天，修改`retentionDays`與說明、測試的精確邊界；只影響之後建立的expires_at，**不要重算既有日期**。調整選題文案改topic-guide；調整閱讀算法另加版本並保留V1。驗證至少涵蓋陌生人、角色互換、退出後雙方、舊／新連結、到期前後、無期限舊回合、並行保存／退出、特殊答案與快照不追套，再check、兩種build及手機畫面。

工程QA使用獨立記憶體SQLite與Miniflare模擬D1，不讀或刪既有實際答案。交付已通過150項測試、一般／Cloudflare兩種建置、Worker dry-run；測試涵蓋有既有資料的Node／D1 migration、到期精確邊界、退出／連結重試、陌生授權及並行保存／提交／加入。瀏覽器確認六種活動摘要、完整報告展開、自選交流、退出確認及資料頁，390px生活結果無橫向溢出；截圖為明示工程示範。Windows沙箱Vitest暫存讀取ENOENT時在一般本機權限驗證；Wrangler log改寫至忽略的.local後dry-run無錯誤。建置保留JS超過500KB提示（雲端gzip約182KB），尚未量測慢速網路。真人理解／測量／交流效果、實體雙手機、公開migration與Cron執行仍未驗證。

## 0.12 日常三觀探索

2026-10-12 依使用者「直接發佈部署」要求接入八個情境，各有做法／理由／重要程度／接受範圍，共32步。網站0.12.0，日常內容與整理規則1.0.0；入口 `#/topics/daily-values`、`#/start/daily-values`。目前仍為自編探索，研究支持概念而不驗證題目或提案效果，沒有契合數字。

### 檔案與資料流

1. `docs/quizzes/daily-values.json` 是運行內容來源：八情境、四個首選與四個理由、情境條件、聊法、研究來源；MD 留作設計、來源閱讀界線與延伸題紀錄。`src/content/daily-values.ts` 轉成32題與15種非空接受集合。集合ID例如 set-AC只識別勾選組合，沒有分數。
2. 建立／邀請沿用 `/api/rounds` 與 `/api/invitations/claim`，回合保存完整 snapshot。`RoundFlow` 使用 `DailyOptions` 顯示四步、`DailyReview` 按情境確認；私人返回連結沿用既有授權，答案暫存及重試仍有revision競爭保護。
3. `PUT /api/rounds/:id/answers` 在Node／D1驗證選項屬於snapshot後，呼叫 `normalizeDailyAnswers`。任一欄暫不分享／不適用會取代同情境四欄；不是只在前端遮住。重新分享時先清空四欄，四步重新填；未答仍不能提交。
4. `GET /api/rounds/:id/results` 先驗本人與雙方提交，再由snapshot呼叫 `analyzeDailyValues` 回傳 dailyComparison。status／邀請不含對方答案或比較結果。共同安排取明示交集，未知不當空集合；工作題比較A.choice對B.accept、B.choice對A.accept，不把單向接受說成雙向。
5. `DailyResults` 顯示結論、各自明示非常重要的安排與逐題依據，選一項進入四步口頭交流。交流進度只在React state，不存／不同步，不宣稱兩人真的完成對話。未分享不推定理由，完整原選項與研究界線仍能展開。

### 排查與修改

- 主題未出現：先確認頁尾網站版號、重新載入，核對 `quizzes` 包含 daily-values。新主題另加入，不替換57題或遠距；Cloudflare部署不是GitHub push。
- 接受範圍保存失敗：確認是選項白名單中的 set-A／set-AC 等ID，不是任意陣列或選項分數。最後一個勾選取消會保持未答；「沒有能直接接受」要明示選none。
- 四欄突然都變未分享／不適用：這是整組規則。要恢復選擇，重新回答四步；不能從後端找回已取代的舊私人選項。
- 結果反向／說得太多：先核對snapshot.dailyValues與32題ID、本人choice、另一方接受集合、特殊狀態、importance本人歸屬。接受未知不能顯示沒有交集，工作方向不能讀自己的集合。未支援規則版本應拒絕，不能追套最新registry。
- 401先核對私人返回連結，423表示尚未雙方提交，409先重新載入最新revision；不要繞過授權或刪D1資料修測試。
- 修改例：要在旅行題加「一人請客」，先改JSON並核對理由與複選集合生成，新增內容／規則版本與分支；目前V1固定四選項與15集合，不能直接改舊V1而重算舊結果。純CSS修正只升網站修正版。

必要檢查與發布可依序執行 `npm run check`、`npm run build`、`npm run cloudflare:deploy`。發布後用 `node scripts/check-daily-values.mjs https://between-us.forest-between-us.workers.dev/` 檢查完整／整組未分享兩輪工程QA與保護；此腳本會建立標記回合，不讀既有使用者資料、不輸出憑證、不刪資料。健康檢查可用 `Invoke-RestMethod https://between-us.forest-between-us.workers.dev/api/health`。

### 0.12 正式發布與驗證（2026-10-13）

日常功能提交 `1b6aea7`，整合提交 `77f3c7a`；0.12.0 保留原 `v0.11.0` 溝通發布 `4f22fed`，不覆寫標記。兩個主題在同一份 `quizzes`／Node／D1／畫面並存，既有工具與分析版本不因網站升版改變。2026-10-12 的日常工作副本曾部署為 `41c9e5fd-68e0-4fea-952c-8d7a0c2e34ee`；續作核對既有溝通發布後，合併並升0.12，最後Worker版本為 **`42dbb12d-e964-4f78-8d5c-045fdf2257fc`**，不再以日常副本覆蓋溝通入口。

驗證：18檔／98項測試通過，一般／Cloudflare建置通過。公開五套腳本 `check-daily-values`、`check-communication`、`check-cloudflare`、`check-long-distance`、`check-questionnaires` 全部成功，涵蓋新日常完整／整組未分享、方向比較、明示交集、401／423／409與缺答保護，以及既有57題、24題溝通／遠距和八組四題。只新增標記工程QA，不讀既有使用者資料、不輸出憑證、不刪D1。98項工程測試不表示人類理解、測量或交流成效驗證。

畫面：日常獨立A／B、32步、複選、整組未分享／恢復保存、提交等待／解鎖、共同接受／重要差異、四步交流與無Console錯誤已在本機記憶體工程QA驗證，390px手機作答與結果無橫向溢出。整合後公開主題館確認六個主題、日常／溝通均已開放，介紹／32步與24題入口正確；公開日常介紹圖 `.local/daily-values-0.12-live.png` 已保存於忽略目錄，不含私人回合。沒有開啟既有私人結果或實體雙手機驗證。

建置仍有單一JS資產超過500KB的提示（雲端gzip約164KB）；建置成功，但尚未做慢速網路效能量測，若未來載入負擔升高再評估分包，不以提高警告門檻當優化。

沿用原Worker／D1，不需schema migration，不搬動本機答案。需要回復時使用Wrangler deployments rollback回到前一完整已驗證的Worker，保留D1；若已有新版本回合，舊Worker不支援的結果可能暫時無法開啟，應優先修復前進而不回改答案。GitHub同步與CI紀錄在下方補充，GitHub push不觸發Cloudflare正式部署。

GitHub同步完成：main／新 `v0.12.0` 已推送，發布標記指向 `12c13f47c31ec38fb895af5f15b7e1fe22875bc4`；[CI 38328397476](https://github.com/tivico/between-us/actions/runs/38328397476) 對應同一提交，2026-10-13確認 completed/success。原 `v0.11.0` 仍指向溝通提交 `4f22fed`，沒有覆寫。此CI結果針對發布標記；後續補充發布紀錄為純文件提交，不重部署或重標記版本。

## 0.11 溝通探索

2026-10-12 使用者要求直接發布部署24題候選。網站0.11.0、內容候選0.2.0、回合工具0.3.0、描述性分析1.0.0。原創探索開放不表示測量或提案效果驗證；全性向適用，不新增身分欄位。沿用原Worker／D1，不需remote migration，不重建資料庫。

重要位置：docs/quizzes/communication-candidate.json 管題幹／選項／提案；src/content/communication.ts 轉換並設定工具版本；src/domain/quiz.ts 驗證12組完整映射；src/domain/communication.ts 只依snapshot分析；CommunicationResults.tsx呈現四段入口、雙向依據與完整答案。Node／D1 stores同步在results解鎖後呼叫，invitation只提供hasCommunicationAnalysis主題旗標。未分享直接存not-shared，沒有暗藏原答案。

流程：選communication → 同意分享／建立快照 → A獨立保存與提交 → B接受邀請／獨立保存與提交 → 後端驗證兩人的授權與完整提交 → 雙向配對 → 結果摘要／完整配對／24題選項。任一特殊狀態不比較、不給本方向提案；另一方向獨立處理。不計分。

除錯順序：先核對 #/start/communication 與部署版本；無法建立看Network的POST /api/rounds及GET /api/health；401確認本人返回連結，423確認雙方提交，409是提交鎖定或過時修訂，400 INCOMPLETE回到漏答題。結果不對先查 wantedSlot/providedSlot 和題號，再查snapshot的meaningId、選項kind與providerSuggestions；特殊狀態應為context且advice:null。不要用刪除D1或覆寫舊快照解決內容問題，Console/log不列私人答案或憑證。

修改範例：改「再談前先確認準備好」的check-ready，JSON的comm-resume-plan-do／want兩題要維持同一meaningId，配對providerSuggestions也核對；同步可讀題稿、升來源內容與回合工具版，再跑npm run check、npm run build，驗收作答與結果後cloudflare:deploy。改分析判斷另增版本並保留V1；舊回合不套新registry。故障時從前一已驗證提交重建／發布，資料庫保留。

本機驗證：17檔／90項測試通過（含實際分析窮舉1,080組主要／特殊選項，Node及D1授權、缺答、未分享替換及快照不追套）；一般／Cloudflare建置通過。正常執行環境重跑check解決沙盒子程序暫存ENOENT，未修改測試來跳過失敗。本機Worker4191的scripts/check-communication.mjs通過混合與全未分享兩輪HTTP驗證；A／B各24題畫面填答、提交等待／解鎖、手機390px與Console驗收通過。工程驗證不是人類理解或測量證據，實體雙手機與長期效果未驗證。

部署後驗證指令：node scripts/check-communication.mjs https://between-us.forest-between-us.workers.dev/；另執行check-cloudflare.mjs、check-long-distance.mjs、check-questionnaires.mjs續驗既有功能。只建立虛構QA回合，不讀現存使用者答案，不印憑證；每次驗證會留下測試回合，不能直接刪實際資料。

0.11歷史：當時日常三觀同時開發，因此在 .worktrees/communication-deploy 與 codex/communication-deploy 獨立交付。2026-10-13已在0.12整合進main，這個舊工作目錄保留歷史與本機QA資料，不再作部署入口；目前維護／發布從最新main開始。現行發布標記、Worker與CI見上方0.12節。檢查來源可用 `git status -sb`、`git log -1 --oneline`、`git merge-base --is-ancestor 4f22fed main`；最後一個成功表示main已包含溝通功能，不會讀寫回合資料。

## 0.10 核心價值結論與交流

2026-10-12：改善「完成 57 題後只有分數／圖表、缺少收穫」的問題。先顯示各自相對優先、最多三個共同方向與差異；每卡有具體情境／聊法及可展開的三題依據。再提供四步口頭交流：發現、情境、輪流分享、重新確認。19 類、相近度、公式與 57 題改成可展開區域，沒有刪除。聊天步驟只是本頁引導，不保存或同步，不代表兩人已完成交流；原相近度算法仍是 1.0.0。

### 選題與證據

概念參照 [Schwartz & Cieciuch 原研究 Table 1](https://journals.sagepub.com/doi/full/10.1177/1073191121998760)。生活情境、問題與選題規則是本站提案，沒有伴侶介入效果／互動預測證據。共同方向要求雙方 centered > 0，按 min(A,B) 降序；差異按 abs(A-B) 降序；各自優先按本人 centered 降序。各取最多三個，不把共同低分或最小 gap 當共同重視。不足三個、零差距、無交集、未分化如實說明；同分依原 scoring.values 次序，前三名邊界同分時明示。1e-9 僅容許浮點誤差，不是測量／統計門檻。

第 49 題原繁體語意仍待核對：face 保留全部 19 類計分及 57 題資料，暫不生成生活敘事。MRAT 仍含該題，所以也可能影響其他相對分數；排除敘事不等於修復測量問題。不從低分判定固執、自私、不重視；不從單一／多面向推定衝突模式、關係成功率或高低契合。不用外部 AI，不傳送答案給第三方生成服務。

### 檔案與 Request / Data Flow

1. src/content/core-value-feedback.ts 保存固定 V1 的 18 個概念、三題映射、情境與問題，以及 legacyCoreValueLayoutV1。修訂另立版本，不覆寫 V1 追改舊報告。
2. src/content/core-values.ts 的新工具 0.4.0 保存 feedback 的獨立拷貝；建立回合寫入 rounds.snapshot。原措辭 0.2.0、相近度 1.0.0 不變；src/domain/quiz.ts 驗證來源、19 類覆蓋與題號契約。
3. GET /api/rounds/:id/results → Node / D1 store.results 驗證本人及雙方提交 → snapshot → compareValues → buildValueFeedback → 回傳 comparison、valueFeedback 與真正的兩人答案。status／邀請不回傳計算後回饋。
4. buildValueFeedback 在 src/domain/value-feedback.ts：新快照只讀自己的 feedback；舊 core-values 0.3.0 符合固定 57 題／19 類映射才加 origin:legacy-reading-layer 的 V1 閱讀層，不寫回原 snapshot、答案或分數。三題／其他不支援舊版不套用。
5. SharedResults → ValueResults → ValueFeedbackReport；樣式在 ValueFeedbackReport.css。value-data / raw-answer-details 保留資料，科普短卡保留。chosen、conversationRun、step 是 React state，只控制本頁；重新整理不保存聊天進度。
6. vite.config.ts 的 test.include 限定 src、server、cloudflare 正式測試，避免 .local / .worktrees 歷史副本混入同一輪，不刪副本／答案來讓測試過。

### 排查與自行修改

- 仍見舊圖表：先重新整理私人結果；看 GET results 是否有 valueFeedback，未完成 423、陌生憑證 401。0.3.0 看 origin；三題或映射不符保留舊顯示。不要改 DB 版本或繞過提交鎖。
- 卡片與答案不符：查三題 mean、MRAT、centered，再查 snapshot.feedback.perspectives 的 questionIds 與 scoring.values；不拿最新 registry 解讀舊回合。
- 共同／差異卡不足：查 reason、centered、gap；無交集／零差距／未分化可為合法結果。同分不代表統計顯著。
- 按鈕沒跳或沒重置：查 chosen、conversationRun、GuidedConversation key、useEffect 後 guided-heading 焦點。四步不發 API，另一裝置不會跟著跳。
- npm test 掃到暫存副本：查 test.include。Windows 受限暫存 ENOENT／通訊端限制要用正常權限完成必要驗證，不改資料／算法來修環境問題。
- 本輪本機 Worker 4182 監聽後健康逾時，未完成本機 Worker HTTP UI；改用既有 Node API＋Vite、隔離記憶體虛構回合做 UI。D1 與授權／解鎖由 Miniflare HTTP 測試驗證，公開部署另外記錄，不混稱三種結果。
- 修改例：自主行動改成行程分工聊法，要新增 V2 內容／算法分支、升工具版，再把新回合指向 V2；保留 V1 與 0.3.0 固定閱讀層。純 CSS 或頁面標題只升網站修正版。需驗證共同低分、零差距、同分、未分化、舊 0.3.0、快照不追改、401／423，再檢查相關畫面。

驗證：13 個正式測試檔／76 項通過，一般／Cloudflare 建置通過。測試包含共同低分不當共同重視、無交集／零差距／同分／未分化、題號／來源契約、快照不追改、舊完整 0.3.0 不改答案／分數，以及 Node／Miniflare D1 授權與 results 解鎖。瀏覽器使用隔離 Node 記憶體虛構回合，正常三共同／三差異、無交集、未分化、legacy 標示、三題依據、19 類／57 題展開、方向跳轉與四步交流均通過；390px 模擬無溢出，未見 console 錯誤／警告。沒有實體雙手機或使用者成效驗證。

是否提升理解感，仍需使用者閱讀與交流後回饋；工程測試不能代替產品成效。

發布整合：既有 v0.9.0 指向四題問答提交 c3971e2，不覆寫該標記。本次核心價值回饋使用網站 0.10.0，整合保留四題問答／遠距／文章館；新核心價值工具與回饋版本不受網站版號調整影響。合併後正式測試為 15 檔／82 項，320px 手機導覽亦無橫向溢出。

### 0.10 正式發布與驗證（2026-10-12）

功能提交 `88b7ad0`、合併發布提交 `bfd869ccca34074ef9f5f1aea9408f61a2c6cfdf`；main／v0.10.0 已推送。[GitHub CI 38190902112](https://github.com/tivico/between-us/actions/runs/38190902112) 對應合併提交且 completed/success。82 項測試及一般／Cloudflare 建置通過，沿用原 Worker／D1，沒有 remote migration；最終 Worker 版本 `8e3fcae0-6402-4de2-8273-576332c88e73`。

公開 `check-cloudflare.mjs` 驗證 feedback 1.0.0、三題映射、共同方向條件、雙方解鎖、缺答及提交鎖定通過；`check-long-distance.mjs` 的 24 題雙向分析／條件／全暫不分享與保護通過；`check-questionnaires.mjs` 的八組四題、特殊狀態／提案方向與保護全部通過。只建立獨立虛構 QA，不讀原有私人答案，不刪 D1。先前中斷前的腳本輸出未能取回，繼續後重驗並記錄以上結果，不將未知結果當通過。

公開核心價值介紹頁已由瀏覽器確認顯示新的有依據回饋介紹與四個導覽入口；報告與交流的實際畫面、舊完整回合、未分化情境是在本機虛構資料驗證，沒有開啟使用者私人結果。`.local/value-feedback-desktop.png`／`value-feedback-mobile.png` 是工程示範，`value-feedback-entry-live.png` 為公開入口。臨時 QA 返回憑證與腳本已清除，截圖只在忽略目錄。後續發布紀錄補充僅為文件，不重部署或升版。

## 0.9 四題雙人問答維護與驗證

2026-10-12 已實作，發布結果另記本節末。入口 #/questions，八組各四題；原白話題目維持不變，未套用候選稿的 12 項修訂提案。網站 0.9.0，運行題庫與描述性規則各 1.0.0；自編題與建議尚未完成測量／效果驗證。

重要位置：`docs/quizzes/getting-to-know-you.json` 保存題目、特殊狀態、語意選項 ID、對方選此項時的 guidance、兩人 together 與討論提示；`src/content/questionnaires.ts` 把每組轉成回合定義；`src/domain/conversation.ts` 只依快照做描述性整理；`QuestionnairePages.tsx` 管列表／介紹／結果，`ConversationOptions.tsx` 管四個主要選項、特殊答案展開與未分享操作。`RoundFlow.tsx` 沿用保存、提交及邀請，Node／D1 results 都在雙方完成後才計算。

自行修改例子：想改「壓力很大時」對方選「一起整理下一步」的建議，改 JSON 對應選項的 guidance，再升內容 version；不改本人選項或把提案放到共用畫面。給 A 的內容源自 B 的答案，改完要檢查角色互換。不因問答升版修改 core-values 的工具／算法版本。

安全驗證順序：

```powershell
npm run check
npm run build
npm run build:cloudflare
node scripts/check-questionnaires.mjs http://127.0.0.1:4182/
node scripts/check-cloudflare.mjs http://127.0.0.1:4182/
```

4182 是本次隔離 Worker 測試埠；一般 cloudflare:dev 為 4180，依實際網址改指令。check-questionnaires 會建立八個新的工程 QA 回合，驗證缺一題不能提交、只有本組四題、特殊狀態不算差異、B 未提交的 423、陌生憑證 401、兩人相同結果與提交後 409。另一支腳本保護原 57 題核心價值流程。它們不讀既有答案、不輸出憑證或私人連結；在雲端執行會留下八加一輪明確命名的 QA 資料，不以刪 D1 或使用者回合清理。

排查順序：

1. 找不到問答入口：確認 #/questions，重新整理後查部署版本與新 dist，僅推 Git 不會更新 Worker。
2. 四題答完還不能提交：查是否四題都有選項或明確未分享、儲存狀態是否完成，再查 status.quiz.questions 是否只有四題。本組不能混入其他組；不能只改前端進度分母。
3. 沒看到共同點／建議：先看是否特殊狀態，context 不提供個別建議是預期；再查已解鎖的 results 是否有 conversation、快照 questionnaire.version 是否為 1.0.0。未解鎖時不要用 status 偷算比較。
4. 給兩人的方向不對：依序查題目 ID、語意選項 ID、guidance 與 A／B 映射。期待題不代表實際做法；不改原答案來配合建議。
5. 未分享仍顯示舊選項：查本人 status 的本題 ID 是否已取代為 not-shared、最後保存是否成功，再查後端結果；不能只用 CSS 隱藏。暫時停用錯誤結果顯示並保留資料。
6. 500／401／423／409：依既有 Cloudflare 檢查健康與授權，不輸出 token 或答案。423 是雙方尚未完整提交，不是要繞過的限制。

回復時保留 D1 與現有快照。若問答新入口故障，先停止新的問答回合入口，保留 1.0.0 結果算法供已存在回合使用；不可直接退回不認識 questionnaire 的 0.8 或更舊版本，造成新回合無法正確解讀。修正後 check／build、畫面驗證、提交與部署。

本次工程驗證：75 項測試（含 Node／D1 的八組回合、快照不追套、特殊狀態及角色互換）與兩種建置通過。4182 的完整 HTTP 檢查、24 題遠距及 57 題既有流程通過。瀏覽器使用明確標示的虛構 QA A／B 驗證四題、重新整理續答、把原選項取代為未分享、獨立邀請、提交／解鎖、共同點篩選及個別／雙人提案；390px 手機模擬無橫向溢出，Console 無 error／warn。尚未驗證兩部實體手機、長期負載或自編內容／提案效果。

Windows 工具環境：Vitest 在沙箱中讀轉譯暫存時遇 ENOENT，一般本機權限下相同 `npm run check` 通過。發布工作目錄改在 `.worktrees/separate-quiz-and-qa`，分支為 codex/publish-four-question-qa；原 .local 工作目錄因 Windows 拒絕直接搬移而保留，沒有刪除私人資料或放寬 fs.deny。本次整合遠端 main 已公開的遠距 0.8，保留其 24 題與描述性規則；問答採網站 0.9.0，沒有覆寫既有 v0.8.0。

### 0.9 公開發布紀錄

四題問答已隨 0.10.0 整合發布，八組公開 API 驗證全部通過；證據與最終 Worker 版本見上方 0.10 正式發布章節。沿用既有 Worker、D1 與網址，沒有重建資料庫或 remote migration。

## 固定開發流程

整理日期：2026-10-08。這是後續建議採用的工作規律，不是新增自動化或保證每週發布。現況先看 [README 核心總覽](../README.md#核心內容與現況總覽)，產品邊界看 [product.md](product.md)，實際請求與保存方式看 [architecture.md](architecture.md)。下方版本章節是當時的驗收／發布紀錄；早期限制需配合後續版本閱讀。

### 一輪只交付一個可驗收成果

維持一個正在實作的成果，其他放在待辦。大題目先拆成能獨立核對的里程碑，例如「更認識你候選題逐題確認」、「題組與分享契約」、「完整雙人接入」，各自記錄完成條件；前兩者完成不代表測驗已上線。修正若阻擋本輪驗收，優先修正；其他新想法先記下，不在同一輪默默擴大範圍。

| 階段 | 這一階段要回答什麼 | 往下一階段的條件 |
| --- | --- | --- |
| 1. 定義 | 誰在哪個畫面遇到什麼問題？做完會有什麼可觀察差異？ | 寫明範圍、不做的事與驗收情境；需要使用者決定的產品規則先定案 |
| 2. 內容與契約 | 題目／文章的來源支持到哪裡？需要什麼資料？ | 題幹、選項、未答／不分享規則、結果與版本有明確定義；沒有內容變更則略過來源審查 |
| 3. 實作 | 改哪些共用流程、內容、API 或資料庫？ | 改動集中於本輪；API／提交規則同步 Node 與 D1；schema 改動有 migration，舊回合仍可讀 |
| 4. 驗證 | 正常、邊界、錯誤與舊資料會怎麼表現？ | 程式檢查／建置通過，相關手機、桌面、鍵盤與雙人情境完成；記錄未驗證項目 |
| 5. 交接與提交 | 維護者能自己改與除錯嗎？ | 更新最接近的文件，審查 diff，只提交本輪；功能、修正與內容版本依各自規則管理 |
| 6. 發布與回看 | 線上是否真的提供這份已驗收成果？ | 有發布授權才部署；固定提交、確認 CI 與線上結果，記錄版本／限制與下一步 |

「內容核定」「工程驗證」「公開發布」「測量驗證」分別記錄。`npm run check` 通過只表示工程檢查成功；有研究來源不代表本站改寫／自編工具有效。純文件交付完成第五階段即可，不需要升網站版號或部署。

### 可複製的工作單

新工作先在最接近主題的既有文件加入此格式；一般功能可放 product.md，題庫放 docs/quizzes，維運放本手冊。避免另建一套重複待辦資料庫。

```text
成果名稱：
狀態：待定義／待內容確認／實作中／待驗收／已提交／已發布
使用情境與預期差異：
本輪做什麼／不做什麼：
尚待決定的規則與前置工作：
內容、程式、API／資料庫影響：
驗收：正常情境、邊界／失敗情境、舊資料相容性
版本：網站／題庫／候選內容／計分規則／文章（不相關填不適用）
驗證紀錄：指令、畫面、日期、已驗證／未驗證
交接：資料流程、除錯順序、自行修改範例與回復方式
提交／發布：commit、tag（若有）、CI、Worker 版本（若發布）
下一步：
```

### 建議每週節奏

- 週初：整理上輪回饋，選一個最重要成果，寫工作單與驗收條件；依賴未定的功能先做內容／契約，不急著接畫面。
- 週中：完成實作，隨改動做相關檢查；發現新需求就放待辦，必要時縮小本輪成果。
- 週末前：驗收、補文件、建立 commit；達到可交付條件且有發布授權才上線，否則明記「已提交、未發布」。
- 回看：記錄本輪完成、阻礙與下一輪優先項。未通過驗收就延續到下一輪，不為固定星期或湊版號而發布。

這是安排順序的參考，可依可用時間調整；一次只需回答「本輪要讓使用者多做到哪件事」。不要求每日 commit，也不要求每週新增測驗。

### 開發、驗證與發布的實際操作

1. **開工先核對**：`git status --short`、`git diff`、`git diff --cached`；確認原本已有的工作，不能一併覆蓋或提交。用 `npm run dev` 開本機 5173 網頁與 8787 API；測試用虛構作答，不讀取使用者私人回合。
2. **程式變更後**：執行 `npm run check`、`npm run build`；依影響檢查手機／桌面／鍵盤、直接連結與重新整理。API 或提交規則需驗證 A/B 獨立憑證、提交前保密、缺答拒絕、重試與舊快照；Cloudflare 相關改動再驗證 `npm run build:cloudflare` 與本機 Worker。純文件只檢查內容、連結與 diff，不把舊測試紀錄當成本輪重跑。
3. **保存成果**：補 README／主題文件／本手冊，`git add -- <本輪明確檔案>`，`git diff --cached`，再 commit。新功能交付升 0.x 中間碼，修正升最後一碼，同步 package.json、package-lock.json 與 CHANGELOG；純文件通常不升版。題目、文章、計分各自管理版本，不能因網站升版就全部一起升。
4. **發布另行核對**：push 只觸發 GitHub CI，不會更新公開網站。授權發布後，檢查目標 commit 的 CI；如工作區還有未驗收變更，依既有固定副本方式發布指定提交，勿直接部署混合工作區。執行 `npm run cloudflare:deploy`；資料庫變更須先核對既有 D1、migration 與回復計畫，不重建 D1。
5. **部署後確認**：讀取 `/api/health`、開啟這輪相關公開路徑並核對資產／Worker 版本，記錄結果。本輪有 API 變更時，再跑既有 `scripts/check-cloudflare.mjs` 的完整流程；它會新增虛構 QA 回合，不是唯讀檢查，純文案或文件不用例行建立公開回合。無法核對就記「部署後未驗證」，不能直接標為完成。

部署後的流程是「指定 Git commit → 檢查／Vite 建置 → dist 網頁資產與 Worker 上傳 → 沿用 D1 → 健康與相關功能驗證 → 更新發布紀錄」。這與「提交程式到 GitHub」是不同步驟；tag 是版本標記，也不代表已發布。

### 發生問題時，按這個順序縮小範圍

1. **文件互相矛盾**：先看 README 現況與 package.json，再看功能原始碼；公開狀態看本手冊最新發布紀錄與對應 commit／CI。若還無法確認就標成待查，不照搬舊版本的「尚未上線」。
2. **檢查／建置失敗**：先在本機重現，確認 `node --version` 符合 README，從 `npm run check` 第一個錯誤定位型別、內容契約或測試；通過後才處理建置與畫面。不要刪除實際回合資料讓測試通過。
3. **本機正常，線上沒更新**：核對網站網址、發布 commit／資產、Worker 版本與是否執行部署；只 push 不會上線。API 故障先查 `/api/health`，再看 Network 的 HTTP 狀態與 Wrangler log；不輸出 Authorization、私人連結或答案。
4. **結果未解鎖／保存失敗**：確認是否雙方已完整提交，再查 `RoundFlow.tsx` → `api.ts` → Node `server/store.mjs` 或雲端 `cloudflare/store.mjs`。423 通常是尚未解鎖，409 可能是已提交或草稿 revision 衝突；不要只改前端把對方資料顯示出來。
5. **需要止血／回復**：回復自己這輪的改動，或重新部署已驗證且能讀取現有快照的提交；保存 SQLite／D1。若涉及 migration，照本輪回復計畫處理，不能假定回復程式就會回復資料庫。

### 自行修改與下一輪的判斷範例

- **只改結果標題**：修改 `src/components/ValueResults.tsx`，檢查一般／無總分結果與手機版；交付時升網站修正版，不改題庫或 `1.0.0` 計分分支。
- **新增一篇文章**：內容放 `src/content/relationship-articles.ts`，來源與本站應用分清楚；需要結果入口才改 `ResultLearningCards.tsx`。檢查文章館、全文直接連結、來源與手機版，不改雙人保存／計分。
- **接入更認識你**：先在候選文件確認題目與「暫不分享」行為，再定義題組快照、答案契約、Node／D1 的保存與解鎖；最後接共用畫面。現在核心價值要求 57 題完整作答，不能直接放寬來容納另一種題型，也不能用選項 ID 算契合分數。

建議待辦順序（尚非已核定的下一版承諾）：先把保存期限／刪除／憑證失效等資料生命週期規則定案，完成一個可驗收的保存管理成果；再選「更認識你」或「遠距」其中一項做內容核定與接入。人生方向另開範圍，不與新題組同時合併計分；核心價值措辭審查與測量驗證持續另記，不能用工程里程碑代替。

## 第一次啟動

```powershell
cd C:\Users\lydai\Desktop\forest
node --version
npm ci
npm run dev
```

終端機顯示 Local URL 後開啟；手機版可先用瀏覽器裝置模擬。`127.0.0.1` 只供此電腦使用；0.6 公開網址已有完整 57 題雙人邀請與結果；單人探索與舊三題另保留。

`npm run dev` 同時啟動網頁 5173 與 API 8787；需要 Node 24.13 以上。SQLite 固定在 `.local/data/between-us.sqlite`；單人預覽／內容試讀不保存，雙人回合會保存。公開部署與本機資料獨立，詳見下方 Cloudflare 章節。

## 0.8 遠距雙人探索與個別建議

部署後可執行 `node scripts/check-long-distance.mjs https://between-us.forest-between-us.workers.dev/`，驗證遠距 24 題、缺答／草稿恢復、邀請、401／423／409、雙向分析與本人條件、雙方結果一致、全暫不分享。它只建立兩輪虛構 QA，不讀既有使用者回合、不輸出答案／憑證，不刪資料。加 `--qa-proof` 會把它自建回合的返回入口保存於忽略的 `.local/qa/long-distance-proof.json`，僅供畫面驗證，不提交或轉傳。既有 `scripts/check-cloudflare.mjs` 另驗證 57 題核心價值，兩者分開執行。

狀態：2026-10-08 已合併 main、推送 main／遠距分支／v0.8.0 並公開部署；2026-10-12 完成公開 API 與結果畫面續驗。開發／發布使用獨立 worktree，避免納入其他聊天尚未驗收的修改；後續可在 forest/main 正常開發。網站版 0.8.0、遠距回合工具版 0.2.0、原題候選 0.1.0、描述性規則 1.0.0。

**修改與原因**：遠距原本只有研究稿及 planned 卡片；現在可建立完整 24 題雙人回合、自動保存與恢復、A 提交邀請 B、雙方提交後解鎖。結果顯示共同偏好／相符回應、不同需要、各自的見面期待與可行條件，以及至多六項依答案產生的討論提案；卡片展開可查觸發題幹／答案／概念來源。先呈現雙方實際選項，使每項解讀可核對。本人條件不列為兩人的共同點；近期經驗、未確定、未提供固定安排及暫不分享不推論為一致或衝突。題庫與建議效果未驗證、不提供契合分數。

**檔案與實際流程**：

1. `docs/quizzes/long-distance-candidate.json` 保留研究原稿及逐題證據；`src/content/long-distance.ts` 將 24 題轉成共用 QuizDefinition，宣告 analysis.comparisons（14 題偏好）、pairs（忙碌／支持雙向、見面本人條件）、排除選項、optionAdvice 與逐題討論提示。工具候選的 PRI 等三個來源不作產品題目來源；產品只列實際引用的五篇概念研究。
2. `quizzes.ts` 匯入 longDistanceQuiz，仍維持五個主題；`validateQuiz` 檢查題號、建議、選項參照、版本與完整提示。ready 是功能開放，research-informed 是證據狀態。
3. StartRound → POST /api/rounds；Node／D1 保存整份 quiz 到 rounds.snapshot。PUT answers 暫存，POST submit 驗證 24 題都有合法選項；稍後回答仍未答，選暫不分享則已答，但不提供可比較內容。原本的 revision、提交鎖定與授權規則不變。
4. A 完成後以邀請讓 B 加入；InvitationPreview 只新增 hasPairAnalysis 表明分享範圍，不含分析／對方答案。status 仍只回本人答案與對方完成狀態；quiz.analysis 是公開規則模板，不是結果。
5. GET /api/rounds/:id/results：Node `server/store.mjs`、D1 `cloudflare/store.mjs` 都先授權且確認兩人提交，之後呼叫 `analyzeDistance(snapshot, A, B)`。缺答／非法答案／破損或未知規則拒絕分析，不補值。
6. `src/domain/long-distance.ts` 的 V1 產生 common、differences、conditions、context、suggestions；忙碌／支持是 A 希望對 B 自述、B 希望對 A 自述兩個方向，見面是本人希望對本人可行條件。排序是編輯安排，不是心理風險排名。模板與 optionAdvice 讀 snapshot，不查最新題庫、不呼叫外部 AI／生成服務、不傳送額外答案。
7. SharedResults → `LongDistanceResults.tsx`／其獨立 CSS：共同點／差異預設各三組，可展開其他；條件獨立呈現；建議卡可查為何出現；context 保留原選項。原 24 題並排也保留逐題提示；不適用等答案不要求補原因。原核心價值算法與科普卡仍保留。

**壞掉時照這個順序查**：

- 仍顯示籌備中／三題示例：確認公開網址並重新整理，本機則確認 checkout 的 package.json 為 0.8.0。執行下方題庫診斷應回 0.2.0／24／1.0.0。修改共用題庫後需重啟自己啟動的 Node API；Vite 更新畫面不會自動重載 Node 模組。
- 保存／提交失敗：Network 看 answers、submit；INCOMPLETE 是仍有未答，暫不分享是合法選項，不能補零。409 看 revision／鎖定狀態；重新載入本人紀錄，不刪資料。
- 分析沒顯示：先確認雙方提交，results 423 是保護；401 是私人憑證錯誤。等待畫面不能用前端繞過。沒有 analysis 的舊快照仍只看原答案。
- results 500／畫面提示分析無法讀取：查看公開規則快照是否有 analysis.kind／version、合法 comparison／pairs 題號與排除選項；確認前後端為同一發布版本。Node 只記 API_INTERNAL_ERROR，勿輸出原始憑證或私人答案。先重啟自己的 API，再跑 check；不要靠清空 SQLite 或 D1 止血。
- 期待對錯人：看該 finding.evidence 的 slot／questionId／role；A 的 wanted 要連 B 的 provided，再反向。見面兩項必須同 slot，且只進 conditions。
- 暫不分享被列共同點、未知做法被判差異：先看 snapshot.analysis.excludedOptionIds，檢查 special 選項是不是被重命名。context 的 advice 必須為 null，suggestions 不得含它。純粹未答仍不可提交。
- 手機卡片擠出：看 LongDistanceResults.css 的 min-width、overflow-wrap 和 720／400px 斷點；不要刪除原答案來縮短。開發中變更結果契約後先重新載入新頁並重啟測試 API，避免舊 React state／舊後端混合。

安全診斷（只輸出公開題庫資訊）：

```powershell
node --input-type=module -e "import { getQuiz } from './src/content/quizzes.ts'; const q=getQuiz('long-distance'); console.log(q.version,q.questions.length,q.analysis.version);"
npm run check
npm run build
npm run build:cloudflare
```

**教到能自行修改**：

「快照」就是建立這輪時存下來的一份題目與規則副本。之後更新題庫只影響新回合；結果不能回頭讀最新模板，否則同一輪會無故改變。

例子：要改「先傾聽」的建議，在 long-distance.ts 的 pairs 找 support → optionAdvice.listen，保留選項 ID。這是新提案，升遠距工具版、同步研究文件；舊回合的那句提案仍由原 snapshot 保留。若改配對演算法，另加分析版本與分支、保留 analyzeDistanceV1，不直接改 V1。新增選項先同步原稿與對應的期待／實際題、更新映射；若新增題目數，連同 importer 的完整題序檢查、入口題數與必要測試一起改，不把 ID 當數值。

驗證需確認雙向 slot、特殊選項不推論、缺答不能提交、舊快照不追套，以及 Node／D1 一致。即使工程測試通過，仍不能把 evidence 改為 validated 或宣稱建議已有效。

**已驗證與限制**：12 檔／69 項測試，包含 7 項語意／來源／排除／快照測試及 4 項 Node／D1 共同契約；一般與 Cloudflare 建置、Worker dry-run 成功。dry-run 只打包，不上傳或部署；隔離 checkout 的 bundler 讀目錄與 Wrangler log 寫入原被沙箱阻擋，使用一次已授權的執行完成。隔離 5190／5191 服務只用虛構 QA 資料與記憶體 SQLite，完成 A/B 各 24 題 UI、缺答按鈕、草稿重新整理、邀請分享說明、結果解鎖及一致性、建議原因／來源展開、全暫不分享與 390px 模擬。最後全新頁面無 console error／warn，手機無橫向溢出。截圖放該 worktree 的 .local/distance-desktop.png 與 distance-mobile.png，不提交 Git。沒有讀寫使用者原 SQLite，沒有雲端答案或 schema 變更。

尚未完成：實體雙手機、認知訪談、本題庫心理測量、建議效果。回復程式時使用已驗證 commit；資料庫無 migration，保留所有原答案，不為回復重建 D1。未來發布依現有 Cloudflare 步驟，使用固定且已驗證的提交，避免把其他聊天的修改一起部署。

### 0.8 發布與續驗紀錄

發布日期：2026-10-08；續驗及文件更新：2026-10-12（Asia/Taipei）。功能提交 `045dcc8`，整合最新 main 的提交 `4494500`，公開 API 檢查腳本提交 `cb90ec28cbae4f61bece48b0e6440ae1eada710d`；main、`codex/long-distance-analysis` 與新標籤 `v0.8.0` 已普通推送，沒有 force push 或覆寫舊 tag。合併時保留其他聊天草稿，核對「更認識你」原文件指紋未改，其餘兩份文件只新增本次遠距內容。

[GitHub CI run 37786526935](https://github.com/tivico/between-us/actions/runs/37786526935) 對發布提交回報 completed/success，包含 69 項測試、兩種建置及 Worker dry-run。`npm run cloudflare:deploy` 在固定 checkout 再執行 check／Cloudflare build，再上傳網站資產及 Worker；Wrangler 回報版本 `31423539-eed2-4686-95f5-bda3d99b1683`。2026-10-12 唯讀查 deployments list 確認該版本仍為最新、100% 流量，發布時刻為 2026-10-08 21:44:08（Asia/Taipei）。網址沿用 https://between-us.forest-between-us.workers.dev/ ，D1 沿用原 database_id，沒有 migration、重建 D1 或搬移本機答案。

上次部署已完成，但續驗工作因自動核准服務額度不足中斷；當時 57 題公開檢查未執行。2026-10-12 重新核准執行兩個腳本，實際回報 `LONG_DISTANCE_FLOW_OK` 與 `CLOUDFLARE_FLOW_OK`。遠距檢查涵蓋 24 題、缺答／草稿恢復、邀請分享範圍、陌生憑證 401、提交前結果 423、鎖定後保存 409、雙向期待與自述做法、本人見面條件、相同共同結果及全暫不分享。既有 57 題檢查涵蓋保存、提交、19 類計分與相近度。本輪只新增兩輪遠距及一輪核心價值的虛構 QA，未讀取或刪除既有私人答案。

公開瀏覽器確認 24 題入口、共同點／差異、獨立的期待與可行條件、六張建議卡、觸發答案與研究連結、全暫不分享時無具體建議；新頁面 Console 無 error／warn。390px DOM 量測未見橫向溢出；本次手機截圖工具未能取得影像，不將它記成實體手機或新的手機影像驗收。桌面證據保存於遠距 worktree 的 `.local/distance-live-desktop.png`，不提交 Git。私人 QA 返回入口也僅在忽略的 `.local/qa/long-distance-proof.json`。

發布資料流：main／v0.8.0 固定來源 → GitHub CI → Wrangler 上傳 dist 與 Worker → ASSETS 提供網頁 → `/api/*` 讀寫原 D1 → 雙方提交後依 snapshot 產生 pairAnalysis。GitHub push 本身不會更新網站；本次文件交接提交不改網頁／API，因此不升版、不重新部署或移動 `v0.8.0`。

維護範例：要改「先傾聽」提案，修改 `src/content/long-distance.ts` 的 support／optionAdvice.listen，升遠距工具版並跑 check／build；舊回合仍用其原 snapshot。發布後先安全查看 `/api/health`，再跑相應 smoke check；出現 401／423／409 依上方授權／提交／revision 順序處理，不以刪答案止血。回復時重建已驗證且仍支援既有快照的版本，保留同一個 D1。


## 0.7「了解關係」與結果科普短卡

使用者指定獨立完整文章與可查核來源，並追加結果科普短卡；不加六選項說明。文章入口為 #/learn，全文為 #/learn/:id。第一批為核心價值、感受到的回應、遠距日常，每篇 1.0.0。估計閱讀時間不是實測。來源查核於 2026-10-08，依原始論文工具／摘要／模型／方法段落，不宣稱系統性回顧；研究段落就近附 DOI，篇末附方法、閱讀範圍及全文入口。本站生活例子／聊天提案另外標示，不是已驗證介入。

**修改與原因**：原網站只有測驗來源與計分細節，閱讀依賴進入測驗；新增公開文章館，讓兩人隨時閱讀。結果短卡放在相近度摘要之後、19 類圖表之前，讓使用者先理解比較；沒有總分時用專屬解釋，三題舊回合僅顯示通用回應短卡。固定教育內容不依高低分貼人格／關係標籤，也不根據性向或性別改內容。

**重要檔案與流程**：

1. src/lib/routes.ts 解析 #/learn 與 #/learn/:id；App.tsx 的 Page 選 RelationshipLibrary 或 getRelationshipArticle → RelationshipArticlePage。
2. src/content/relationship-articles.ts 保存文章 ID、version、updated、sections、conversation、sources。每段 kind 分研究／本站應用／生活背景／限制；sourceIds 指向同篇 sources。
3. RelationshipPages.tsx 將資料顯示為卡片、完整內文、目錄、聊天提示與研究書目；目錄按鈕捲動並聚焦標題，不變更 hash 或建立新回合。
4. SharedResults 在既有後端 results 解鎖後顯示 ValueResults → ResultLearningCards；後者依 coreValues / noScore 選教育文案，不計分、不發 API、不讀私人答案。一般舊回合走 SharedResults 的通用卡片。
5. 短卡的文章 ID → getRelationshipArticle → 原研究連結／#/learn/:id。文章閱讀不要求憑證、不讀寫 SQLite、D1 或 localStorage；靜態文字隨 Vite 建置打包。樣式在 styles.css 的 reading-* / result-learning-*。

**故障排查順序**：

- 導覽或文章出現找不到：先確認 #/learn、# 後的英文字 ID 與內容一致；檢查 parseRoute、Page 分支、getRelationshipArticle。尾斜線與額外段落不是有效路由。
- 點目錄沒跳轉：檢查 reading-加段落 ID 的 h2 是否存在、ID 是否唯一；查 goToSection 的目標與鍵盤焦點。不用把段落寫成新 hash，避免被路由當成其他頁。
- 短卡沒出現：先確定是在雙方已提交的 SharedResults，不是本人答案整理／等待頁；57 題需有後端 comparison。不要改前端顯示來繞過結果解鎖。分數 null 應見「沒有總分，也可以了解彼此」。
- 文獻網址失效：核對 DOI、readUrl 與作者／年份，換到原作者或出版者可信入口；不能把讀不到的全文記成已讀。英文書名在手機溢出時先看 overflow-wrap 與 min-width，不刪除書目來縮短。
- 本機看得到、線上仍舊版：先重新整理；執行 npm run check、npm run build:cloudflare，再 npm run cloudflare:deploy；GitHub push 不會自動部署。沒有 schema 改動，不重建 D1。需要暫時移除文章時可回復上一個前端發布版本，不刪答案。

**自行修改範例**：要新增「衝突後如何再開口」，在 relationshipArticles 增加不重複、穩定的英文 ID、文章版本／日期、完整段落與來源；研究段落的 sourceIds 必須找到同篇來源。文章館、直接連結與延伸閱讀會自動更新。要放到結果短卡，再改 ResultLearningCards 的 cards，明示研究與本站提案邊界。只有修改文章不用升題庫或比較規則；重要內容修訂升文章 version 並更新日期。一般文字用 React 字串輸出，維持不用原始 HTML 注入。

本機驗證：npm run check 的 10 個測試檔／58 項測試通過（沿用並擴充路由案例），一般／Cloudflare 建置通過；瀏覽器檢查文章館、三篇直接入口、段落跳轉與焦點、DOI／原文連結、短卡→全文；本機虛構正常分數／無總分／三題回合實際顯示短卡，手機 390px 模擬未見橫向溢出。這是工程與畫面驗證，不是科普介入效果、實體手機或測量驗證。來源可查核不等於科普建議效果已驗證。

發布使用本次提交的固定副本（git archive → .local/releases/relationship-0.7.0），依該副本建置與部署；原工作區可能同時有其他功能開發，不能把未驗收變更一起發布。副本的 node_modules 以 junction 指向同專案套件，不包含 .env、私人答案或 .git。副本不是日常開發入口；未來仍在根目錄修改，發布時再固定所要發布的提交。

**2026-10-08 正式發布已驗證**：功能提交 `66db30dbed9a1b73260e75fd0b66a3079339abe0`、標記 v0.7.0 已推送。固定副本的 58 項測試與兩種建置通過；執行 Wrangler deploy 沿用原 Worker／D1，無 migration。Worker 版本為 `bd12ec28-2a49-4fa7-b3d5-474c6f1bdaaf`。公開 [文章館](https://between-us.forest-between-us.workers.dev/#/learn) 與全文頁可讀、主導覽可進入，瀏覽器未見警告／錯誤；健康 API ok:true，公開 JS 資產 `/assets/index-DTKuTrAk.js` 與固定副本相符。[GitHub CI 37781275446](https://github.com/tivico/between-us/actions/runs/37781275446) 對應功能提交且 completed/success。公開短卡使用同一份已驗證資產；短卡正常／無總分／舊三題的實際互動是在本機虛構資料驗證，沒有讀取使用者公開私人結果，也沒有新增公開假回合。本節後續補充只是發布文件，不需重部署或升網站版。

## 新增一個主題

先在 `src/content/quizzes.ts` 的 `quizzes` 陣列增加資料，不必複製畫面。例如新增尚未有題庫的「共同休閒」：

```ts
{
  id: 'shared-leisure',
  version: '0.1.0',
  title: '一起度過的時間',
  subtitle: '認識彼此喜歡的休閒節奏。',
  description: '聊聊休息、共同活動與各自的興趣。',
  audience: '交往中的伴侶',
  status: 'planned',
  theme: 'sand',
  motif: 'space',
  dimensions: ['休息方式', '共同活動'],
  questions: [],
  sources: [],
  evidenceSummary: '主題規劃中，尚未選定研究與量表。',
}
```

存檔後首頁卡片、介紹頁與篩選會一起更新。使用不重複的英文字小寫 ID；直接連結為 `#/topics/shared-leisure`。

有草題時設定 `draft`，每題要有獨立 ID、合法面向、至少兩個有 ID 的選項，以及 `sourceIds` 與 `note`。來源記在同一主題的 `sources`；不是放一個網址就完成研究驗證。新增非單選題時，必須一起修改 `Question`、內容驗證、`Demo` 與測試，不能用單選欄位硬塞多選資料。

## 常見修改位置

### 遠距戀愛初次研究交付紀錄（2026-10-08）

以下是接入前的歷史記錄；目前分支功能與維護見本文件上方 0.8 章節。

研究與完整 24 題見 [遠距候選稿](quizzes/long-distance.md)，結構化原稿為 `docs/quizzes/long-distance-candidate.json`。每題記錄穩定 ID、來源、原創改寫邊界與結果討論提案；三段只是閱讀分類，不是三個量表分數。流程為期刊／作者材料 → 來源查核記錄 → 候選 JSON → 審閱稿 → 後續內容審查；目前沒有 HTTP 請求、答案保存或前端匯入。

網站仍顯示遠距「籌備中」是預期結果。若 JSON 壞掉，先用 `Get-Content docs/quizzes/long-distance-candidate.json -Raw -Encoding UTF8 | ConvertFrom-Json` 查語法，再用 `rg -n '來源ID|題目ID' docs/quizzes/long-distance-candidate.json` 查參照；DOI 無法讀取時查來源 `readUrl`，不要把摘要標成已讀全文。

維護範例：調整忙碌通知選項時，同步 `ldr-busy-actual` 與 `ldr-busy-wanted` 的選項 ID／文案、本文題稿及候選版本；A 的期待對照 B 的實際做法，再反向對照，不能只比兩人的期待。暫不分享、不適用、沒有事件與不確定都不能換成分數。完整排查與審閱記錄模板見候選稿末段。

本輪只新增研究文件／候選資料，網站版維持 0.6.0、現有回合與資料庫不變。正式接入再轉成 `QuizDefinition`、核定遠距版本／結果規則、檢查完整雙人流程；不要直接將文件 `candidate` 改成產品 `ready`，或套用核心價值相近度。

已驗證：候選 24 題／3 段／8 篇來源的 JSON 與現有內容契約、文稿一致性及兩組配對選項；`npm run check` 的既有 58 項測試、`npm run build` 通過。沒有產品 UI 變更或新畫面驗收；來源部分僅讀摘要，認知訪談、心理測量及產品效果未完成。

### 0.6 完整雙人探索與計分

公開入口： https://between-us.forest-between-us.workers.dev/#/start/core-values 。它會建立完整 57 題雙人回合；原 `#/trial/core-values` 保留為不保存的單人探索。舊三題回合仍按原快照顯示三題，不改歷史答案；重新建立 core-values 才使用新 57 題。core-values-example 另保留三題工程示例，不在主題館增加第六個主題。

**這次改什麼與原因**：0.5 只有 57 題單人整理，雙人流程還是三題；0.6 讓完整內容使用既有保存、邀請與解鎖規則，結果增加原 19 類計分及使用者同意的探索性相近度。ready 表示功能可用；來源 candidate／research-informed 表示改寫證據狀態，兩者不互相取代。沒有新增會員或資料表，沿用 rounds.snapshot 和 participants.answers／submitted_at／revision。

重要檔案：

- `src/content/core-values.ts`：中性 57 題、六段原數值、19 類各三題、研究來源與 scoring 契約，工具版 0.3.0；來源 JSON 措辭仍 0.2.0。`quizzes.ts` 的 roundQuizzes 另含三題示例。
- `src/domain/quiz.ts`：驗證 57 題、19 類、數值 1–6、沒有重複或缺題的 scoring 契約。
- `src/domain/compatibility.ts`：scoreValues 算個人分數，compareValues 算雙人差距與相近度；只依回合快照，不讀最新題庫。
- `server/store.mjs`／`cloudflare/store.mjs`：保存快照、驗證身份與雙方提交，results 才呼叫計分。兩種 store 使用同一套算法。
- `src/components/RoundFlow.tsx`：建立、同意、保存隊列、跳過、逐題修改、提交、邀請與結果；ValueResults.tsx 顯示分數、19 類圖、來源／公式。
- `scripts/check-cloudflare.mjs`：用新的一輪虛構 A/B 驗證 57 題、缺答、保密、計分與鎖定，不讀既有私人回合。

**Request / Data Flow**：

1. StartRound／EntryForm 發 POST /api/rounds；store 固定完整 quiz（含 scoring）到 rounds.snapshot。
2. RoundPage 每次選答發 PUT /api/rounds/:id/answers，後端核對 snapshot 中合法選項與 revision；只有本人的 answers 回傳。畫面顯示已儲存後才算保存成功，失敗可重試；衝突需載入最新版。
3. POST submit 要求全部 57 題合法；A 提交後鎖定並產生邀請，B claim 後獨立保存。邀請 hasValueScore 只說明分享範圍，不傳答案。
4. GET results 先驗證本人憑證、兩人 submitted_at；未完成回 423，陌生憑證 401。解鎖後用 snapshot 的選項數值／映射計分，回 comparison（profiles、values、meanGap、score、ruleVersion）及真實答案。
5. SharedResults → ValueResults 顯示相近度與 19 類圖，再呈現 57 題並排。前端只呈現後端解鎖後回傳的結果，最近紀錄僅保存私人返回入口；真正答案在後端。

**計分規則 1.0.0**：原選項依明確 optionValues 對應 1–6，不能把 option ID 的次序當分數。每個價值平均＝對應三題平均；MRAT＝本人全部 57 題平均；centered＝價值平均 − MRAT。它描述相對於自己整體答案的優先程度，負數沒有好壞，也不能換成百分比。

本站公式：meanGap＝19 個 `abs(A.centered − B.centered)` 的平均；相近度＝`100 * (1 - meanGap / 5)`，呈現一位小數。19 類等權重，不合併成十類／四類／人生方向；5 是 1–6 量尺下平均絕對中心化差距的保守上界（單一類的差可以超過 5），不是研究得到的戀愛門檻。例如 meanGap 為 1 → 80；它不是「80% 成功率」。同一相對輪廓可來自不同原選項，故逐題答案另顯示。原 MRAT／中心化依作者計分文件，這個雙人換算由本站設計、使用者已選擇採用，沒有常模、優劣門檻或效果驗證。

缺答不補值，完整 57 題才能提交；這是產品流程規則，不冒充原工具缺答建議。任一人的 19 類分數都沒有相對差異時（數值誤差容許 1e-9）回 score:null／undifferentiated；頁面說明不代表錯誤或不合。相對分數沒有變異時給 100 會誤導，因此不給總分。19 類均值一樣，也可能由不同逐題答案產生，不只全選同一選項。

**故障排查**：

- 仍只有三題：先看是否為舊私人回合／core-values-example；本機 Node API 載入題庫後不會自動重讀，改共用題庫後需重啟自己的 dev／preview 程序；新 `#/start/core-values` 的建立頁應顯示 57。不要把舊答案搬進新回合或刪資料。
- 沒保存／重新整理少了答案：先看「已儲存」或錯誤、Network 的 PUT／revision。409 是過時更新或已鎖定，不以重建資料庫解決。先用自己的返回連結，不用邀請代替。
- 提交沒反應：確認所有 57 題都回答、沒有 pending／saveError；查看答案可直接跳到未答題。HTTP INCOMPLETE 是正常防護。
- 等待不解鎖：各自確認已提交，再按「更新完成狀態」；423 是尚未雙方完成。health 只確認 D1 連線，不能證明該輪已完成。
- 分數空白：若頁面解釋未分化，是正常 score:null；若有錯誤，依序查 snapshot.scoring.kind／version、57 題映射、optionValues、完整答案，再以工程假資料重現。不要在 log 或公開文件印出真實答案／返回憑證。
- 分數怪：核對原始平均、MRAT、centered、19 類 gap、meanGap，不只比相同選項數；例外涵蓋第 49 題翻譯待審。兩種後端均應依 snapshot 而非目前全域題庫。

安全診斷：`npm run check`、`npm run build`、`Invoke-RestMethod 'https://between-us.forest-between-us.workers.dev/api/health'`。`node scripts/check-cloudflare.mjs https://between-us.forest-between-us.workers.dev/` 會新增一輪工程 QA 回合，可驗證全流程，不輸出憑證／答案；本機可用 http://127.0.0.1:4180/。`--local-proof` 僅允許本機，暫存虛構返回連結到忽略的 .local/qa/core-values-proof.json，供 UI QA；不是收集朋友答案或測量研究資料。

**自行修改與版本範例**：只改結果標題，改 ValueResults，不動題庫版；改第 49 題，先另記來源差異、改寫與審查，更新 candidate／回合工具版本，不覆寫原文。若改算法，新建 1.1.0／2.0.0 規則並保留原 1.0.0 運算分支，同時升新回合版本；直接改原分支會讓舊回合結果改變，即使 snapshot.version 沒變。新選項／映射／規則須一起改 validateQuiz、scoreValues／compareValues、契約與測試；至少驗證手算、對稱、平移、不分化、缺答、舊快照與 Node/D1 解鎖邊界。回復程式也要保留已產生的 0.3.0 快照解析與規則；不能回到不支援新結果的舊版後宣稱資料遺失，先保留 D1。

**驗證紀錄 2026-10-08**：10 檔／58 項測試、一般與 Cloudflare 建置通過。包含作者映射、手算平均／中心化／公式、對稱、整體平移不變、缺答／不合法拒絕、不分化不給分、完整 A/B results 與舊三題 core-values 快照不追改。CLI 實際 native Node 匯入 JSON／TS 成功，本機 Worker HTTP QA 通過。瀏覽器用虛構 A/B 各完整操作 57 題：保存、稍後回答、缺答禁止、重新整理回第一個未答、確認／邀請／獨立加入／解鎖；雙方同為 74.3 / 100，顯示 19 類圖與 57 題並排。另 HTTP QA 輪為 73.9，不當作人類測量資料。390px 模擬沒有橫向溢出，恢復尺寸設定；工程頁沒有 Console error／warn。

Cloudflare 已發布版本 `8ff28816-2c5e-4ee3-a5e4-28fb098d9b42`；本次沒有 remote migration，不重建 D1；本機 cloudflare:dev 只套用本機模擬庫的 0001。部署後線上 check-cloudflare 回 CLOUDFLARE_FLOW_OK，實際驗證 57 題缺答／保密／計分；公開 start/core-values 顯示 57 題、答案與比較結果分享同意。本次線上留下兩輪虛構 QA，沒有讀既有私人回合；截圖 .local/core-values-pair-live.png 不提交。截圖 .local/core-values-pair-results.png 僅為虛構工程畫面，不提交。尚未驗證／完成：本地改寫及雙人公式測量效度、實體雙手機、人生方向、正式保存期限與刪除／遺失憑證找回；功能驗證不能替代這些。

### 單人核心價值探索（保留 0.5 的入口）

由主題介紹按「先自己探索（不保存）」，或開 [公開探索入口](https://between-us.forest-between-us.workers.dev/#/trial/core-values)。本機可開 `http://127.0.0.1:4173/#/trial/core-values`（先 `npm run build`／`npm run preview`）；開發模式使用 5173。網站目前為 0.6.0；此不保存入口自 0.5 保留，完整雙人請用 start 路徑。

重要位置：

- `docs/quizzes/core-values-pvqrr.json`：候選題幹 `prompt`、引導、六段選項與版本；原文 `portraits` 只用於追溯。
- `src/content/core-values-trial.ts`：`createCoreValuesTrial()` 檢查題庫，建立不含計分值／原文分支的試讀定義。
- `src/components/ContentTrial.tsx`：介紹、57 題單選、跳過、想再讀、整理／篩選與返回修改。
- `src/domain/trial.ts`：`summarizeTrial()` 只整理有效本人選項、未答與標記，不計分。
- `src/lib/routes.ts`／`src/App.tsx`：`trial` 路由與主題介紹入口；CSS 以 `trial-` 前綴整理。

資料只在頁面元件記憶體；不向 API 提交、不寫 localStorage、SQLite 或 D1。離開、關閉、重新整理會清除；同一頁返回修改仍保留。標記不自動傳給專案持有人，回饋時可只提供題號與難懂原因。未答包含跳過及尚未讀到的題目，不當成最低程度或零分。

排查順序：

1. **只有 3 題**：確認網址是 `#/trial/core-values`；`#/demo`／`#/start` 仍使用三題示例。若公開畫面仍舊，重新整理；不要清除雙人私人返回連結或回合資料。
2. **空白或「試讀資料不完整」**：先 `npm run check`；看轉換器的第一個錯誤與候選 `prompt`、題序、六段選項。不要回退到原文男女版或把候選標成 `ready`。
3. **改 JSON 後沒有更新**：開發模式有熱更新；4173 建置預覽需重跑 `npm run build`。公開版需 `npm run cloudflare:deploy`，push 不會發布。重新整理前提醒試讀者選擇會清除。
4. **整理不對**：依序查 `answers[questionId]`、合法 `optionId`、`flagged` 與 `summarizeTrial()`；跳過應顯示「未作答」，不補成某個程度。
5. **意外有雲端回合或最近紀錄**：確認新增功能沒有把試讀 ID 加入共用 `quizzes`，且 `ContentTrial` 沒有呼叫 `api.ts`／`history.ts`。試讀 ID 為 `core-values-pvqrr-trial`，後端不支援此 ID。

修改範例：要改作答引導，修改候選 JSON 的 `instructions`，同步內容閱讀稿與改寫／版本紀錄；不要改 `sourceInstructions` 冒充原文。變更試讀版面只需調整 `ContentTrial.tsx`／CSS，候選題庫版本不必跟著網站升版。相關驗證為 `npm run check`、`npm run build` 與手機版實際操作；工程通過不等於完成受試者訪談或測量驗證。

### 0.5 驗證紀錄（2026-10-08）

- `npm run check`：型別及 9 檔／50 項測試通過，包含候選題幹、原序、六選項、資料錯誤防護、跳過／無效選項、既有 Node 與 D1 雙人流程。
- `npm run build` 與 `npm run build:cloudflare`：通過。驗證後重建一般模式供本機 4173 預覽。
- 瀏覽器使用虛擬試答驗證：下一題、上一題、跳過、標記／取消標記、提前查看整理、篩選、跳回第 1／57 題、最後一題回整理、鍵盤方向鍵單選。
- 本人兩個選項／一個標記的整理顯示已答 2、未答 55、想再讀 1；返回修改保留選項與標記。重新整理回試讀介紹且清除試答；離開再進入也重建空白試讀。
- 檢查正常視窗與 390×844 手機模擬，六個原選項、清楚文字與原生表單皆可操作，手機沒有橫向溢出；頁面 Console 未見 error／warn。恢復暫時尺寸設定，試讀頁保留供使用者操作。
- 截圖 `.local/pvqrr-trial-preview.png` 僅為本機畫面證據，不提交。程式碼檢查確認試讀不引用 API／歷史保存模組；沒有新增資料表、migration 或實際回合。

尚未驗證：真實手機、完整無障礙稽核、研究用認知訪談、此改寫的測量等同性與正式結果比較。使用者已驗收介面；上面的工程／虛擬操作與介面驗收不當成學術驗證。公開部署結果見本文件最後的 0.5 發布紀錄。

| 想修改 | 位置與注意事項 |
| --- | --- |
| 名稱、首頁說明、流程文字 | `src/App.tsx`；網站標題另有 `App` 的 `document.title` 與 `index.html` |
| 題目與選項 | `src/content/quizzes.ts`；改 ID 會影響既有答案對應，正式版必須建立新版本 |
| 全站色彩／排版 | `src/styles.css` 的 `:root` 與對應 class |
| 主題配色 | `.theme-sage` 等 CSS 變數；新增 theme 要同步 TypeScript `Theme` |
| 插圖 | `src/components/Motif.tsx`；新增 motif 要同步 `QuizDefinition` |
| 新頁面 | `src/lib/routes.ts` 加路由，`src/App.tsx` 的 `Page` 加呈現，再補路由測試 |
| 後端 | `server/store.mjs` 的資料與授權、`server/http.mjs` 的 API 邊界，對照架構文件 |

例如想把主色改成更深的綠：先調整 `.primary` 的背景，再確認白字對比、hover、鍵盤外框與手機畫面，不只改首頁按鈕。

0.2 已有後端與 SQLite：實際邏輯在 `server/store.mjs`／`server/http.mjs`，畫面在 `RoundFlow.tsx`。例如新增一個有示例題的主題後，前端會熱更新，但 Node 題庫只在啟動時讀取；需停止並重開 `npm run dev`，新回合才會用新題庫，舊回合仍用原快照。修改後端也要重啟，不能只重新整理網頁。

Node 原生讀取的共用 `.ts` 檔需保留完整 import 副檔名，使用可抹除的 TypeScript 型別；不要直接加入需額外轉換的 enum 等語法。UI 的一般 `.tsx` 仍由 Vite 處理。

## 排查順序

### 服務無法啟動／連不上

1. 確認在專案根目錄，有 `package.json`。
2. `node --version`；至少 24.13（本次驗證 24.19.0）。
3. `npm ci` 安裝 lockfile 對應依賴，留意第一個錯誤。
4. `npm run dev`，以終端機實際顯示 URL 為準。
5. 若出現 5173 被占用，先看哪個程式持有，不要直接殺掉陌生服務：

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

本機整合啟動器使用固定 5173／8787，若占用需先確認是否為本專案先前的服務；不要終止陌生程序。調整連接埠需同步 `vite.config.ts` 的網頁／proxy、`scripts/dev.mjs` 的 API 與 `server/http.mjs` 允許來源，不能只改瀏覽器網址。檢查 HTTP 的安全指令：

```powershell
(Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing).StatusCode
(Invoke-WebRequest -Uri 'http://127.0.0.1:5173/api/health' -UseBasicParsing).Content
```

### 畫面空白／新增題目後壞掉

1. 打開瀏覽器開發工具 Console，先看第一個錯誤。
2. 若訊息含主題 ID、`找不到研究來源`、`題目 ID 重複`，檢查 `quizzes.ts`。
3. 執行 `npm run check`，型別錯誤指向 `quiz.ts` 的資料契約，測試錯誤指向內容一致性。
4. 若 URL 不對，試 `http://127.0.0.1:5173/#/`；未知頁面應出現返回入口。
5. 在 `App.tsx` 的 `Page`、`getQuiz()` 或 `Demo` 的 `onChange` 加斷點，查看主題 ID、題目 ID 與選項 ID。

0.2 的 API 已實作。若型別與題庫沒有錯，繼續查看下方「本機雙人後端排查」，不要只在前端改顯示數字。

### 答案「不見了」／下一題不能按

- 沒有選 radio 時，下一題刻意停用。
- 上一題與返回修改會保留當次選擇。
- 單人介面預覽重新整理仍會清除答案。
- 雙人回合保存成功後可重新整理恢復；畫面有儲存失敗時，請先重試，不要直接關頁。私人返回連結可找回，最近入口只是此瀏覽器的索引。
- 尚未對外部署，請使用測試答案；本機網址無法讓遠方朋友開啟。

## 本機雙人後端排查

1. **重現與辨認頁面**：`#/demo/...` 是不保存的單人預覽；`#/rounds/...` 才是雙人回合。先確認是否選錯入口。
2. **服務**：網頁能開、保存卻失敗，先查 `/api/health`，再看 `npm run dev` 終端機是否有啟動失敗、8787 占用或 `API_INTERNAL_ERROR`。API 不印 request／token／答案，避免 log 洩漏。
3. **請求**：瀏覽器 Network 核對 `/api/rounds/.../answers`、`status`、`submit`、`results` 的方法、HTTP 狀態與錯誤碼。不要把帶 Authorization 或私人網址的完整截圖轉傳。
4. **授權**：401 表示私人憑證與回合不符；邀請連結不能當私人返回連結。邀請已加入會回 409 `INVITATION_CLAIMED`。
5. **暫存**：`STALE_REVISION` 表示另一分頁已更新，畫面提供重新載入最新資料（會取代未保存選擇）。網路失敗則用重試儲存；等待「已儲存」再提交／離開。
6. **鎖定**：409 `ROUND_LOCKED` 是已提交的保護，不是存檔失敗。不能修改已提交答案；重測另開回合。423 `RESULTS_LOCKED` 表示兩人尚未完成。
7. **資料**：`rounds.snapshot` 固定題庫；`participants.answers` 是各自選項、`revision` 是修改序號、`submitted_at` 是鎖定與解鎖觀測點。先查這些欄位與 slot，再看呈現。

安全的唯讀計數指令（只輸出回合／參與者數，沒有答案與憑證）：

```powershell
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('.local/data/between-us.sqlite', { readOnly: true }); console.log(db.prepare('SELECT count(*) AS rounds FROM rounds').get()); console.log(db.prepare('SELECT count(*) AS participants FROM participants').get()); db.close();"
```

資料庫沒有建立時此指令會失敗，先確認服務曾成功建立回合。`user_version` 高於 1 時程式會停止，先使用對應新版本或規劃 migration，不能把版號寫回 1。

本機資料不自動刪除，也沒有重設／刪除 API。移除此裝置入口只改 localStorage，私人連結重新開啟會把入口加回。遺失所有入口與私人連結的自助找回尚未實作，不能保證從暱稱恢復。

## 保存與回復資料

`.local` 不入 Git，因此 commit／tag 只能保存程式，不能當作資料備份。修改資料庫結構前先正常停止服務（Ctrl+C），備份 `.local/data/` 到另一個不會覆寫原檔的位置；異常停止時若仍有 `-wal`／`-shm`，一併保留，不要只取走主資料檔。

回復時也先停止服務與保留現有資料，再恢復完整資料組，啟動相容程式；不在服務運行時直接覆寫 SQLite。不知道哪份正確時先保留兩份，勿遞迴刪除 `.local` 來「清乾淨」。本次瀏覽器流程留有虛構的測試身份與答案，不是朋友的真實測驗。

SQLite 目前只供單一 API 程序，不能把磁碟資料直接放進 Pages 或換成無持久磁碟的主機就認為會保存。部署平台、正式期限／刪除／撤銷規則另行定案。

### 中文字體或版面不同

1. Google Fonts 載入失敗會使用系統字體，功能仍應可用。
2. 檢查瀏覽器 zoom、視窗寬度，手機樣式在 640px 以下切換。
3. 若要移除外部字體，刪除 `styles.css` 第一行 `@import`，保留系統字體 fallback。
4. 在 390px 寬、200% 放大、長選項與純鍵盤操作下確認沒有橫向溢出。

## 修改後驗證

```powershell
npm run check
npm run build
```

再依修改內容做必要手動驗證：

- 主題篩選／介紹／直接連結與瀏覽器返回。
- 題目未選不可前進；上一題與摘要返回修改保留答案。
- 最後一題只顯示本人選擇，沒有伴侶假資料或分數。
- 研究來源能開啟，草題標示仍清楚。
- 手機版、桌面版與鍵盤焦點可辨識。

測試是維護的護欄，不能證明學術效度或未實作的後端存取安全。

## 回復與版本管理

可用 `git status --short` 查看變更、`git diff` 審查已追蹤文件、`git diff --cached` 審查已放入提交清單的內容。未追蹤的新檔案不會出現在一般 `git diff` 中；先逐檔查看再提交。

修正失敗先回復自己剛改的內容，勿使用整個專案的遞迴刪除或無差別 reset。`node_modules/` 和 `dist/` 是可再生成的產物；`.local/data/` 是需另保存的測試回合，不能當建置產物刪除。目前沒有部署服務或 Git remote。

## 提交與版本規則

### Windows 帳號與 repository 擁有權

本專案初始化與提交曾由不同 Windows 執行帳號操作，若 Git 顯示 `detected dubious ownership`，先確認正在操作的是你自己的這個專案。可對單一命令指定此目錄為可信，無須新增全域或萬用字元例外：

```powershell
git -c safe.directory=C:/Users/lydai/Desktop/forest status --short
git -c safe.directory=C:/Users/lydai/Desktop/forest log -5 --oneline
```

必要時同樣把 `-c safe.directory=...` 放在 `git add`、`git commit` 等指令的子命令前。它只對該次執行生效；搬移專案後先核對實際路徑，不直接信任陌生 checkout。本次使用限定目錄的命令成功提交，未更動全域 Git 設定。

### Commit 是存檔點，版號是交付里程碑

使用者希望完成大功能後有清楚的 commit 與版號。採用以下簡單規則：

- 每個完整、可驗證的功能或修正各自提交；大型功能可以分成能獨立理解與驗證的小階段。
- 小錯誤修正與文件也可以 commit，不需要等另一個大功能才保存。
- 準備交付一版時才升產品版號與寫 CHANGELOG；不要求每筆 commit 升版。
- 交付前同步完成實作、必要驗證與維護交接。
- 使用現有的 Git 作者設定，不自動更動全域作者身分。

本專案參考語意化版本的三段格式，但 0.x 屬開發期，下表是本專案產品里程碑慣例，不宣稱嚴格的公開 API 相容性保證。

| 變更 | 範例 | 版號方式 |
| --- | --- | --- |
| 基礎版本 | 主題館與作答示例 | `0.1.0` |
| 修正交付 | 修正手機選項溢出 | `0.1.0 → 0.1.1` |
| 新功能交付 | 完成雙人邀請與解鎖 | `0.1.x → 0.2.0` |
| 純文件整理 | 補充除錯步驟 | 通常不變 |
| 第一個完整正式產品 | 核定題庫＋雙人體驗＋上線驗證 | 規劃為 `1.0.0`；不是現在已完成 |

產品版本不是題庫版本。改樣式可能升網站修正版，但不改題庫；改題幹／選項／結果規則則更新該測驗 `version`。既有正式回合永遠使用原題庫快照。

### 一般提交流程

先執行 `npm run check` 與 `npm run build`（純文件改動通常只需檢查文件與連結），再依修改範圍做必要畫面檢查、更新文件。

```powershell
git status --short
git diff
```

使用 `git add -- <明確的檔案路徑>` 放入此次相關檔案，執行 `git diff --cached` 檢查，然後 `git commit -m '<描述這次目的>'`。初始 commit 應納入所有已核對的原始碼與文件；`.gitignore` 會排除私密設定與產物。

提交訊息可用簡單前綴：`feat:` 新功能、`fix:` 修正、`docs:` 文件、`chore:` 基礎設定。例：`feat: 完成雙人邀請與結果解鎖`。前綴只是閱讀慣例，不會自動升版或部署。

### 交付版號

例如準備交付 `0.2.0`：先確認目前工作目錄、此版內容與已有標籤，再執行下列改版指令（此為未來操作示例，本次沒有執行）：

```powershell
npm version 0.2.0 --no-git-tag-version
```

這會同步更新 `package.json` 和 `package-lock.json` 的網站版本，刻意不自動提交或建立 tag。接著更新 `CHANGELOG.md`、完成檢查，將改版資料與相關變更提交。最後在該交付 commit 建立對應 tag：

```powershell
git tag --list
git tag -a v0.2.0 -m '之間 0.2.0：雙人邀請與結果解鎖'
git log -5 --oneline
git status --short
```

Tag 是指向特定 commit 的版本標記。不可覆寫已交付 tag；tag 並不代表網站已部署。目前交付 v0.1.0～v0.6.0 到使用者指定的 tivico/between-us；日後只推送當次明確要交付的 tag，不把 `git push --tags` 當一般存檔操作。

### 壞掉時怎麼定位與回復

- 版號對不上：核對 `package.json` 與 lockfile 根套件版本，再看 CHANGELOG；不要任意改依賴套件的版號。
- Tag 指錯版本：`git show v0.2.0 --stat` 查看內容；已推送的標籤不要直接搬動，另建立修正版。
- 某次 commit 後出現問題：`git log --oneline` 找變更、`git show <commit>` 看內容。完整單一功能的提交比較容易縮小範圍。
- 如確認要撤回已提交的單一變更，先確保工作目錄乾淨、確認影響，再用 `git revert <commit>` 建立反向提交。不要直接對未保存的變更使用 `reset --hard`。
- 後端上線後，撤回程式碼不等於回復資料庫；資料變更需另有相容與備份策略。

版本格式參考：[語意化版本](https://semver.org/lang/zh-TW/)。

## 基礎建設交付驗證紀錄

2026-10-08，Node.js 24.19.0、npm 11.17.0：

- `npm install` 完成，產生 `package-lock.json`；安裝當下 npm audit 回報 0 個已知漏洞，這不是永久保證。
- `npm run check` 通過型別檢查與 2 個測試檔案／10 個測試。
- `npm run build` 成功，產出 `dist/`。
- 瀏覽器確認所有／可預覽／籌備中篩選分別為 5／1／4 個主題。
- 完成 3 題示例，核對個人摘要正確；未選題不能前進，上一題與返回修改保留選擇；重新整理後清除選擇。
- 研究依據 FAQ 展開成功；檢查當下瀏覽器未記錄程式 error／warn。
- 1280px 桌面視窗計算樣式為三欄，約 390px 手機視窗為單欄；量測頁面寬度沒有橫向溢出。
- 在一般窄版預覽視窗檢視首頁與插圖，截圖留於本機 `.local/home-preview.jpg`（不入 Git）。自訂視窗的截圖 API 不支援，此次桌面尺寸以 DOM／計算樣式核對，未完成桌面全頁截圖視覺審查。
- 基礎建設交付當下 Git 已初始化，尚無 commit 或 remote。之後依使用者要求整理提交與版本規則，建立 `0.1.0` 本機基準，詳見 `CHANGELOG.md` 與 Git 歷史。驗證用本機服務在檢查完成後停止，重新查看請執行 `npm run dev`。

尚未驗證／尚未實作：真實手機裝置、完整無障礙稽核、正式學術工具效度、雙裝置邀請、後端授權／資料庫／部署。現有測試不能替代這些工作。

## 0.2 雙人流程驗證紀錄

2026-10-08，Node 24.19.0：

- `npm run check` 通過型別檢查與 5 檔／31 項測試；新增後端存取、資料持久化、題庫快照、提交鎖定、單一邀請與最近入口測試。
- `npm run build` 成功。停止開發服務後，`npm run preview` 以 4173＋8787 啟動建置版並讀到原來 SQLite 的共同結果。
- 兩個瀏覽器分頁使用不同私人憑證與虛構身份，完成 A 建立、第一題暫存／重新整理恢復、提交、邀請、B 加入與完成、雙方解鎖及逐題比較。這是兩個身份的本機驗證，不是真實兩部裝置／遠距測試。
- A 的等待頁在 B 完成後自動更新；B 完成前頁面沒有 A 選項，測試確認 API 提前讀結果回 423，邀請不能當本人 token。
- 瀏覽器確認最近入口可讀，移除入口後私人返回仍能找回；再次開啟會重新加入列表。
- 桌面結果截圖與 390px 手機模擬排版均已檢視，手機答案區為一欄，頁面沒有橫向溢出；未記錄瀏覽器程式 error／warn。
- 開發 HTTP 直接下載 `.local/data/between-us.sqlite` 與 WAL 皆回 403；Git 忽略 `.local`。

尚待：真實手機／跨裝置、雲端授權與部署、正式保留／刪除／撤銷／找回規則、正式題庫、科普與契合度公式。工程測試通過不代表心理測量效度已驗證。

## GitHub 與雲端部署

0.3 已加入部署程式與設定，**程式已 push，網站尚未發布**。使用者指定的 [tivico/between-us](https://github.com/tivico/between-us) 為公開 repository；Pages 已使用 Actions＋HTTPS，後端服務仍待選定。不能只上傳畫面就把雙人保存當作已完成上線。

### 本專案已確認的設定

| 項目 | 現況 |
| --- | --- |
| Git remote | `origin = https://github.com/tivico/between-us.git` |
| 分支 | `main` 追蹤 `origin/main` |
| 版本標籤 | v0.1.0、v0.2.0、v0.3.0 已推送 |
| GitHub 帳號 | 本機專案設定 `credential.https://github.com.username = tivico`；只選帳號，不保存 token 至原始碼或更改全域設定 |
| Pages | `build_type = workflow`、HTTPS enforced，公開 |
| 預定網站入口 | `https://tivico.github.io/between-us/`；尚未發布，不是可試玩網址 |
| 後端／API_BASE_URL | 尚未選定／未設定；不能執行有效的雙人網站發布 |

原始碼修改與發布分開：

```powershell
git remote -v
git status --short
git push
```

先依前文提交修改，再 `git push` 推送 main。此動作會觸發 [Check project](https://github.com/tivico/between-us/actions/workflows/ci.yml)，不會自動發布 Pages。若失敗，先看 Actions 第一個紅色步驟與對應 log；修正、重新檢查後再提交／push，不能因 CI 失敗把測試移除。

若 Git 顯示無法選擇帳號／讀取 Username，先執行 `git config --local --get credential.https://github.com.username` 確認為 tivico，再使用 Git Credential Manager 的官方登入。這次指定帳號後即可使用既有登入，沒有另發 token 或新增 GitHub 插件。憑證過期時到 GitHub 登入，勿把 token 放入 remote URL、文件或 console。

### 元件與執行順序

1. `.github/workflows/ci.yml`：推送 main 或 PR 時自動 `npm ci → npm run check → npm run build`。CI 是自動檢查，不會發布。
2. `scripts/start-api.mjs`：後端主機執行 `npm start`，`server/config.mjs` 讀取明確設定，`http.mjs` 收請求，`store.mjs` 存 SQLite。不需要 Vite 提供正式 API。
3. `.github/workflows/pages.yml`：在 main 手動執行。取得 Pages 網址、跑測試、檢查 API 與 CORS，再依路徑建置、只上傳 `dist/`。
4. 瀏覽器的 `src/lib/api.ts` 讀取建置時的公開 API 網址，跨來源呼叫後端；前端最近入口仍只是索引，真正答案在主機資料庫。

### 後端主機設定

需支援 Node 24.13+、單一實例、持久磁碟與 HTTPS。建置／安裝可使用 `npm ci --omit=dev`；開始命令為 `npm start`，健康檢查為 `/api/health`。不以 `npm run preview` 當正式 API。

| 環境變數 | 範例與用途 |
| --- | --- |
| `DATA_FILE` | `/var/data/between-us.sqlite`；必須是持久磁碟上的絕對路徑 |
| `ALLOWED_ORIGINS` | `https://帳號.github.io`；不含 `/repository/` 或尾斜線，多個來源以逗號分隔 |
| `PORT` | 主機指定的埠；未指定使用 `8787` |
| `API_HOST` | 雲端預設 `0.0.0.0`；本機驗證可設 `127.0.0.1` |

Render 免費 web service 的 SQLite 會在重啟／重新部署／休眠後消失，也不能掛持久磁碟；保留此 SQLite 架構時需有磁碟的主機方案。Cloudflare Workers／D1 有不同執行與儲存方式，需要另外移植後端。平台選擇與付費建立需依使用者決定，不能宣稱所有方案都免費可用。[Render 官方限制](https://render.com/docs/free)

`npm start` 遇到缺少位置／來源會以 `API_START_FAILED` 結束，避免默默使用暫存資料。設定正確會印 `API_READY port=... mode=hosted-test`。雲端是全新資料庫；本機測試答案不會跟 GitHub 程式一起搬過去。不要上傳資料庫作為前端資產。

### GitHub Pages 設定

1. 原始碼推送至確認的 repository。若 remote 已有內容，先核對、整合，不 force push。
2. Repository → Settings → Pages → Source 選 **GitHub Actions**。
3. Settings → Secrets and variables → Actions → **Variables** 新增 `API_BASE_URL`，例如 `https://你的後端網域/api`。這是公開網址，不能填 token／金鑰。
4. 確認後端 `ALLOWED_ORIGINS` 包含 Pages 的 origin，例如 `https://帳號.github.io`。
5. Actions → **Deploy GitHub Pages** → **Run workflow** 選 `main`。工作流程依 Pages metadata 提供 `VITE_BASE_PATH`，不需將 repository 名稱寫死在程式。
6. `build` 先檢查後端回 `hosted-test`、CORS 精確 origin 及 OPTIONS 預檢；任一步失敗不會上傳／發布新版。成功後由 deploy job 顯示實際 URL。
7. 用兩部裝置、虛構答案測試建立、邀請、提交前不可互看、共同結果及重新開啟。重啟後端後確認紀錄仍在，再記錄實際上線 URL／commit／日期。

首次上線仍需補核對雲端備份、公開網站實際權限與資料保存規則。三題自編示例可供流程試玩，不能包裝成正式學術三觀測驗。

### 部署壞掉的排查順序

- 畫面空白、JS／CSS／favicon 404：先看 Actions build log 與 `dist/index.html`。`/<repository>/assets/...` 要符合實際 Pages 網址；不要只改瀏覽器 URL。
- 點建立顯示連不上保存服務：DevTools → Network 找 `/api/rounds`。若網址仍是 `github.io/api/...`，`API_BASE_URL` 缺少或尚未重建；若是正確 API，查後端健康狀態。
- 預檢／請求 403 或 CORS 錯誤：看 OPTIONS 的 Origin 與後端 `ALLOWED_ORIGINS`，比較完整的協定＋網域＋埠，不把 `/repository/` 塞進來源。錯誤回應也需有允許來源標頭，才能讓前端顯示 401／409 的實際原因。
- API 回 401：檢查是否本人私人返回連結、是否打到同一資料庫；不能把邀請 token 當本人 token，也不要將 token 貼進 log。
- 重啟後全找不到紀錄：查 `DATA_FILE` 路徑與磁碟掛載、是否換成全新資料庫／多實例。先停寫並備份舊磁碟，再恢復相同檔案；不可刪庫讓服務「正常」。健康檢查通過不能證明磁碟持久化。
- Pages workflow `HOSTED_API_CHECK_FAILED`：先確認後端網址可用、回 `{ok:true,mode:"hosted-test"}`，再檢查 CORS。缺少後端時停止部署是預期結果。

可安全查詢健康狀態，不包含答案或憑證：

```powershell
Invoke-RestMethod 'https://你的後端網域/api/health'
```

修改範例：更換 API 網域時，更新 GitHub variable `API_BASE_URL`，在主機確認 `ALLOWED_ORIGINS`，再手動重跑 Pages。改 variable 不會修改已發布的 JavaScript。切換資料位置時，先停止 API、備份完整 SQLite 檔案／WAL，再更新 `DATA_FILE` 並恢復；不要直接把位置改到空目錄。撤回前端發布不等於恢復後端資料庫。

### 0.3 驗證紀錄

2026-10-08，Node 24.19.0：型別檢查與 7 檔／40 項測試通過；包含不安全部署網址、缺少磁碟設定、CORS 預檢與跨來源 Bearer 授權。一般建置與 `/between-us/` 子路徑建置成功，JS／CSS／favicon 均保留子路徑。未設定雲端 API 時發布檢查以非零狀態停止，符合預期。

瀏覽器用 `127.0.0.1:4174/between-us/` 網頁跨來源呼叫獨立 `127.0.0.1:8790` API，虛構 A／B 完成建立、暫存、邀請、加入、提交與共同結果；1 題相同、2 題不同，選項與兩人輸入一致。邀請／返回連結保留 `/between-us/`，沒有瀏覽器 error／warn。使用獨立 `.local/deployment-test.sqlite`，沒有搬移或修改既有試玩資料庫。這是本機跨來源驗證，不是真實 Pages／雲端／遠距驗證。

尚未驗證：公開 Pages 網站、雲端 HTTPS 與磁碟、付費方案、兩部實體裝置。GitHub Actions 的後續實測見下段；測試通過不能視為已完成公開部署。

### GitHub 接線驗證紀錄

2026-10-08：遠端原先沒有分支，普通 push 成功建立 main 及 v0.1.0～v0.3.0，沒有 force push。GitHub 的 [Check project run 37728077077](https://github.com/tivico/between-us/actions/runs/37728077077) 對 `5bfa3e1` 回 `completed / success`，實際驗證了 GitHub runner 的安裝、40 項測試與建置。Pages API 重新讀取確認 `build_type=workflow`、`https_enforced=true`、`public=true`，尚無已發布狀態。後端未指定，沒有觸發 Pages deploy。此前「尚未驗證 GitHub Actions」的紀錄已由此次驗證補足；真實 Pages 網站、雲端與跨裝置仍待測試。
## Cloudflare Workers＋D1（0.4）

目前已上線：[之間 Between Us](https://between-us.forest-between-us.workers.dev/)。Worker 名稱 `between-us`，D1 名稱 `between-us`；account_id 與 database_id 已填入 wrangler.jsonc，這兩項不是管理金鑰。GitHub 是程式碼來源，Cloudflare 提供實際網站與資料保存；不要再建立同名 D1、上傳本機 SQLite 或啟動 Pages workflow。

以下首次部署已完成，只有另建一套環境才需執行：

```powershell
npx wrangler login
npx wrangler d1 create between-us
```

登入頁由本人確認 Authorize，無需將密碼或管理 token 傳給其他人。本次使用 `npx wrangler login --device --browser=false`，因一般登入回傳 localhost:8976 時連線失敗；裝置授權不需本機回呼。Wrangler 管理 OAuth 憑證，存於使用者設定區而非專案。把 create 顯示的 `database_id` 填入 `wrangler.jsonc` 的 DB binding；現有環境已填妥。多帳號時先 `npx wrangler whoami` 確認，再設定正確 account_id；不可部署到不確定的帳號。

```powershell
npx wrangler d1 migrations apply between-us --remote
npm run cloudflare:deploy
```

第一次 migration 在空資料庫建立兩張表。之後部署程式不會自動刪除或重建 D1。新增資料表／欄位要新增下一份 migration、備份並評估舊版本相容性，再套用；不要編輯已套用的 0001。`cloudflare:deploy` 先 check 與 Cloudflare build，再上傳 Worker 和 dist；發布 URL 以 Wrangler 的實際輸出為準。現有 Pages workflow 不需啟動。發布後可執行 `node scripts/check-cloudflare.mjs https://實際網站/`：它會建立一輪虛構測試資料，驗證 HTTP 與答案保護，不會讀既有回合，也不輸出私人憑證；每次執行會留下該輪 QA 資料。

本機 Cloudflare 驗證：`npm run cloudflare:dev` 建置、套用 local migration，提供 `http://127.0.0.1:4180`。它與原本 5173／4173 的 Node SQLite 是不同資料庫；Ctrl+C 停止不清除資料。`npm run check` 另使用 Miniflare 暫時庫測試競爭加入、過時保存與互看權限。Miniflare 5 使用官方 `convertV4MiniflareOptions` 介面；sharp override 固定在 0.35.5 修補版本，更新工具時先檢查 override 是否仍需要。

壞掉時依序排查：

1. 空白／資產 404：重新執行 `npm run build:cloudflare`，確認 dist/index.html 與 assets；Cloudflare 使用根路徑與同來源 API，別沿用 Pages 的 VITE_BASE_PATH／外部 API 設定。
2. 無法保存：瀏覽器 Network 看 `/api/rounds`，安全查 `Invoke-RestMethod 'https://實際網站/api/health'`。正常應為 `ok:true, mode:cloudflare-test`；健康檢查會實際查 D1。
3. 500：查 DB binding 的 database_id 與 migration；`npx wrangler d1 migrations list between-us --remote` 檢查是否套用。`npx wrangler tail` 看 `API_INTERNAL_ERROR`，不要列出私人 token／答案。
4. 401：確認用本人返回連結，且連到同一網站／資料庫；邀請連結不等於本人權限。409 是邀請已使用、答案鎖定或其他分頁已更新，依畫面操作重新載入，不以清資料解決。
5. 423：兩人未都提交，這是預期保護。若兩人都聲稱完成，先查各自畫面的已提交狀態，勿跳過後端檢查。

修改範例：新增核定題目時改 `src/content/quizzes.ts` 並升該測驗版本，跑 check，再 cloudflare:deploy；新回合才採新內容，舊回合使用既有 snapshot。如果變更 API 欄位，需一起改 src/domain/round.ts、RoundFlow、Node store、D1 store 與相關測試。

回復：程式故障可回復已驗證的 Git commit 後重建部署；資料庫仍維持原 D1。已變更 schema 時先評估舊版相容性，不直接切換舊程式或覆寫資料。正式使用前仍需另定資料期限、刪除／撤銷、找回與備份規則；目前三題是自編試玩示例。

### 0.4 上線驗證紀錄

2026-10-08：46 項測試、一般／Cloudflare 建置、dry-run、本機 Worker HTTP 雙人流程與起始頁排版通過。GitHub [CI run 37730772724](https://github.com/tivico/between-us/actions/runs/37730772724) 對程式里程碑 `608eb3a` 為 completed/success，包括 Miniflare 測試與 Worker dry-run；未把 OAuth 憑證放進 GitHub。

遠端 D1 建於 APAC，0001_rounds.sql 已套用，migrations list 顯示無待套用項目。Worker 版本 `37c5a2b7-0acb-4091-b03c-a9c7f5475762` 已發布（100% 流量）。新網址初次發生 TLS／QUIC 連線失敗，稍後正常連線，沒有關閉 TLS 驗證。公開 /api/health 回 200 與 cloudflare-test；check-cloudflare.mjs 以虛構 A/B 驗證建立、保存、邀請、陌生憑證 401、雙方完成前 423、提交後 409 與共同真實選項。公開首頁在瀏覽器正常顯示。雲端留有一輪虛構 QA 資料；本機既有答案沒有上傳。

尚未驗證：兩部實體裝置、長期運作／流量、正式題庫與分數。後續一般修改只需 `npm run cloudflare:deploy`，不重跑 create；資料庫結構有新增 migration 才套用 remote migration。推送 GitHub 目前只做 CI，不會自動發布網站。

### 0.5 發布紀錄（2026-10-08）

使用者驗收後，普通 push 將 main 與 v0.5.0 推至指定 repository；功能 commit 為 `d047d7e818a8ff8fdc2a481cff0b7b2ae0ce05a3`。[GitHub CI run 37752512199](https://github.com/tivico/between-us/actions/runs/37752512199) 對此 commit 回報 completed/success。發布狀態文件另用 docs commit 保存，網站與題庫版號不因文件更新再升版。

一般建置與 `npm run cloudflare:deploy` 通過；發布指令執行型別檢查、9 檔／50 項測試、Cloudflare 建置，再上傳 Worker／dist。Wrangler 回報新 Worker 版本 `b3b952ee-2cd6-4302-8624-6a8f3a773c7c`，網址仍為 https://between-us.forest-between-us.workers.dev/ 。本次沒有 schema 變更，沒有套用 migration 或重建 D1。

公開瀏覽器驗證 `#/trial/core-values` 的 57 題入口、六選項、標記與本人摘要：虛構第一題選「像我」並標記，摘要為已答 1／未答 56／想再讀 1，且顯示實際選項。重新整理回介紹；重新進入為已答 0，頁面 Console 無 error／warn。截圖 `.local/pvqrr-trial-live.png` 是線上畫面證據，不提交到 Git。`node scripts/check-cloudflare.mjs https://between-us.forest-between-us.workers.dev/` 回 `CLOUDFLARE_FLOW_OK`，實際驗證健康、三題回合建立／保存／邀請、401／423／409 保護及共同選項；雲端另留一輪虛構 QA 回合，沒有讀取既有私人答案。

發布資料流：GitHub main／tag 保存來源 → CI 驗證 → 本機 `cloudflare:deploy` 產生 dist 並上傳 → Worker 的 ASSETS 提供網頁 → 試讀元件在當頁記憶體整理答案；既有 `/api/*` 由 Worker 讀寫 D1。公開試讀可以分享網址，每個人獨立作答；此入口尚不建立 57 題雙人回合。

維護範例：改試讀版面後先 check／build，再提交與 push，最後執行 cloudflare:deploy；只 push 會看到 GitHub 更新、網站仍是舊版。若部署後顯示三題，先核對 trial 路徑再重新整理；若 API 異常先查 `/api/health`、DB binding 與 Wrangler tail。故障時可從先前已驗證 commit 重建再發布；本次 D1 schema 未變更，仍需保留原資料，不以刪除 D1 止血。

已驗證：公開 0.5 試讀、既有雙人 API、CI 與發布。尚未驗證／完成：兩部實體裝置、研究用認知訪談、改寫測量等同性、正式計分、57 題雙人流程與人生方向區塊；介面驗收不代表這些項目已完成。

### 0.5.1 文案修正與維護（2026-10-08）

使用者實際供自己與伴侶使用，要求主流程不必標示「試讀」。本次改為「核心價值探索」，保留自然的作答、跳過、答案整理與「想再想」標記。研究開發與測量狀態仍記在候選文件與可展開的「研究來源與說明」，不因此將候選資料改成 ready。

重要位置與資料流：`src/App.tsx` 管主題入口、頁首與瀏覽器標題；`src/components/ContentTrial.tsx` 管介紹、按鈕、答案整理與來源說明；`src/content/core-values-trial.ts` 產生探索定義與來源。網址仍是 `#/trial/core-values`，App 仍渲染 ContentTrial，候選 JSON 轉換為中性題幹／六選項，再由 React state 與 summarizeTrial 整理本人選項。沒有新增 API、migration 或保存；trial 是內部名稱，保留它讓原連結繼續有效。

維護範例：只改「開始探索」按鈕，可改 ContentTrial 的文字；若改主題入口則一起改 App。品牌／介面文案只升網站修正版，題幹、作答引導、選項或計分規則才另升題庫版本。不能為了改顯示名稱重建資料庫或把試讀 ID 放入雙人 registry。

除錯：仍看到「試讀」先核對部署網址、重新整理與最新 Worker；畫面文字的定位用 `rg -n '試讀|試答' src`，檢查 UI 而不是直接全域替換，內部錯誤訊息、測試名稱與歷史研究紀錄可保留。標記／整理錯誤則查 answers、flagged 與 summarizeTrial；網站空白看 Console，再跑 npm run check。

驗證：50 項測試、一般／Cloudflare 建置通過；本機虛構選「像我」並標記，摘要仍為已答 1／未答 56／標記 1，題幹與六選項未改。公開入口已顯示新標題與「開始探索」，研究來源可展開且保留改寫測量限制，Console 無 error／warn。發布 Worker 版本 `b26587fb-9830-4f36-955c-aa74cebc3e94`，截圖 `.local/core-values-exploration-live.png` 不提交。資料庫結構與 API 未修改；正式計分、57 題雙人回合及改寫測量驗證仍待完成。

### 0.6 GitHub 與發布查核

功能 commit `702cd196bb46d401f940d31f78b74b5f4f9f19a8` 與 v0.6.0 已推送。[GitHub CI run 37759825630](https://github.com/tivico/between-us/actions/runs/37759825630) 回 completed/success，包含 58 項測試、兩種建置與 Worker dry-run。後續 test/docs commit 補強線上 smoke check：先保存 56 題，實際檢查 INCOMPLETE 與恢復草稿，再補完第 57 題、完整雙人流程與結果；公開檢查再次通過。這只加強 QA 腳本／發布交接，不改已發布網頁／API，因此網站與標籤仍為 0.6.0。

本機原生 Node 的 store／JSON／TS 計分匯入已直接執行確認，回 questions:57、values:19；獨立 4180 模擬器完成後已停止，4173 一般建置已恢復。只有忽略的本機虛構 QA 資料，沒有搬移使用者本機答案到雲端。
## 0.13 一起生活的選擇：本機接入

2026-10-14：持有人要求接續下一步，本機接入12題。網站0.13.0、來源候選0.1.0、回合工具0.2.0、描述性規則1.0.0；未推送／部署，公開網站仍0.12.0。題幹／選項保持已同意版本，結果規則採候選閱讀設計落實為V1；內容同意、工程驗證與人類理解／測量／提案效果驗證分開。

### 使用與檔案分工

執行 `npm run dev`，開啟 `http://127.0.0.1:5173/#/start/money-life`。各自12題，A提交後邀請B，雙方提交後解鎖；本機連結限此電腦。單人 `#/demo/money-life` 不保存或分享。

- `docs/quizzes/money-life-candidate.json`：題幹、選項、來源及閱讀設計；contentApproval保留原同意範圍，implementation記錄本次接入。候選Markdown同步可讀題稿，humanTryoutCount仍0。
- `src/content/money-life.ts`／`moneyLifeQuiz`：轉換來源為工具0.2.0；`quizzes.ts`註冊money-life。ready只代表功能開放，不是量表驗證；公開發布依下方發布查核。
- `src/domain/quiz.ts`／`validateQuiz`：檢查12題分類、特殊狀態、配對方向、8則提案與版本，禁止條件／本人範圍混入偏好或配對。
- `src/domain/money-life.ts`／`analyzeMoneyLife`：V1分析。本人條件、範圍及討論起點都不判同／不同；只有三題偏好與兩組雙向配對可比較主要選項。
- `server/store.mjs`／`cloudflare/store.mjs`：Node SQLite與D1保存、授權及解鎖，僅results呼叫分析；`MoneyLifeResults.tsx`顯示摘要、各類閱讀、提案、來源與完整答案。

### 實際資料流

1. `#/start/money-life`同意分享 → `POST /api/rounds`：store讀registry並將題目、規則和提案固定在`rounds.snapshot`（回合快照，指建立當下的內容副本）。
2. `RoundFlow`使用`ConversationOptions`選答 → `PUT /api/rounds/:id/answers`保存`participants.answers`與revision（修訂號，用來拒絕過時覆寫）。未分享是直接用`not-shared`取代該題原ID，沒有另一份隱藏答案。
3. `POST /submit`檢查完整合法12題並鎖定 → A得到邀請 → B經`POST /api/invitations/claim`獨立加入／作答／提交。
4. `GET /api/rounds/:id/results`先驗證私人憑證與雙方`submitted_at` → `analyzeMoneyLife(snapshot,A,B)` → `moneyLifeAnalysis` → `MoneyLifeResults`。status只傳自己的答案與對方提交狀態；邀請只帶公開`hasMoneyLifeAnalysis`旗標，不帶對方答案或分析。

分類輸出：`boundaries`一題、`constraints`兩題、`processes`兩題的state均null；`preferences`三題主要選項才same／different；`pairs`為01期待對另一方02自述、08期待對另一方07自述，各有A←B、B←A。特殊狀態context、advice／discussion:null；兩人都other也不能判同類。ID是選項名稱，不是數值；本人不參加／不集中不被相同偏好覆蓋。摘要只引用本輪生活優先／分攤選項，情境與提案另標本站設計，不猜人格或財務狀況。

沿用既有表，不需migration，不搬移或重建D1；既有主題與舊快照不變。沒有外部AI、金融操作、金額欄位或付款／帳戶授權。

### 症狀與排查順序

- **入口仍寫準備中**：先確認本機服務是本工作目錄0.13，重啟`npm run dev`；公開網站應有12題入口；若仍舊版，先重新整理再核對下方Worker與資產版本。安全查核：`rg -n 'moneyLifeQuiz|money-life' src/content/quizzes.ts src/content/money-life.ts`。
- **無法提交／保存失敗**：先重現未答或修改後保存，檢查畫面「已儲存」及API回應。`INCOMPLETE`代表仍有缺題；`INVALID_ANSWERS`查題ID／選項ID；修訂衝突重新載入本人返回頁再修改；不要刪實際回合資料讓驗證通過。
- **結果鎖住／讀不到**：401先確認使用自己的私人返回連結；423先確認雙方已提交，這是正常保密；分析快照錯誤再查moneyLife.version、12題分類、配對選項與提案完整性。不要把私人連結、token或實際答案貼到log／issue。
- **配對方向反了／拒絕被解讀為不合**：先展開結果原答案，核對01←02、08←07的參與者角色，再查crossPairs與moneyPerspective；constraints／boundaries必須state:null。兩種store結果都須用snapshot，不可用getQuiz抓新題庫。
- **未分享仍露出舊選項**：確認該題目前保存值是not-shared，重新整理檢查本人頁及解鎖原答案。未分享取代目前答案，不是完整歷史／備份永久刪除功能。
- **畫面顯示不了生活整理**：檢查`moneyLifeAnalysis`與`RoundFlow`結果分派；改完程式先check／build，再看長暱稱、手機卡片、完整12題展開。

### 自行修改與回復

例：想把「把用途與各自負擔的部分寫清楚」改得更白話，在JSON的money-confirm-do／money-confirm-want同改written-scope標籤，核對expense-confirmation.adviceByWanted.written-scope與Markdown，保留兩題同一語意ID。題幹／選項變更另記新內容同意範圍與來源版，並升moneyLifeQuiz工具版；只改提案也升工具版，讓新回合取得新版。網站交付修正升最後碼、新功能升中間碼，同步package／lock／CHANGELOG。

改比較算法另新增分析版本及分支，保留analyzeMoneyLifeV1與舊資料，不直接覆寫V1。新規則要重新驗證特殊狀態、方向、本人條件與舊快照；不能把不能負擔改成分數低、把未知當同意。若功能異常，可在保留既有結果分支下暫停新輪入口；不重建／刪除資料庫。需要回復版本時先保存工作，再用既有commit的程式版本重新建置；公開回復另依發布流程。

### 驗證紀錄與限制

`npm run check`的110項測試通過：含180組主要／特殊配對、分類邊界、缺答／非法版本拒絕、Node與D1保存／取代未分享、授權／提交保密及快照不追套。沙箱測試初次遇TEMP快取缺檔／localhost EACCES，將TEMP／TMP設在忽略的`.local/tmp`並於允許本機連線的環境執行後通過；這不是修改題庫解決測試。

本機工程A／B回合已實際操作12題、提交、邀請、沒有經歷、未分享取代與結果重載，完整答案展開12卡。桌面結果已視覺檢查，截圖位於忽略的`.local/qa/money-life/desktop.png`，不含私人連結。手機約390px的DOM布局（網頁元素及尺寸）查核無橫向溢出，卡片落在視窗內；瀏覽器在尺寸覆寫時無法擷取截圖，手機視覺截圖未驗證。工程驗收回合明示測試用途，未冒充使用者／伴侶答案，未刪既有資料。`npm run build`與`npm run build:cloudflare`通過；一般建置仍提示主JS超過500kB，此提示不阻擋建置，本次未做拆包。

初次本機交付時尚未驗證公開0.13；後續發布查核見下節。真人理解、測量或交流改善效果仍未驗證。

### 0.13 GitHub與公開發布查核（2026-10-14）

持有人直接要求「push+發佈」，本節上方的未發布狀態為初次本機交付歷史。功能commit為60a87c1；補上部署檢查後，發布來源為 **95ffdbfbf29caf2ef8b880f7e2cb820faa58f4e0**，main與新v0.13.0已普通推送，未改remote或force push。[GitHub CI 38496413381](https://github.com/tivico/between-us/actions/runs/38496413381)對應此來源，completed/success，包含110項測試、一般／Cloudflare建置與Worker dry-run。後續發布紀錄為文件／來源狀態metadata，不改題幹、選項、工具／規則或V1，不需重部署或移動tag。

已執行`npm run cloudflare:deploy`（check → Cloudflare建置 → Wrangler deploy），發布至原between-us Worker，版本 **20105ec6-0911-4af0-ab90-01402b5ca4c3**，DB仍為between-us／c7694cfa-1d1b-47e9-9379-6cd08812947a。未執行migration、重建D1或上傳本機SQLite。[公開12題入口](https://between-us.forest-between-us.workers.dev/#/start/money-life)與[主題介紹](https://between-us.forest-between-us.workers.dev/#/topics/money-life)可讀；公開HTML與JS `/assets/index-BkBBnVKb.js`、CSS `/assets/index-hjLu5Xw7.css`逐檔SHA-256與此次dist相符。健康API回200／ok:true。

公開驗證：check-money-life.mjs的混合／全未分享兩輪通過，含12題完整保存、缺答拒絕、未分享取代、兩組各雙向配對、本人不參加與不集中單獨保留、沒經歷方向advice:null、完整結果一致、401／423／409及no-store。公開結果頁與全未分享頁已讀取，後者沒有個別提案；瀏覽器Console未見error／warn，截圖位於忽略的`.local/qa/money-life/public-results.png`。手機視覺截圖限制仍同上方本機驗收記錄，不聲稱已補驗。

續驗check-communication、check-daily-values、check-cloudflare（57題核心價值）、check-long-distance及check-questionnaires全部通過，八組問答各有GROUP_OK。共新增17輪明示部署QA（生活2／溝通2／日常2／核心價值1／遠距2／問答8），只操作本次自建回合，不讀取／刪除既有使用者答案；這些工程回合不計humanTryoutCount。返回憑證不打印，不提交到Git，--qa-proof只存忽略的.local。研究／測量／提案效果未驗證的界線不變。

重新發布的實際流程：先確認git status與版本 → check／build／build:cloudflare → Worker dry-run → 普通push main與新版本tag → 核對該commit的GitHub CI → cloudflare:deploy → 健康／公開資產／新主題與既有流程驗證 → 補發布紀錄commit並push。GitHub push只做CI，不會自動更新Cloudflare網站。

自行重跑新主題驗證（會新增兩輪明示工程QA，不讀既有回合）：

```powershell
node scripts/check-money-life.mjs https://between-us.forest-between-us.workers.dev/
```

看到MONEY_LIFE_FLOW_FAILED先查`/api/health`、部署Worker版本、資產與CI來源，再依上方授權／缺答／revision排查；不要用真實返回連結做部署測試。一般建置仍提示主JS超過500kB，但已通過，不是500 API錯誤。

發布前版本為42dbb12d-e964-4f78-8d5c-045fdf2257fc（0.12）。若需止血，優先在保留0.13快照解析／分析的程式中暫停新輪入口並重新發布；直接退回0.12會缺少已產生的money-life結果支援，因此不能當無損回復。保留原D1，不刪新舊回合；後續新規則另加版本與分支。
