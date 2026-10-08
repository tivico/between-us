# 架構與資料流程

## 0.8 遠距雙人分析（分支，未公開部署）

`src/content/long-distance.ts` 將研究原稿 24 題及分析設定變成共用 QuizDefinition；`quizzes.ts` 在前端、Node、D1 載入同一份內容。新增的是描述性 analysis，與核心價值 scoring 分開；analysis 只允許已知 kind／version，驗證題號、特殊選項和提案參照。候選原題 0.1.0、回合工具 0.2.0、規則 1.0.0、網站 0.8.0 分別管理。

```text
POST rounds → rounds.snapshot（含 analysis 與提案模板）
PUT answers → 本人保存／revision
POST submit → 完整合法選項／提交鎖定
A 邀請 → B 獨立提交
GET results → authenticate → 雙方 submitted_at → analyzeDistanceV1(snapshot)
           → pairAnalysis → SharedResults → LongDistanceResults
```

Node／D1 的 results 在原授權與提交保護後呼叫同一個純函式；status／InvitationPreview 不含 pairAnalysis 或對方答案。InvitationPreview 的 hasPairAnalysis 只表明將分享的結果種類。無新增資料表、migration、會員、外部生成服務或額外答案傳輸。

規則 1.0.0：14 題偏好各做 A/B 相同／不同選項；忙碌與支持各做 A 期待對 B 自述做法、B 期待對 A 自述做法；見面做同一人的期待對可行條件，獨立放 conditions。近期經驗、討論狀態、特殊及彈性選項保留 context，不產生分數或心理判定。suggestions 最多六項，引用 finding.evidence（slot、題號、題幹、實際選項）及來源 ID；排序是編輯安排，所有模板取快照。

