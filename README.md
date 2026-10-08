# 之間 Between Us

給各種性向與性別認同的兩個人的主題測驗網站。各自回答，再一起了解彼此重視什麼、期待什麼，以及有哪些話值得聊。

此分支新增 **0.8.0 遠距雙人探索與討論建議**，本機入口為 `#/start/long-distance`。24 題分別回答實際行為、期待與可行條件；兩人完整提交後查看共同點、差異、各自見面條件與依答案提供的建議。每項建議可查看觸發答案與研究概念，沒有契合分數。題庫與建議效果尚未驗證；目前在 `codex/long-distance-analysis`，**未合併 main、未公開部署**。維護方式見 [0.8 維護交接](docs/runbook.md#08-遠距雙人探索與個別建議)。

網站新增 **0.7.0「了解關係」文章館與結果科普短卡**，發布狀態見 [維護手冊](docs/runbook.md)：[了解關係](https://between-us.forest-between-us.workers.dev/#/learn)、[開啟網站](https://between-us.forest-between-us.workers.dev/)、[開始 57 題雙人探索](https://between-us.forest-between-us.workers.dev/#/start/core-values)。各自完整回答 57 題，A 提交後邀請 B，雙方提交才解鎖彼此選項、19 類相對價值與 0–100 核心價值相近度。Cloudflare Workers 提供網站/API，D1 保存回合；免會員，以私人返回連結找回。相近度是使用者同意的本站探索性公式，不是經驗證的伴侶契合量表或關係成功率。

## 核心內容與現況總覽

整理日期：2026-10-08；程式版本 `0.7.0`。以下依目前原始碼與既有驗收／發布紀錄整理，本次文件整理未重新驗收公開網站。產品目的是「讓兩個人更了解彼此，讓答案成為對話」，不替兩人決定是否適合交往。

| 核心區塊 | 使用者得到什麼 | 目前狀態與界線 |
| --- | --- | --- |
| 雙人核心價值探索 | 各答 57 題，雙方提交後看 19 類相對價值、0–100 相近度與逐題選項 | 已實作，既有紀錄確認公開發布；中文中性改寫與本站雙人指標尚未完成測量驗證 |
| 了解關係 | 三篇文章：價值觀測驗、感受到的回應、遠距日常；結果附延伸閱讀短卡 | 已實作，既有紀錄確認公開發布；研究發現、生活例子與本站聊天提案分開標示 |
| 保存與返回 | 免會員、後端保存、本人私人返回連結、此裝置最近 20 個入口 | 已實作；期限、刪除、撤銷／失效與遺失連結找回仍待定；最近入口不等於跨裝置歷史 |
| 主題館 | 五個可見主題，查看介紹與來源 | 只有核心價值已開放雙人作答；遠距、溝通、生活金錢、空間界線仍為規劃 |
| 單人探索／預覽 | 先了解題型與自己的選擇 | 保留獨立入口；57 題單人探索不保存、不計分，不能替代雙人回合 |
| 更認識你 | 32 題候選，預計每輪選一至兩組、四至八題，揭曉後聊原因 | 方向已確認；尚未逐題驗收、接入或發布，不增加契合分數 |
| 遠距，也靠近 | 24 題自編候選：日常分享、回應支持、見面與未來 | 已有研究整理與候選 JSON；尚未接入或驗證，不因已有遠距文章就視為測驗開放 |

人生方向仍待設計，不能併入目前核心價值相近度。生育不在範圍；所有性向與性別認同都能使用，不依身分選題或計分。網站功能開放、研究有依據與工具已驗證是三件不同的事。

目前雙人路徑：**選主題 → 同意分享／建立回合 → A 填答與提交 → 邀請 B → B 獨立提交 → 後端解鎖 → 比較答案／延伸閱讀／一起聊**。獨立文章可直接閱讀，不需測驗；單人探索只在頁面記憶體保留答案。

開發採「每輪一個可驗收成果」，先定義完成條件，再實作、驗證、交接與提交；上線另有發布驗證。完整步驟、可複製的工作單與每週節奏見 [固定開發流程](docs/runbook.md#固定開發流程)。本節作為現況入口；產品文件記錄範圍與需求，各版本章節保留歷史，不能把早期的「尚未實作」直接當成現況。

## 現在可以做什麼

- 瀏覽 5 個主題、切換篩選、查看主題介紹與研究來源。
- 獨立「了解關係」文章館：三篇完整文章、段落目錄、原研究與全文入口；不需測驗或登入。雙人結果另附科普短卡，連到完整文章。
- 完整 57 題雙人核心價值探索：六段單選、自動保存、稍後回答、逐題修改、完整提交後鎖定；兩人完成後解鎖比較。
- 此分支的 24 題遠距探索：每題可選暫不分享，未答仍需完成才可提交；結果區分共同點、差異、期待與條件，並保留完整逐題選項。
- 本機與公開網站的 `#/trial/core-values`：57 題核心價值探索，六段單選、上一題／下一題／跳過、想再想標記與本人選項整理。可隨時查看整理，不提供分數；答案只在本頁，離開或重新整理會清除。
- 查看 19 類相對分數、相近度、比較接近與值得多聊的方向，以及 57 題並排選項；任一輪廓未呈現差異時不給總分。
- A 提交後產生 B 的邀請；B 獨立回答，雙方完成才解鎖彼此選項與討論提示。
- 每位參與者有私人返回連結；此瀏覽器保存最近 20 個入口。
- SQLite 保存於 `.local/data/between-us.sqlite`，重新整理／重啟服務後仍能找回雙人回合。
- 使用手機或桌面瀏覽；支援鍵盤選答與減少動態效果偏好。
- 單人「介面預覽」仍不保存或分享，與雙人回合分開。

本機的 `127.0.0.1` 連結只能在此電腦測試；使用上方的 Cloudflare 網址即可邀請遠方的人，兩人都提交後才能查看彼此答案。本中文改寫與雙人公式尚未完成測量驗證；人生方向、討論收藏、資料期限與刪除／遺失連結找回仍待完成。

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
- [更認識你：32 題選擇題候選稿](docs/quizzes/getting-to-know-you.md)：八個面向、每面向四題與討論提示；方向已確認，尚未接入網站。
- [三觀測驗內容藍圖](docs/quizzes/core-values.md)：核心價值與人生方向的範圍、題型、結果及候選學術工具。
- [PVQ-RR 57 題候選稿](docs/quizzes/core-values-pvqrr.md)：性別中性改寫、原文追溯、作答選項、來源／授權與中文審查問題；已提供公開單人試讀。
- [遠距戀愛研究與 24 題](docs/quizzes/long-distance.md)：8 篇期刊來源與工具比較、完整題目／選項、逐題依據及維護方式；0.8 分支已接入雙人分析，自編未驗證、未公開部署。
- [架構與資料流程](docs/architecture.md)：現在的程式路徑、未來回合與後端契約。
- [題目與研究依據](docs/research.md)：如何區分理論支持、改寫、自編與驗證。
- [維護與除錯](docs/runbook.md)：新增主題範例、診斷順序與驗證清單。
- [版本紀錄](CHANGELOG.md)：每個交付版本的變更與限制。

## 提交、版本與未來部署

每個完整、已驗證的功能／修正建立一個本機 commit（可回復的變更紀錄）；版號標記交付版本，不要求每筆 commit 都升版。此分支為 `0.8.0`；下一個新功能可升為 `0.9.0`，小修正可升為 `0.8.1`，純文件整理通常維持原版號。

網站版號記於 `package.json`／`package-lock.json`，各測驗的 `version` 另外管理；改網站色彩不需要改題庫版本。此分支網站 `0.8.0`，遠距回合 `0.2.0`、原題候選 `0.1.0`、分析規則 `1.0.0`；三篇文章各為 `1.0.0`；57 題雙人回合 `0.3.0`，措辭來源候選 `0.2.0`，比較規則 `1.0.0`；三題示例快照仍為 `0.1.0`。建立回合時固定題目與規則快照，舊回合不追套新規則。詳細操作與回復方式見 [維護手冊的提交與版本規則](docs/runbook.md#提交與版本規則)。

GitHub repository 保存程式，push 會觸發 `.github/workflows/ci.yml` 檢查，但不會自動發布網站。現行發布執行 `npm run cloudflare:deploy`，依序檢查、建置、上傳 Worker 與網頁資產；沿用既有 D1。`origin` 為 `https://github.com/tivico/between-us.git`，main 追蹤 origin/main，不使用 force push。`pages.yml` 保留為另行配置外部 API 的替代方案，現行 Cloudflare 網站不使用它。[部署與除錯步驟](docs/runbook.md)。

## 重要檔案

| 檔案 | 角色 |
| --- | --- |
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

使用 React + TypeScript + Vite 的單一前端專案。React 負責畫面，TypeScript 幫忙偵測資料與程式型別錯誤，Vite 負責本機開發與建置。Hash 路由是網址 `#` 後面的頁面識別，讓靜態主機也能直接開啟子頁；目前不用路由套件、全域狀態套件或設計元件庫。

本機使用 Node 原生 HTTP 與 SQLite；雲端使用 Cloudflare Workers＋D1，沒有 ORM、會員、管理後台或額外後端框架。移植入口與非同步保存規則已實作，使用 `cloudflare:deploy` 發布。既有 `npm start` 是獨立 Node 主機的替代方式，不能直接在 Worker 執行；GitHub Pages 也只能提供前端。

免會員的保存與返回入口已在本機實作。私人憑證只在瀏覽器的網址片段／最近入口，以及 API 的授權傳遞中使用；資料庫只保存雜湊，不保存原始憑證。保存期限、資料刪除與遺失連結找回仍待定；裝置入口移除不會刪除 SQLite 資料。獨立科普與結果短卡已接入；正式中文工具的測量驗證仍待完成。文章不讀私人回合或保存閱讀紀錄。研究與本站聊天提案分開標示。

字體可從 Google Fonts 載入，失敗時使用系統中文字體。字體載入不包含答案；如需完全不依賴外部資源，可移除 `src/styles.css` 首行的字體匯入。

官方技術參考：[Vite 入門](https://vite.dev/guide/)、[React 與 TypeScript](https://react.dev/learn/typescript)。學術參考與其支持範圍列於研究文件與各主題。
