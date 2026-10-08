# 之間 Between Us

給兩個人的主題測驗網站。各自回答，再一起了解彼此重視什麼、期待什麼，以及有哪些話值得聊。

目前為 **0.3.0 部署準備版**。可以完成兩人的保存、邀請與答案比較，已補上 GitHub CI／Pages 工作流程與獨立 API 啟動設定。**尚未推送或上線**；repository、GitHub 連線與後端主機仍待提供。正式量表與契合度尚未定稿。暫定名稱「之間」可再調整。

## 現在可以做什麼

- 瀏覽 5 個主題、切換篩選、查看主題介紹與研究來源。
- 體驗三觀主題的 3 題自編示例：選答、上一題、下一題、查看自己的答案、返回修改。
- 建立雙人測試回合、同意分享、填答自動保存、確認提交後鎖定答案。
- A 提交後產生 B 的邀請；B 獨立回答，雙方完成才解鎖彼此選項與討論提示。
- 每位參與者有私人返回連結；此瀏覽器保存最近 20 個入口。
- SQLite 保存於 `.local/data/between-us.sqlite`，重新整理／重啟服務後仍能找回雙人回合。
- 使用手機或桌面瀏覽；支援鍵盤選答與減少動態效果偏好。
- 單人「介面預覽」仍不保存或分享，與雙人回合分開。

目前只綁定此電腦的 `127.0.0.1`，邀請供同一電腦的不同瀏覽器／測試身份使用；尚未部署，不能把本機連結傳給遠方的人使用。正式題庫、計分、科普文章、討論收藏、資料期限與刪除／找回規則尚未完成；請使用測試答案。

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

- [產品核心與範圍](docs/product.md)：已確認需求、共用流程、第一版完成標準。
- [三觀測驗內容藍圖](docs/quizzes/core-values.md)：核心價值與人生方向的範圍、題型、結果及候選學術工具。
- [架構與資料流程](docs/architecture.md)：現在的程式路徑、未來回合與後端契約。
- [題目與研究依據](docs/research.md)：如何區分理論支持、改寫、自編與驗證。
- [維護與除錯](docs/runbook.md)：新增主題範例、診斷順序與驗證清單。
- [版本紀錄](CHANGELOG.md)：每個交付版本的變更與限制。

## 提交、版本與未來部署

每個完整、已驗證的功能／修正建立一個本機 commit（可回復的變更紀錄）；版號標記交付版本，不要求每筆 commit 都升版。現在為 `0.3.0`；下一個新功能可升為 `0.4.0`，小修正可升為 `0.3.1`，純文件整理通常維持原版號。

網站版號記於 `package.json`／`package-lock.json`，各測驗的 `version` 另外管理；改網站色彩不需要改題庫版本。現在網站為 `0.3.0`，三題草案仍為 `0.1.0`，題目沒有改變。詳細操作與回復方式見 [維護手冊的提交與版本規則](docs/runbook.md#提交與版本規則)。

GitHub repository 保存程式；GitHub Pages 提供前端，另外的後端保存雙人答案與控制解鎖。已有 `.github/workflows/ci.yml` 自動檢查，以及 `pages.yml` 從 main 手動發布。Pages 發布前會檢查已上線 API 與跨來源設定；沒有後端就停止發布。目前沒有 remote、push 或實際部署。[實際設定步驟](docs/runbook.md#github-與雲端部署)、[架構與分工](docs/architecture.md#github-部署準備03-已實作尚未上線)。

## 重要檔案

| 檔案 | 角色 |
| --- | --- |
| `src/App.tsx` | 主題館、介紹、作答預覽與個人答案頁 |
| `src/content/quizzes.ts` | 主題、草題、選項與研究來源 |
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
| `vite.config.ts` | 本機服務與建置設定 |

## 技術選擇

使用 React + TypeScript + Vite 的單一前端專案。React 負責畫面，TypeScript 幫忙偵測資料與程式型別錯誤，Vite 負責本機開發與建置。Hash 路由是網址 `#` 後面的頁面識別，讓靜態主機也能直接開啟子頁；目前不用路由套件、全域狀態套件或設計元件庫。

使用 Node 原生 HTTP 與 SQLite 後端，沒有 ORM、會員、管理後台或額外後端框架。`npm start` 可獨立啟動 API，需要 Node 24.13+、持久磁碟、HTTPS 代理與明確的允許來源；不是 `vite preview` 對外服務。維持單一 API 實例。主機平台仍待選；GitHub Pages 只能提供前端，不能直接執行 SQLite 後端。若改用 Cloudflare Workers／D1，仍需移植後端，現有 `npm start` 不能直接搬過去。

免會員的保存與返回入口已在本機實作。私人憑證只在瀏覽器的網址片段／最近入口，以及 API 的授權傳遞中使用；資料庫只保存雜湊，不保存原始憑證。保存期限、資料刪除與遺失連結找回仍待定；裝置入口移除不會刪除 SQLite 資料。感情科普與第一份正式三觀工具仍待整理。

字體可從 Google Fonts 載入，失敗時使用系統中文字體。字體載入不包含答案；如需完全不依賴外部資源，可移除 `src/styles.css` 首行的字體匯入。

官方技術參考：[Vite 入門](https://vite.dev/guide/)、[React 與 TypeScript](https://react.dev/learn/typescript)。學術參考與其支持範圍列於研究文件與各主題。
