# 之間 Between Us

給各種性向與性別認同的兩個人的主題測驗網站。各自回答，再一起了解彼此重視什麼、期待什麼，以及有哪些話值得聊。

本機目前為 **0.5.0 題庫試讀版**，新增 57 題性別中性措辭的單人試讀；公開網站仍為 **0.4.0 三題雲端試玩版**：[開啟之間 Between Us](https://between-us.forest-between-us.workers.dev/)。Cloudflare Workers 提供網頁與 API，D1 保存雙人回合。原始碼位於公開的 [tivico/between-us](https://github.com/tivico/between-us)，0.4 的 GitHub CI 與雙人流程已驗證；0.5 尚未推送／部署。正式量表與契合度尚未定稿。

## 現在可以做什麼

- 瀏覽 5 個主題、切換篩選、查看主題介紹與研究來源。
- 體驗三觀主題的 3 題自編示例：選答、上一題、下一題、查看自己的答案、返回修改。
- 本機 `#/trial/core-values`：57 題中性措辭試讀，六段單選、上一題／下一題／跳過、想再讀標記與本人選項整理。可隨時查看整理，不提供分數；答案只在本頁，離開或重新整理會清除。
- 建立雙人測試回合、同意分享、填答自動保存、確認提交後鎖定答案。
- A 提交後產生 B 的邀請；B 獨立回答，雙方完成才解鎖彼此選項與討論提示。
- 每位參與者有私人返回連結；此瀏覽器保存最近 20 個入口。
- SQLite 保存於 `.local/data/between-us.sqlite`，重新整理／重啟服務後仍能找回雙人回合。
- 使用手機或桌面瀏覽；支援鍵盤選答與減少動態效果偏好。
- 單人「介面預覽」仍不保存或分享，與雙人回合分開。

本機的 `127.0.0.1` 連結只能在此電腦測試；使用上方的 Cloudflare 網址即可邀請遠方的人，兩人都提交後才能查看彼此答案。正式題庫、計分、科普文章、討論收藏、資料期限與刪除／找回規則尚未完成；請使用測試答案。

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

雲端部署採 **Cloudflare Workers（執行 API 並提供網頁）＋D1（持久 SQL 資料庫）**，GitHub 保存程式碼；不需要另外購買網域，也不需要再部署 GitHub Pages。`npm run cloudflare:dev` 可在獨立的本機 D1 測試庫驗證；首次登入、建立資料庫、發布與除錯步驟見 [Cloudflare 維護手冊](docs/runbook.md#cloudflare-workersd1-04)。既有本機 SQLite 不會自動搬到雲端。

- [產品核心與範圍](docs/product.md)：已確認需求、共用流程、第一版完成標準。
- [三觀測驗內容藍圖](docs/quizzes/core-values.md)：核心價值與人生方向的範圍、題型、結果及候選學術工具。
- [PVQ-RR 57 題候選稿](docs/quizzes/core-values-pvqrr.md)：性別中性改寫、原文追溯、作答選項、來源／授權與中文審查問題；已提供本機單人試讀。
- [架構與資料流程](docs/architecture.md)：現在的程式路徑、未來回合與後端契約。
- [題目與研究依據](docs/research.md)：如何區分理論支持、改寫、自編與驗證。
- [維護與除錯](docs/runbook.md)：新增主題範例、診斷順序與驗證清單。
- [版本紀錄](CHANGELOG.md)：每個交付版本的變更與限制。

## 提交、版本與未來部署

每個完整、已驗證的功能／修正建立一個本機 commit（可回復的變更紀錄）；版號標記交付版本，不要求每筆 commit 都升版。本機現在為 `0.5.0`；下一個新功能可升為 `0.6.0`，小修正可升為 `0.5.1`，純文件整理通常維持原版號。

網站版號記於 `package.json`／`package-lock.json`，各測驗的 `version` 另外管理；改網站色彩不需要改題庫版本。網站本機 `0.5.0`，三題草案 `0.1.0`，57 題中性候選 `0.2.0`；本次只是接入試讀，題幹未改。詳細操作與回復方式見 [維護手冊的提交與版本規則](docs/runbook.md#提交與版本規則)。

GitHub repository 保存程式；GitHub Pages 提供前端，另外的後端保存雙人答案與控制解鎖。`.github/workflows/ci.yml` 自動檢查；`pages.yml` 從 main 手動發布。Pages 發布前會檢查已上線 API 與跨來源設定；沒有後端就停止發布。`origin` 已設定為 `https://github.com/tivico/between-us.git`，main 追蹤 origin/main；本專案的 GitHub 帳號選擇為 tivico，不改全域設定。未設定後端 `API_BASE_URL`，尚未執行 Pages 發布。[實際設定步驟](docs/runbook.md#github-與雲端部署)、[架構與分工](docs/architecture.md#github-部署準備03-已實作尚未上線)。

## 重要檔案

| 檔案 | 角色 |
| --- | --- |
| `src/App.tsx` | 主題館、介紹、作答預覽與個人答案頁 |
| `src/content/quizzes.ts` | 主題、草題、選項與研究來源 |
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

免會員的保存與返回入口已在本機實作。私人憑證只在瀏覽器的網址片段／最近入口，以及 API 的授權傳遞中使用；資料庫只保存雜湊，不保存原始憑證。保存期限、資料刪除與遺失連結找回仍待定；裝置入口移除不會刪除 SQLite 資料。感情科普與第一份正式三觀工具仍待整理。

字體可從 Google Fonts 載入，失敗時使用系統中文字體。字體載入不包含答案；如需完全不依賴外部資源，可移除 `src/styles.css` 首行的字體匯入。

官方技術參考：[Vite 入門](https://vite.dev/guide/)、[React 與 TypeScript](https://react.dev/learn/typescript)。學術參考與其支持範圍列於研究文件與各主題。