畫面保留共同點／差異展開、條件區塊、建議的觸發說明與概念來源、完整 24 題並排。暫不分享表示有效選項但無可比較偏好，對方可見「暫不分享」選項；未答仍不能提交。沒有分析規則的舊快照不追套新 registry；未來算法新增版本與分支，保留 V1。具體維護與已驗證範圍見 [0.8 Runbook](runbook.md#08-遠距雙人探索與個別建議)。


## 0.7 了解關係與科普短卡

公開閱讀流程：網址 #/learn 或 #/learn/:id → parseRoute → App.Page → relationshipArticles / getRelationshipArticle → RelationshipLibrary / RelationshipArticlePage。文章在建置時打包，不發 API，不讀寫 D1、SQLite、localStorage 或私人答案；不要求測驗或登入。目錄捲動到段落標題並移動鍵盤焦點，不改 hash，避免破壞路由。

src/content/relationship-articles.ts 保存文章版本、段落種類、來源 ID、DOI／全文入口、方法與閱讀範圍。研究與本站例子／聊天提案分開顯示；第一批三篇各使用一項直接相關的原始研究，不宣稱系統性回顧。文章畫面在 RelationshipPages.tsx，手機與桌面排版在 styles.css。

結果短卡依既有結果解鎖流程顯示：SharedResults → ValueResults → ResultLearningCards；coreValues 指定價值閱讀卡，noScore 區分無總分說明，一般舊回合只顯示通用回應卡。卡片不計分、不根據分數高低判定關係，文章連結可獨立分享。網站升 0.7.0，文章各為 1.0.0；測驗快照與比較規則版本不變，沒有資料庫 migration。詳細維護見 docs/runbook.md 的 0.7 章節。

## 現況：完整雙人探索與結果計分

React + TypeScript + Vite 前端，以及本機 Node＋SQLite／雲端 Workers＋D1，仍在同一個專案。0.6 已公開部署完整 57 題雙人核心價值探索、19 類計分與探索性相近度，沒有會員。保留單人探索及三題示例；單人探索不建立回合或保存答案。

```text
index.html
  → src/main.tsx（React 入口）
  → src/App.tsx（App / Page）
  → src/lib/routes.ts（解析網址 hash）
  → src/content/quizzes.ts（依 ID 取主題）
  → src/domain/quiz.ts（載入時檢查資料）
  → Catalog / Topic / Demo（形成畫面）
```

`quizzes.ts` 匯入時會執行 `validateQuiz()`，檢查題目／選項 ID、面向、來源參照等；有錯直接拋出錯誤，避免破損題庫靜默顯示。這是資料完整性檢查，不是學術驗證，也不是後端安全檢查。

### 頁面

| URL | 元件／行為 |
| --- | --- |
| `#/` | `Catalog`：主題列表與篩選 |
| `#/topics/core-values` | `Topic`：主題介紹、面向、研究來源 |
| `#/demo/core-values` | `Demo`：示例作答與個人答案 |
| `#/trial/core-values` | `ContentTrial`：57 題候選試讀、跳過、標記與本人選項整理 |
| `#/start/core-values` | `StartRound`：分享說明、暱稱、建立回合 |
| `#/rounds/<id>/<privateToken>` | `RoundPage`：暫存／確認／等待／結果 |
| `#/invite/<invitationToken>` | `JoinRound`：邀請預覽與 B 加入 |
| `#/history` | `HistoryPage`：此瀏覽器的最近入口 |
| 不存在的主題或不支援的路徑 | `NotFound`：提供返回入口 |

目前用 hash 路由，路徑切換不向後端索取頁面。私人／邀請 token 放在網址 `#` 片段，不隨一般 HTTP URL 傳到網頁服務；需要操作資料時明確透過 JSON 或 Authorization 傳給 API。不是可以公開轉傳的憑證。

### 預覽作答資料

```text
點選原生 radio
  → Demo 的 answers[questionId] = optionId
  → 下一題 / 上一題（index）
  → 三題完成（finished）
  → 依 questions 找回選項文字並呈現
```

答案只在 `Demo` 的 React state（元件記憶體）中。無 `localStorage`、cookie、網路提交與持久化；重新整理或離開該元件即清除。返回修改仍在同一個元件中，選擇會保留。沒有任何另一人的示例答案或計分。

### 57 題內容試讀（0.5）

```text
docs/quizzes/core-values-pvqrr.json（候選 0.2.0）
  → src/content/core-values-trial.ts / createCoreValuesTrial()
  → src/lib/routes.ts 的 trial 路由
  → src/App.tsx / Page → ContentTrial.tsx
  → answers、flagged、index、phase（本頁記憶體）
  → src/domain/trial.ts / summarizeTrial()
  → 本人選項、未答與想再讀清單
```

轉換器只將中性 `prompt` 與六段選項 ID／文字帶入畫面，不選取原文男女分支、不提供計分值或逐題面向。載入時核對 57 題原序、中性題幹與六段選項完整性；錯誤直接報出，防止靜默回退到帶性別的原文。此檢查屬內容完整性，不是量表效度。

試讀 ID 為 `core-values-pvqrr-trial`，不在共用 `quizzes` 陣列，不能建立雙人回合；既有 `core-values` 仍為三題示例及原版本。試讀只在 React state 保存答案與題號標記，沒有 API、localStorage 或檔案寫入。跳過保留為未答，整理函式也將無效選項視為未答，沒有補值或分數。未作答題數可能包含尚未閱讀的題目，不表示試讀者拒答。

主題介紹與首頁卡片提供清楚的 57 題試讀／3 題雙人試玩入口。作答與整理頁都不顯示面向分類、逐題計分或針對第 49 題的預期意思，避免提前查看整理後影響後續試讀。整理頁可跳回任一題、取消標記或只看未答／標記題；不生成另一人的答案。

### 建置流程

`npm run build` → `tsc --noEmit` → `vite build` → `dist/index.html` 與前端資產。`dist/` 不納入版本管理。React StrictMode 會在開發時重複執行部分檢查；未來副作用必須可重試，不能因此建立兩個回合。

## 技術取捨

- 一個前端專案，方便持有人理解與維護。
- 內容為型別化 TypeScript 資料，不做管理後台與 CMS。
- 目前只有單選題，不預先堆疊所有題型。
- 使用手寫 CSS 與 SVG，色彩／版面可直接修改，不依賴大型元件庫。
- 前端骨架不先選資料庫供應商；雙人流程需要真正後端，不能以同機暫存冒充跨裝置分享。
- 首頁的研究資料是公開內容；個人答案未來絕不可包進前端靜態題庫或 build 資產。

## 免會員保存與找回（0.2 本機已實作）

採後端保存＋每位參與者每輪的私人返回連結，瀏覽器另外保留此裝置最近紀錄入口。裝置入口被清除不等於後端資料被刪除；換裝置可使用保留的私人連結。尚未定義全部歷史的跨裝置找回或遺失憑證恢復，不假定無會員可保證恢復。

```text
填答 → 後端驗證本人 → 保存本人草稿／提交答案
  → 私人返回入口＋此裝置最近紀錄
  → 再次開啟 → 後端重新驗證 → 繼續填答／等待／查看已解鎖結果
```

私人返回與邀請憑證分離。每輪每人有 32 隨機位元組的私人 token，由瀏覽器 `crypto.getRandomValues` 產生；後端只存 SHA-256 雜湊。API 以 `Authorization: Bearer` 驗證，初次建立／加入以 JSON 傳送本人 token。A 提交後的邀請以不同用途的 HMAC 衍生並只存雜湊，重啟後仍能由 A 的憑證產出相同邀請。

`src/lib/history.ts` 將最近 20 個回合的 ID、本人 token、主題、暱稱與日期保存到 localStorage；不保存答案。這些入口本身含存取權，因此共用此瀏覽器的人也能開啟。localStorage 儲存失敗時，畫面要求另存私人連結。移除索引不刪除後端答案，再次開啟私人連結會重新加入。

目前不使用 cookie，也沒有帳號層的完整歷史找回。`5173` 開發與 `4173` 建置預覽使用同一 SQLite，但瀏覽器索引因不同 origin 分開；將私人連結改到正在使用的本機服務入口即可讀取同一後端紀錄。0.3 已測試跨來源 HTTP／授權邊界，真實 Pages 與雲端仍待部署後實測。本機測試資料不隨原始碼推送，也不自動匯入雲端。

### 真正的雙人請求流程

```text
RoundFlow.tsx（選答／提交／加入）
  → src/lib/api.ts（JSON／Bearer）
  → Vite 的 /api 代理 → 127.0.0.1:8787
  → server/http.mjs（來源、方法、大小、格式）
  → server/store.mjs（授權、快照、完整性、交易）
  → .local/data/between-us.sqlite
  → 只回本人資料／完成狀態；兩人完成後 results 才回雙方答案
```

作答畫面先更新本地選擇，以序列佇列逐次保存完整草稿與 revision（修改序號），不讓較慢請求覆蓋較新答案。保存未成功時會提示並阻止提交。不同分頁的過時修改回 `STALE_REVISION`，使用者可明確重新載入最新資料；不靜默覆蓋。

等待頁每 10 秒在可見狀態查詢，也可手動更新或在回到視窗時更新。結果從後端讀取真實兩人答案，沒有第二人的假資料或契合分數。

## 科普內容與結果的連結（基本分工已確認，技術設計尚未實作）

獨立科普頁與結果短卡的基本分工已確認。技術上建議先以原始碼內的同一份內容管理，不引入 CMS 或 AI 即時產文。內容的具體欄位與畫面仍待設計；以下是資料流提案，現在沒有對應文章模組：

```text
研究來源與主張紀錄
  → 已審查的科普文章（文章 ID＋版本＋短說明＋完整內容）
    → 獨立科普頁
    → 本輪固定結果規則依主題／面向選用短卡 → 連到同一篇完整文章
```

文章關聯只能表示「這個概念與題目相關」，不能視為題目已測出該心理概念。若依答案差異觸發科普卡，需保存可解釋的條件與適用範圍；尚未驗證的單選題不可推斷依附型態或診斷。

科普來源修訂時，影響結果解讀的內容應隨結果版本固定，既有紀錄需能核對當時說明；一般完整文章可更新並顯示修訂日期。實際快照粒度於結果功能開發時定義。

## 本機雙人後端（0.2 已實作）

目前採單一 Node 程序與 SQLite 連線；`scripts/dev.mjs` 一次啟動網頁與 API。只監聽本機 `127.0.0.1`，不是公開部署服務。正式託管平台仍待選。

### 資料生命週期

| 資料 | 角色 |
| --- | --- |
| `rounds` | 回合 ID、主題 ID、完整題庫 JSON 快照、建立時間、邀請雜湊 |
| `participants` | 回合＋A/B 席位、私人雜湊、暱稱、同意／提交時間、答案 JSON、revision |

選用兩張表與小型 JSON 草稿，避免目前規模預先分出多個服務／題目／答案表。每輪固定完整快照，修改公開題庫不改舊回合。A/B 的複合唯一鍵與 slot 限制保證最多兩席；token 雜湊全域唯一。未來需要查詢、內容管理或更細粒度更新時再評估拆表。

SQLite `user_version = 1`；啟動時遇到更高版本會停止，不覆寫。資料沒有自動期限／刪除；目前僅供測試答案。將來正式推出前仍需核定到期、撤銷、刪除與找回行為並提供 migration。

「雜湊」是把憑證轉成不可直接還原的驗證值；資料庫不要保存原始私人 token。私人連結持有人即有該參與者的存取權，不能當一般邀請連結轉傳。

### API 意圖

| 操作 | 驗證與回傳原則 |
| --- | --- |
| `GET /api/health` | 本機服務狀態，不提供任何答案 |
| `POST /api/rounds` | 建立 A、同意與題庫快照；此版本接受有題目的 draft／ready，planned 拒絕；相同 A 憑證重試不新增 |
| `PUT /api/rounds/:id/answers` | Bearer 驗證本人未提交草稿；核對快照內題目／選項及 revision |
| `POST /api/rounds/:id/submit` | 必須完整作答；交易內提交鎖定，A 同時產生邀請雜湊；重試不改完成時間 |
| `GET /api/invitations/preview` | 邀請 Bearer 只讀主題、邀請者暱稱、題數與是否已加入；沒有 A 答案 |
| `POST /api/invitations/claim` | JSON 邀請、B 私人憑證及分享同意；原子占用 B 席位，拒絕第三人，相同 B 可重試 |
| `GET /api/rounds/:id/status` | 本人答案與雙方完成狀態，peer 永遠不附答案；A 提交後才附邀請 |
| `GET /api/rounds/:id/results` | 驗證此回合的 A／B，雙方提交後才回雙方答案，否則回 423 |
| 刪除／到期 | 待確認分享回合的刪除權、保存期限；確認後一併定義 API 與畫面 |

交易（transaction）讓一組更新一起成功或一起失敗。此版本使用 `BEGIN IMMEDIATE`，搭配同步 SQLite 操作避免加入／提交的中間狀態。預期錯誤使用 `INVITATION_CLAIMED`、`ROUND_LOCKED`、`STALE_REVISION`、`RESULTS_LOCKED` 等代碼；JSON 最大 32 KiB，拒絕非允許來源，不開放廣泛 CORS。

### 解鎖原則

```text
A 同意並提交 + B 同意並提交
  → 後端檢查且完成鎖定
  → 結果可讀
```

目前每位參與者的畫面狀態由資料推導為 `answering → waiting → unlocked`；提交時間與兩席是服務端權威，結果每次讀取都重新驗證。`expired/deleted` 尚未實作。隱藏按鈕無法代替資料授權。

結果原則上依固定版本的答案與計分規則確定性生成，不需要 AI API。名目選項不做數值距離；量表計分依核定方法。尚未分享或未答不能視為一致。

三觀「契合度」是結果呈現名稱，正式公式尚未核定；未來應區分「本人量表計分 → 雙人相近程度比較 → 畫面與文字」三層，核心價值與人生目標各自解讀。題庫、原計分、比較規則及影響解讀的文案版本需可追溯；不在前端用任意常數產生分數。詳見三觀藍圖第 8 節與研究文件。

### 私人連結與資料保護

- 邀請與返回憑證用足夠隨機的 token，不能靠遞增回合 ID 取得權限。
- 選定後端後決定安全的交換方式（例如 token 換取 HttpOnly cookie）；憑證不放一般分析、網址追蹤、console 或伺服器 log。
- 結果頁避免分析工具取得私人網址；私人／邀請憑證在 hash 中，index.html 與本機回應設定 no-referrer，不將憑證寫入 log。
- 資料庫限制每個回合兩個席位；存取規則應測試 A、B、陌生人與提交前後。
- `.env` 不入 Git。任何 `VITE_` 變數會打包到瀏覽器，不能放管理金鑰。
- 保存期限與刪除機制是正式版本交付前必須定義的產品行為。
- `.local` 被 Git 忽略，Vite 的 `server.fs.deny` 也拒絕直接下載資料庫／WAL；正式建置只含前端，不包含 SQLite。

技術參考：[Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)、[Vite 代理設定](https://vite.dev/config/server-options.html#server-proxy)。本機流程已驗證，正式上線仍需 HTTPS、允許來源、頻率限制、備份、撤銷與保存規則。

## Cloudflare 雲端架構（0.4）

已選用 Workers＋D1，2026-10-08 已發布至 https://between-us.forest-between-us.workers.dev/ 並驗證完整 API 雙人流程。Workers 接收 HTTP 並提供 `dist/` 靜態網頁，D1 是 Cloudflare 管理的持久 SQL 資料庫；沒有會員也能保存每輪答案，權限來自私人返回憑證。下方 0.3 的 Pages＋獨立 Node 主機做法保留作為替代方案，現在不需執行。

```text
瀏覽器 → src/lib/api.ts → 同一網址 /api
  → cloudflare/worker.mjs（Origin、JSON 大小、Bearer、路由）
  → cloudflare/store.mjs：D1RoundStore（身份、答案驗證、兩人提交判斷）
  → DB binding → D1 rounds / participants
  → 只回本人狀態，或雙方已提交的共同答案 → RoundFlow.tsx
其他網址 → ASSETS binding → dist 網頁
```

`wrangler.jsonc` 指定 Worker 入口、資產目錄與 D1 ID；ID 是公開資源識別碼，不能以私人憑證代替。`cloudflare/migrations/0001_rounds.sql` 建立回合與兩席資料表，首次發布前套用。題庫依舊共用 `src/content/quizzes.ts`；建立回合時保存完整快照，所以新題目不影響舊答案。

D1 為非同步操作，不能照搬本機的同步 `BEGIN IMMEDIATE`。建立回合使用 `batch()` 交易，失敗會連同新 round 回滾；加入邀請靠 `(round_id,slot)` 唯一鍵只允許一位 B。保存使用 `UPDATE ... WHERE revision=? AND submitted_at IS NULL` 避免過時更新覆蓋答案；提交同樣核對 revision，A 的邀請雜湊與提交一起寫入。每個 API 請求使用 `first-primary` session，維持讀寫順序。未同時提交時結果 API 回 423，不傳對方答案。

`npm run build:cloudflare` 以 cloudflare mode 顯示雲端保存文案。API 固定同來源 `/api`，不需 Pages 的跨來源設定。`public/_headers` 與 API 均設 no-referrer；私人 token 仍放 hash、透過 Authorization 呼叫，資料庫只保存雜湊。OAuth 由 Wrangler 管理，不進 Git、VITE 變數或前端。

本機 `npm run dev` 仍使用 `server/store.mjs`＋原 SQLite；`npm run cloudflare:dev` 另使用 `.wrangler/state` 的 D1 模擬庫。雲端是獨立資料庫，不自動上傳本機實際答案。兩個 store 必須維持相同 API 契約；改提交規則時兩者與測試一起更新。

官方參考：[Worker 靜態資產與 API](https://developers.cloudflare.com/workers/static-assets/binding/)、[D1 batch 交易](https://developers.cloudflare.com/d1/worker-api/d1-database/)。

## GitHub 部署準備（0.3 替代方案）

使用者已指定公開的 [tivico/between-us](https://github.com/tivico/between-us)。origin、main 上游與 GitHub 帳號選擇已設定，程式與 v0.1.0～v0.3.0 已推送，GitHub CI 已通過。Pages 已設為 Actions 發布來源與 HTTPS；後端主機／API 網址尚待選定，沒有執行 Pages 發布。GitHub 保存原始碼／前端，後端主機另選。

```text
push main / PR → ci.yml → npm ci → check → build（只檢查）
main 手動執行 pages.yml
  → configure-pages 取得 origin / base_path
  → check → check-hosted-api.mjs（健康狀態＋允許來源＋OPTIONS）
  → build（VITE_BASE_PATH、VITE_API_BASE_URL）
  → 僅上傳 dist → GitHub Pages
瀏覽器 → src/lib/api.ts → HTTPS API
  → http.mjs（明確 CORS＋Bearer）→ store.mjs → 持久磁碟 SQLite
```

`VITE_API_BASE_URL` 為公開的 `https://後端網域/api`；本機留空時沿用 `/api` 代理。`VITE_BASE_PATH` 控制 CSS、JS 與 favicon 位於 `/` 或 `/<repository>/`；hash 與邀請連結沿用目前 pathname，所以 Pages 子路徑不會丟失。兩項設定在建置時固定，改 GitHub variable 後要重新發布。

`npm start` 執行 `scripts/start-api.mjs`，`readHostedConfig()` 要求明確的 `DATA_FILE` 絕對路徑與 `ALLOWED_ORIGINS`，預設監聽 `0.0.0.0:8787`。主機提供 HTTPS，API 程序提供 HTTP。`DATA_FILE` 必須位於主機持久磁碟，維持一個 API 實例；目前不是分散式資料庫，不支援多副本擴展。不能將 `.local` 資料推送 GitHub 或用會被重啟清空的磁碟存答案。

CORS 是瀏覽器跨網站呼叫時的允許規則。`ALLOWED_ORIGINS` 是 `https://帳號.github.io`，不含 repository 路徑。API 只回這個精確來源，不用 `*`，不使用 cookie／Allow-Credentials；JSON 與 Bearer 請求先以 OPTIONS 預檢。CORS 不取代私人憑證授權，命令列仍可呼叫公開 API，答案保護繼續由 store 執行。

正式主機未選，Node API 可使用具持久磁碟的平台；Render 免費 web service 不能保留 SQLite。若改 Cloudflare Workers＋D1，需要另外移植儲存與 HTTP 執行方式，不能直接執行此 Node server。設定與排查步驟見 [維護手冊](runbook.md#github-與雲端部署)。

原始碼公開範圍與網站公開範圍分開：私人 repository 不保證 Pages 網站私人，GitHub Free 的 Pages 要使用公開 repository，私人來源支援依帳號方案核對。現有三題是試玩示例；期限、刪除／撤銷／找回規則仍未定稿。

官方參考：[GitHub Pages 的性質與方案](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite Pages 設定](https://vite.dev/guide/static-deploy.html#github-pages)、[Render 免費服務限制](https://render.com/docs/free)。本機已驗證不代表真實雲端已驗證。

## 0.6 完整題庫、固定計分與解鎖結果

`src/content/core-values.ts` 從候選 JSON 取得共用中性題幹、六選項數值與作者 19 類各三題對應，先驗證題序／映射；回合 QuizDefinition 版本為 0.3.0。`quizzes.ts` 的可見 quizzes 有五主題，roundQuizzes 另含 core-values-example。native Node 匯入 JSON 使用 import attributes 的 `with { type: 'json' }`，共用 TS 匯入維持 .ts 副檔名；不把原始來源檔帶入資料庫。

流程：`#/start/core-values` → EntryForm 同意分享答案與比較結果 → POST /api/rounds → Node/D1 store 將包含 scoring 的 quiz 寫入 rounds.snapshot → RoundPage 每次選答 PUT /api/rounds/:id/answers 寫 participants.answers／revision → POST submit 核對全部 57 題並鎖定 → A 取得邀請 → B claim 後獨立填答 → GET results 先驗證身份與兩人 submitted_at，再 compareValues(保存的 quiz, A answers, B answers) → 回 comparison → SharedResults／ValueResults 渲染分數、19 類圖與逐題並排。status 的 peer 仍只有暱稱與提交狀態，邀請新增 hasValueScore 只用於說明分享範圍，沒有答案或比較結果。

`scoring` 快照含 kind、規則 version、optionValues 與 19 類 questionIds；因此新題庫不追改舊回合。compareValues 對沒有 scoring 的三題舊快照回 undefined，維持舊答案比較；有不支援版本或破損映射會失敗，不能靜默用最新規則。新版 schema 沒有變更，既有 snapshot/answers TEXT 可保存新增契約，雲端 D1 不重建。

結果規則與數學、例外與除錯詳見 Runbook「0.6 完整雙人探索與計分」。新增規則版本時需保留原 1.0.0 分支，因已保存的結果仍需可重現；單改原函式會改掉舊結果，即使資料庫中的 version 沒變。
