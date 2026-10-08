# 維護與除錯

## 第一次啟動

```powershell
cd C:\Users\lydai\Desktop\forest
node --version
npm ci
npm run dev
```

終端機顯示 Local URL 後開啟；手機版可先用瀏覽器裝置模擬。`127.0.0.1` 只供此電腦使用；0.6 公開網址已有完整 57 題雙人邀請與結果；單人探索與舊三題另保留。

`npm run dev` 同時啟動網頁 5173 與 API 8787；需要 Node 24.13 以上。SQLite 固定在 `.local/data/between-us.sqlite`；單人預覽／內容試讀不保存，雙人回合會保存。公開部署與本機資料獨立，詳見下方 Cloudflare 章節。

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

### 遠距戀愛候選內容（2026-10-08）

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
