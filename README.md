# 之間 Between Us

給各種性向與性別認同的兩個人的探索網站，提供主題測驗與雙人問答。各自回答，再一起了解彼此重視什麼、期待什麼，以及有哪些話值得聊。

**現況：本機0.15.0，公開0.13.0。** 公開網站提供完整57題核心價值、遠距、溝通、日常三觀、生活探索、八組四題問答與三篇關係文章。[開啟公開網站](https://between-us.forest-between-us.workers.dev/)。空間界線仍為候選，人生方向仍待設計；工具開放不表示中文改寫／自編內容或交流效果已驗證。

本機0.14新增情境導引、可追溯摘要與180天保存／本人退出／連結更換；0.15整理現況與第49題來源查核，補建立突發限流、安全日誌、健康監測設定、加密備份還原與頁面分包。兩版**尚未推送、部署或套用remote migration**，不能把本機新功能當成公開已提供。[操作、發布前置及除錯](docs/runbook.md)。

## 核心內容與現況總覽

更新日期：2026-10-14；本機程式版本 `0.15.0`；公開 `0.13.0`。以下依目前原始碼與發布／續驗紀錄整理；發布狀態見各版本交接。產品目的是「讓兩個人更了解彼此，讓答案成為對話」，不替兩人決定是否適合交往。

| 核心區塊 | 使用者得到什麼 | 目前狀態與界線 |
| --- | --- | --- |
| 雙人核心價值探索 | 各答 57 題，雙方提交後先讀結論／共同方向／差異與具體聊法，再展開 19 類、相近度與逐題選項 | 0.10 已公開發布；中文中性改寫、本站指標與聊天提案效果仍待驗證 |
| 了解關係 | 三篇文章：價值觀測驗、感受到的回應、遠距日常；結果附延伸閱讀短卡 | 已實作，既有紀錄確認公開發布；研究發現、生活例子與本站聊天提案分開標示 |
| 保存與返回 | 免會員、後端保存、本人私人返回連結、此裝置最近 20 個入口 | 0.14本機新增180天期限、本人退出／清除及連結更換；既有回合先保留，無帳號找回；公開仍0.13規則，最近入口不等於跨裝置歷史 |
| 維運與載入 | 只讀健康檢查、建立突發限流、安全錯誤代碼、加密備份與隔離還原、首頁分包 | 0.15本機驗證；GitHub排程／雲端日誌與限流尚未發布啟用，效能量測為工程模擬 |
| 主題館 | 六個可見主題，查看介紹與來源 | 核心價值、遠距、溝通與日常三觀已公開；生活金錢0.13已公開發布；空間界線仍為規劃 |
| 單人探索／預覽 | 先了解題型與自己的選擇 | 保留獨立入口；57 題單人探索不保存、不計分，不能替代雙人回合 |
| 雙人問答：更認識你 | 八題組各四題，每輪一組；雙方提交後看共同選擇、不同想法與個別／雙人提案 | 0.9 已實作，發布證據見維護手冊；自編內容未驗證，不提供分數 |
| 遠距，也靠近 | 24 題：日常分享、回應支持、見面與未來；共同點、差異及討論建議 | 0.8 已公開發布；自編題庫、描述性分析與建議效果仍未驗證，沒有契合分數 |
| 好好說，也好好聽 | 24題：自己的做法與希望收到的方式，12組雙向配對與可選提案 | 0.11開放，已整合進0.12 main；原創內容／效果未驗證、不計分 |
| 一起生活的選擇 | 12題：本人願意範圍、現實條件、偏好、討論起點與兩組雙向配對 | 0.13已公開發布；原創內容／提案未驗證、不計分 |
| 日常三觀探索 | 八情境各四步：做法、理由、重要程度與接受範圍 | 0.12公開發布；保留溝通與其他已開放主題，不提供契合數字 |

人生方向仍待設計，不能併入目前核心價值相近度。生育不在範圍；所有性向與性別認同都能使用，不依身分選題或計分。網站功能開放、研究有依據與工具已驗證是三件不同的事。

2026-10-12 已確認新增獨立的 [日常三觀探索](docs/product.md#日常三觀探索2026-10-12)：從生活取捨、選擇理由與接受範圍了解彼此，保留既有 57 題核心價值探索。八情境已接入0.12，題庫／整理規則1.0.0；計分未核定，不提供契合數字。

目前雙人路徑：**選主題 → 同意分享／建立回合 → A 填答與提交 → 邀請 B → B 獨立提交 → 後端解鎖 → 比較答案／延伸閱讀／一起聊**。獨立文章可直接閱讀，不需測驗；單人探索只在頁面記憶體保留答案。

開發採「每輪一個可驗收成果」，先定義完成條件，再實作、驗證、交接與提交；上線另有發布驗證。完整步驟、可複製的工作單與每週節奏見 [固定開發流程](docs/runbook.md#固定開發流程)。本節作為現況入口；產品文件記錄範圍與需求，各版本章節保留歷史，不能把早期的「尚未實作」直接當成現況。

## 現在可以做什麼

- 瀏覽 6 個測驗主題與獨立的 8 組雙人問答；每次四題，不必一次完成全部 32 題。
- 獨立「了解關係」文章館：三篇完整文章、段落目錄、原研究與全文入口；不需測驗或登入。雙人結果另附科普短卡，連到完整文章。
- 完整 57 題雙人核心價值探索：六段單選、自動保存、稍後回答、逐題修改、完整提交後鎖定；兩人完成後解鎖比較。
- 已公開的 24 題遠距探索：每題可選暫不分享，未答仍需完成才可提交；結果區分共同點、差異、期待與條件，並保留完整逐題選項。
- 本機與公開網站的 `#/trial/core-values`：57 題核心價值探索，六段單選、上一題／下一題／跳過、想再想標記與本人選項整理。可隨時查看整理，不提供分數；答案只在本頁，離開或重新整理會清除。
- 查看 19 類相對分數、相近度、比較接近與值得多聊的方向，以及 57 題並排選項；任一輪廓未呈現差異時不給總分。
- A 提交後產生 B 的邀請；B 獨立回答，雙方完成才解鎖彼此選項與討論提示。
- 每位參與者有私人返回連結；此瀏覽器保存最近 20 個入口。
- SQLite 保存於 `.local/data/between-us.sqlite`，重新整理／重啟服務後仍能找回雙人回合。
- 使用手機或桌面瀏覽；支援鍵盤選答與減少動態效果偏好。
- 單人「介面預覽」仍不保存或分享，與雙人回合分開。

本機的 `127.0.0.1` 連結只能在此電腦測試；使用上方的 Cloudflare 網址即可邀請遠方的人，兩人都提交後才能查看彼此答案。本中文改寫與雙人公式尚未完成測量驗證；人生方向與討論收藏仍待完成；資料期限／退出與連結更換已接入0.14本機，無帳號找回仍未提供。

## 本機啟動

需要 Node.js **24.13 以上**；本次使用 24.19.0。Node 提供 SQLite 與讀取共用 TypeScript 題庫的能力，依賴版本固定於 `package.json`，實際依賴樹由 `package-lock.json` 鎖定。

```powershell
cd C:\Users\lydai\Desktop\forest
npm ci
npm run dev
```

開啟終端機顯示的 `http://127.0.0.1:5173`。停止服務時在終端機按 `Ctrl+C`。

`npm run dev` 同時啟動 Vite 網頁與 `127.0.0.1:8787` API，不需要兩個終端機、雲端帳號或環境變數。保存服務由網頁的 `/api` 代理呼叫，讀寫同一份 SQLite。

```powershell
npm run check
npm run build
npm run preview
```

- `check`：TypeScript 型別檢查與內容／路由測試。
- `build`：型別檢查及產出 `dist/`。
- `preview`：啟動建置版網頁 `http://127.0.0.1:4173` 與相同本機 API／SQLite。先停止 `dev` 再使用，避免占用 8787；這不是對外正式服務。
- `.npmrc` 把快取放在專案內的 `.npm-cache/`，避免依賴個人帳號的全域快取權限。
- 本機流程沒有必要的環境變數或雲端帳號；`.env.example` 另列雲端啟動與 Pages 建置設定。

## 文件入口

雲端部署採 **Cloudflare Workers（執行 API 並提供網頁）＋D1（持久 SQL 資料庫）**，GitHub 保存程式碼；不需要另外購買網域，也不需要再部署 GitHub Pages。`npm run cloudflare:dev` 可在獨立的本機 D1 測試庫驗證；首次登入、建立資料庫、發布與除錯步驟見 [Cloudflare 維護手冊](docs/runbook.md)。既有本機 SQLite 不會自動搬到雲端。

- [產品核心與範圍](docs/product.md)：已確認需求、共用流程、第一版完成標準。
- [日常三觀探索：候選情境與結果設計](docs/quizzes/daily-values.md)：草稿 0.2.0 展開 12 個候選；第一版已選 8 個情境的長度，暫分 8 個主情境與 4 個延伸。八主情境已接入0.12.0，運行來源daily-values.json、內容／整理規則1.0.0；四個延伸未接入，不提供契合數字。
- [更認識你：32 題雙人問答候選稿](docs/quizzes/getting-to-know-you.md)：八題組各四題，每輪只做一組；含逐題審閱與九篇原始研究查核，附 [自願試答與理解回饋執行稿](docs/quizzes/getting-to-know-you-feedback.md)。歷史候選 0.4.0；運行題庫見 [JSON](docs/quizzes/getting-to-know-you.json)，內容／規則均為 1.0.0，已接入網站。
- [三觀測驗內容藍圖](docs/quizzes/core-values.md)：核心價值與人生方向的範圍、題型、結果及候選學術工具。
- [PVQ-RR 57 題候選稿](docs/quizzes/core-values-pvqrr.md)：性別中性改寫、原文追溯、作答選項、來源／授權與中文審查問題；已提供公開單人試讀。
- [遠距戀愛研究與 24 題](docs/quizzes/long-distance.md)：8 篇期刊來源與工具比較、完整題目／選項、逐題依據及維護方式；0.8 已接入並公開發布雙人分析，自編及建議效果未驗證。
- [好好說，也好好聽：研究與內容藍圖](docs/quizzes/communication.md)：直接問本人的做法與期待；含工具比較與[24題內容稿](docs/quizzes/communication-candidate.md)、12組雙向配對及原創提案。0.11已接入；理解／測量／提案效果未驗證。
- [架構與資料流程](docs/architecture.md)：現在的程式路徑、未來回合與後端契約。
- [靠近，也保留自己：研究與內容藍圖](docs/quizzes/space-boundaries.md)：2026-10-13選定的下一個主題；第一輪[12題候選](docs/quizzes/space-boundaries-candidate.md)，分開相處偏好、本人界線與期待／做法。正式題數未選，不計分、未接入。
- [一起生活的選擇：研究與內容藍圖](docs/quizzes/money-life.md)：金錢與生活安排的[第一輪12題候選](docs/quizzes/money-life-candidate.md)，分開期待、自述、現實條件與本人願意範圍；不要求財務資料，不計分；0.13已公開接入。
- [題目與研究依據](docs/research.md)：如何區分理論支持、改寫、自編與驗證。
- [維護與除錯](docs/runbook.md)：新增主題範例、診斷順序與驗證清單。
- [版本紀錄](CHANGELOG.md)：每個交付版本的變更與限制。

## 提交、版本與未來部署

每個完整、已驗證的功能／修正建立一個本機 commit（可回復的變更紀錄）；版號標記交付版本，不要求每筆 commit 都升版。目前本機程式為 `0.15.0`，公開仍 `0.13.0`；下一個新功能可升為 `0.16.0`，小修正可升為 `0.15.1`，純文件整理通常維持原版號。

網站版號記於 `package.json`／`package-lock.json`，各測驗的 `version` 另外管理；改網站色彩不需要改題庫版本。目前本機網站 `0.15.0`、公開 `0.13.0`，日常三觀內容／整理規則 `1.0.0`，遠距回合 `0.2.0`、原題候選／描述性分析不變；文章各為 `1.0.0`。核心價值新回合 `0.4.0`、回饋 `1.0.0`，原措辭來源 `0.2.0`、相近度 `1.0.0`。已發布完整 `0.3.0` 加明示固定閱讀層，原分數／答案不變；三題 `0.1.0` 不套用。詳細操作見 [提交與版本規則](docs/runbook.md#提交與版本規則)。

GitHub repository 保存程式，push 會觸發 `.github/workflows/ci.yml` 檢查，但不會自動發布網站。現行發布執行 `npm run cloudflare:deploy`，依序檢查、建置、上傳 Worker 與網頁資產；沿用既有 D1。`origin` 為 `https://github.com/tivico/between-us.git`，main 追蹤 origin/main，不使用 force push。`pages.yml` 保留為另行配置外部 API 的替代方案，現行 Cloudflare 網站不使用它。[部署與除錯步驟](docs/runbook.md)。

## 重要檔案

| 檔案 | 角色 |
| --- | --- |
| `src/content/topic-guide.ts`、`src/components/ResultOpening.tsx`、`src/domain/result-opening.ts` | 情境選題、共用結果閱讀、後端固定摘要V1；只讀原分析，不改計分 |
| `src/domain/retention.ts`、`src/components/DataPrivacy.tsx`、`src/components/RoundManagement.tsx` | 保存期限、說明頁與本人退出／更換連結操作；Node／D1執行授權與資料變更 |
| `server/operations.mjs`、`.github/workflows/health.yml`、`scripts/check-site-health.mjs` | 安全日誌、限流、公開健康監測；不讀私人回合 |
| `server/backup.mjs`、`scripts/backup-sqlite.mjs` | 一致性加密備份與隔離還原，保留最新退出／撤銷狀態；不直接替換運行庫 |
| `scripts/generate-catalog.mjs`、`src/content/quiz-catalog.json`、`src/components/ExplorationPage.tsx` | 從原registry生成輕量摘要、按需載入完整題庫；JSON不手動編輯 |
| `src/App.tsx` | 主題館、介紹、作答預覽與個人答案頁 |
| `src/content/relationship-articles.ts`、`src/components/RelationshipPages.tsx`、`src/components/ResultLearningCards.tsx` | 文章與研究來源、文章館／全文畫面、結果科普短卡 |
| `src/content/quizzes.ts`、`src/content/core-values.ts` | 可見主題、完整 57 題、原數值與 19 類映射；三題示例另保留 |
| `src/domain/compatibility.ts`、`src/components/ValueResults.tsx` | 依回合快照計分，以及相近度／19 類結果顯示 |
| `src/content/core-values-trial.ts`、`src/components/ContentTrial.tsx`、`src/domain/trial.ts` | 57 題前端候選轉換、試讀介面、本人答案整理；不接雙人 API |
| `src/domain/quiz.ts` | TypeScript 內容契約及驗證函式 |
| `src/lib/routes.ts` | `#/topics/...` 與 `#/demo/...` 路由解析 |
| `src/styles.css` | 色彩、字體、排版與手機版樣式 |
| `src/components/Motif.tsx` | 自製 SVG 主題插圖，沒有額外圖庫依賴 |
| `src/components/RoundFlow.tsx` | 建立、加入、填答、等待、共同結果與最近入口 |
| `src/lib/api.ts`、`src/lib/history.ts` | API 呼叫、錯誤處理與此瀏覽器最近入口 |
| `server/http.mjs`、`server/store.mjs` | HTTP 授權邊界、雙人規則、交易與 SQLite 保存 |
| `scripts/dev.mjs` | 一次啟動網頁與 API；關閉服務 |
| `scripts/start-api.mjs`、`server/config.mjs` | 獨立 API 啟動、資料磁碟與允許來源設定 |
| `src/lib/deployment-config.ts`、`src/lib/deployment.ts` | Pages 資產路徑、API 網址驗證與保存說明 |
| `.github/workflows/`、`scripts/check-hosted-api.mjs` | CI、手動 Pages 發布與後端連線檢查 |
| `cloudflare/`、`wrangler.jsonc` | 雲端 Worker API、D1 store、migration 與網站部署設定 |
| `scripts/check-cloudflare.mjs` | 用虛構資料驗證部署後的雙人 API 流程 |
| `vite.config.ts` | 本機服務與建置設定 |

## 技術選擇

使用 React + TypeScript + Vite 的單一前端專案。React 負責畫面，TypeScript 幫忙偵測資料與程式型別錯誤，Vite 負責本機開發與建置。首頁只載入自動生成的公開catalog；探索／回合與文章按頁面懶載入，完整題庫未刪。修改主題後執行 `npm run catalog:generate`，dev／build也會自動生成，check防止摘要與registry不同步。Hash 路由是網址 `#` 後面的頁面識別，讓靜態主機也能直接開啟子頁；目前不用路由套件、全域狀態套件或設計元件庫。

本機使用 Node 原生 HTTP 與 SQLite；雲端使用 Cloudflare Workers＋D1，沒有 ORM、會員、管理後台或額外後端框架。移植入口與非同步保存規則已實作，使用 `cloudflare:deploy` 發布。既有 `npm start` 是獨立 Node 主機的替代方式，不能直接在 Worker 執行；GitHub Pages 也只能提供前端。

免會員的保存與返回入口已在本機實作。私人憑證只在瀏覽器的網址片段／最近入口，以及 API 的授權傳遞中使用；資料庫只保存雜湊，不保存原始憑證。0.14本機新回合保存180天、到期即拒絕存取並每日清理；舊回合不回溯期限。可刪除本人答案並退出、或更換返回連結；無帳號找回仍未提供。裝置入口移除仍不會刪除後端資料。公開在0.14部署前仍依0.13規則，不能提前承諾已提供這些操作。獨立科普與結果短卡已接入；正式中文工具的測量驗證仍待完成。文章不讀私人回合或保存閱讀紀錄。研究與本站聊天提案分開標示。

字體可從 Google Fonts 載入，失敗時使用系統中文字體。字體載入不包含答案；如需完全不依賴外部資源，可移除 `src/styles.css` 首行的字體匯入。

官方技術參考：[Vite 入門](https://vite.dev/guide/)、[React 與 TypeScript](https://react.dev/learn/typescript)。學術參考與其支持範圍列於研究文件與各主題。
