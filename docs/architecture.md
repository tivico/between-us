# 架構與資料流程

更新：2026-10-14。本機與公開0.15.1，原D1已套0002；0.14／0.15功能及時間基準修正已合併公開。這份文件描述現在的架構；各版本操作／發布證據留在[Runbook](runbook.md)與CHANGELOG。

## 單一專案、兩個儲存實作

React＋TypeScript＋Vite提供網頁，hash路由讓子頁可直接開啟。沒有會員、CMS、ORM、微服務或大型狀態套件。本機Node原生HTTP＋SQLite；公開Cloudflare Workers同來源提供網頁／API，D1持久保存。兩個資料庫獨立，不搬移本機實際答案到雲端。GitHub保存程式與CI，push不自動部署；Pages workflow僅保留為替代方案。

## 載入與內容來源

`src/content/quizzes.ts`及各主題模組是完整registry，Node原生TS匯入保留.ts副檔名。題目來源及提案與共用回合流程分開，建立回合保存完整snapshot，不以最新registry重解舊答案。文章在relationship-articles.ts，不讀私人回合。

0.15的`generate-catalog.mjs`只從registry生成公開ID、標題、狀態、題數、主題旗標與文章標題到quiz-catalog.json，不含題目、答案或計分配置。App.tsx先載入這份輕量摘要與首頁，進入探索／回合才懶載入ExplorationPage；文章另載入LearningPage。完整題庫沒有刪除，PageBoundary在區塊下載失敗時提供重新整理。dev與兩種build先生成catalog，check確認它與registry一致；不手動改生成JSON。

## 雙人請求

```text
App / ExplorationPage → RoundFlow → api.ts（JSON、Bearer、no-store）
  → 本機Vite /api代理 → server/http.mjs → RoundStore → SQLite
  或同來源 /api → cloudflare/worker.mjs → D1RoundStore → D1
  → status只回本人資料／peer狀態
  → results在授權、未到期、未退出且雙方提交後回雙方答案及分析
  → buildResultOpeningV1 → ResultOpening → 原完整報告
```

API入口驗證Origin、JSON、32KiB長度及方法；跨來源CORS不取代Bearer授權。SQLite只適用單一Node實例與持久磁碟；雲端不能帶入node:sqlite。D1以first-primary session、batch交易與條件SQL再次核對revision／token／退出／期限，Node用BEGIN IMMEDIATE。

前端選答序列保存完整草稿與revision，過時更新不能覆蓋。保存失敗提示並阻止提交，更換連結前需保存成功，退出不受存檔錯誤阻擋。等待與已解鎖頁定期讀狀態，退出／失效會清除共同畫面，載入序號阻止舊請求覆蓋新狀態。已讀或另存內容無法收回。

| API | 授權／效果 |
| --- | --- |
| GET /api/health | 公開、no-store；檢查DB與生命週期欄位，Worker另確認限流binding，回網站版／schema，失敗503 |
| POST /api/rounds | 同意、有效主題與本人token；先做建立突發限流，固定snapshot與expires_at |
| PUT /api/rounds/:id/answers | 本人未提交、合法選項、revision；特殊未分享取代目前選項 |
| POST /api/rounds/:id/submit | 完整提交與鎖定；A同時建立邀請雜湊，可安全重試 |
| GET /api/invitations/preview | 邀請憑證只讀公開主題／分享範圍／加入狀態，不含答案 |
| POST /api/invitations/claim | 同意、B本人token、邀請；兩席唯一鍵／條件INSERT，不能第三人加入 |
| GET /api/rounds/:id/status | 本人資料／對方提交狀態；另一方退出時closed，只讀本人 |
| GET /api/rounds/:id/results | 本人、期限、退出與雙方提交；依snapshot生成主題分析及固定摘要閱讀層 |
| POST /api/rounds/:id/withdraw | 明確確認、本人授權；清除本人答案／暱稱，撤銷邀請，永久關閉共享 |
| POST /api/rounds/:id/rotate | 新憑證雜湊取代舊值，A同時換邀請；不改答案、快照或期限 |

## 資料生命週期

Node schema2；D1依0001／0002 migration，不能改已套用檔案或重建D1。`rounds`保存id、quiz_id、snapshot、created_at、invite_hash、expires_at；`participants`保存席位、token_hash、暱稱、同意／提交時間、答案、revision、withdrawn_at、previous_token_hash。新回合180天，既有NULL先保留，不回溯；Node啟動／每24小時及Worker每日UTC19:00清理到期資料，存取到期即拒絕。

token以32隨機位元組產生，原始值只在本人網址片段／瀏覽器入口與API授權傳遞，資料庫只存SHA-256。邀請與返回分開；previous_token_hash僅作更換請求重試證據，不能授權讀取。退出只保留最少撤銷標記，原答案清空；另一方保留本人資料。啟用退出後不能回復缺少這些檢查的0.13服務。

localStorage只存最近20個返回入口，不存答案；共用瀏覽器可開啟入口，移除入口不刪後端。單人探索和聊天引導只用React記憶體。Vite拒絕.local、.wrangler、SQLite及加密備份；這些資料不進Git／dist，VITE_只放公開網址。

## 分析與版本

核心價值19類MRAT中心化、0–100相近度及回饋各用固定V1；共同優先須雙方高於本人平均，未分化不排序。face因第49題來源差異不生成敘事，原數據／計分保留。遠距、溝通、日常、生活及四題問答各有自己的分析，名目ID不計分，條件／本人界線不要求一致或折衷。所有分析只在results解鎖後依snapshot執行，特殊狀態不硬湊一致／差異／提案。

result-opening.ts的buildResultOpeningV1只摘已生成分析，標version1.0.0／origin:reading-layer；整體理解及每卡都有slot、questionId、prompt、label依據。未來改算法另加版本與分流，保留V1；純網站版號不一起改所有QuizDefinition.version。沒有外部生成服務。

## 維運與恢復

operations.mjs共用安全事件欄位、服務版本、來源網路短期雜湊與Node限流。Worker用原生Rate Limiting binding，按節點、非精確全域配額；Node不信任X-Forwarded-For。只限制建立，30次／60秒為突發門檻。觀測只留操作種類、狀態、固定錯誤碼、耗時和服務代碼，不記URL／IP／headers／payload。Worker關閉invocation_logs，避免自動寫入完整請求網址；API_MAINTENANCE=true可停止API存取，資產仍能提供。

health.yml每小時只讀公開健康／首頁／資產，三次短重試失敗才使job失敗，無憑證、不建立回合。已push且workflow為active，本次尚無首次schedule紀錄；GitHub schedule不是即時SLA，可能延遲或停用，通知由帳號設定決定。

D1 Time Travel可讀備份書籤已確認；實際保留窗口依方案，這輪不做remote restore。Node一致性備份用sqlite.backup，AES-256-GCM＋scrypt加密，密語不放參數／Git；還原只寫新隔離檔，要求最新停寫狀態，套回退出、token更換、邀請和期限，移除最新狀態已不存在／已到期的回合。沒有最新可信撤銷狀態時不放行，不拿舊備份重新開API；復原與回復程式是不同操作。詳見[維護與演練](runbook.md)。
