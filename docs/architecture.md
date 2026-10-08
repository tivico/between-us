# 架構與資料流程

## 現況：只有本機前端

目前 React + TypeScript + Vite 單一專案。沒有 API、資料庫、服務端金鑰、會員或對外部署。

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
| 不存在的主題或不支援的路徑 | `NotFound`：提供返回入口 |

目前用 hash 路由，路徑切換不向後端索取頁面；因此本機與靜態主機不用另外設定子頁回寫。這不是未來私人 token 的最終傳遞設計。

### 預覽作答資料

```text
點選原生 radio
  → Demo 的 answers[questionId] = optionId
  → 下一題 / 上一題（index）
  → 三題完成（finished）
  → 依 questions 找回選項文字並呈現
```

答案只在 `Demo` 的 React state（元件記憶體）中。無 `localStorage`、cookie、網路提交與持久化；重新整理或離開該元件即清除。返回修改仍在同一個元件中，選擇會保留。沒有任何另一人的示例答案或計分。

### 建置流程

`npm run build` → `tsc --noEmit` → `vite build` → `dist/index.html` 與前端資產。`dist/` 不納入版本管理。React StrictMode 會在開發時重複執行部分檢查；未來副作用必須可重試，不能因此建立兩個回合。

## 技術取捨

- 一個前端專案，方便持有人理解與維護。
- 內容為型別化 TypeScript 資料，不做管理後台與 CMS。
- 目前只有單選題，不預先堆疊所有題型。
- 使用手寫 CSS 與 SVG，色彩／版面可直接修改，不依賴大型元件庫。
- 前端骨架不先選資料庫供應商；雙人流程需要真正後端，不能以同機暫存冒充跨裝置分享。
- 首頁的研究資料是公開內容；個人答案未來絕不可包進前端靜態題庫或 build 資產。

## 後續後端契約（設計，尚未實作）

以下是必要邊界，不是要求建立多個服務。單一小型 API 搭配託管資料庫即可。

### 資料生命週期

| 資料 | 角色 |
| --- | --- |
| `quiz_revisions` | 不可變的題目與結果規則版本／快照；回合不可依賴可被直接覆寫的題庫 |
| `sessions` | 回合 ID、題目版本、進度、建立／到期時間 |
| `participants` | A/B 席位、暱稱、分享同意、提交時間、私人 token 的雜湊 |
| `answers` | 每位參與者每題的選項，唯一鍵為參與者＋題目 |
| `invitations` | 邀請 token 雜湊、綁定回合、使用狀態與到期時間 |
| 討論收藏 | 後續若實作，需定義屬於個人還是共享，不先假定 |

「雜湊」是把憑證轉成不可直接還原的驗證值；資料庫不要保存原始私人 token。私人連結持有人即有該參與者的存取權，不能當一般邀請連結轉傳。

### API 意圖

| 操作 | 驗證與回傳原則 |
| --- | --- |
| `POST /api/sessions` | 僅接受已開放主題／版本，建立 A 與回合；需要重試識別，避免重複建立 |
| `PUT /api/sessions/:id/answers` | 只能寫本人未提交答案；檢查題目、選項屬於回合固定版本 |
| `POST /api/sessions/:id/submit` | 完整性／分享同意檢查，提交與鎖定必須在同一交易完成 |
| `POST /api/sessions/:id/invitations` | A 已提交才可建立邀請；回傳給 B 的邀請，不回傳 A 私人 token |
| `POST /api/invitations/claim` | 原子占用 B 席位，拒絕第三人；同一已驗證 B 的重試不產生新席位 |
| `GET /api/sessions/:id/status` | 回傳必要的本人資料與完成狀態，不附對方未解鎖答案 |
| `GET /api/sessions/:id/results` | 驗證參與者身分、雙方提交與同意後，才回傳可分享的雙人答案／結果 |
| 刪除／到期 | 待確認分享回合的刪除權、保存期限；確認後一併定義 API 與畫面 |

交易（transaction）是讓一組資料更新一起成功或一起失敗，避免兩人同時加入、多次提交造成不一致。後端應回傳可讓畫面辨識的錯誤碼，例如 `INVITATION_EXPIRED`、`ALREADY_CLAIMED`、`SESSION_LOCKED`；不要讓使用者只看到泛用錯誤。

### 解鎖原則

```text
A 同意並提交 + B 同意並提交
  → 後端檢查且完成鎖定
  → 結果可讀
```

狀態可表達為 `a_answering → awaiting_partner → b_answering → unlocked`，另有 `expired/deleted`。服務端是權威，前端狀態只用來顯示；隱藏按鈕無法阻止提前讀取資料。每一次結果讀取都要重新驗證資格。

結果原則上依固定版本的答案與計分規則確定性生成，不需要 AI API。名目選項不做數值距離；量表計分依核定方法。尚未分享或未答不能視為一致。

### 私人連結與資料保護

- 邀請與返回憑證用足夠隨機的 token，不能靠遞增回合 ID 取得權限。
- 選定後端後決定安全的交換方式（例如 token 換取 HttpOnly cookie）；憑證不放一般分析、網址追蹤、console 或伺服器 log。
- 正式結果頁避免外部分析／第三方資產取得私人網址，設定相應 Referrer-Policy；目前 hash 裡只有公開主題 ID。
- 資料庫限制每個回合兩個席位；存取規則應測試 A、B、陌生人與提交前後。
- `.env` 不入 Git。任何 `VITE_` 變數會打包到瀏覽器，不能放管理金鑰。
- 保存期限與刪除機制是正式版本交付前必須定義的產品行為。

## GitHub 部署方向（規劃）

使用者希望未來程式與部署以自己的 GitHub 為入口。實際 repository 尚未指定，目前沒有 remote 或 Actions 工作流程，不會自動把本機 commit 發布上網。

GitHub repository 保存原始碼與版本歷史；GitHub Pages 是靜態網站服務，適合目前的前端資產，不能執行本專案未來的寫入答案、加入邀請或解鎖 API。正式雙人體驗可採以下分工，後端供應商待選：

```text
本機變更 → 檢查與 commit → push 到指定 GitHub repository
  → GitHub Actions 安裝依賴、檢查、建置
  → GitHub Pages 提供前端
  → 使用者瀏覽器透過 HTTPS 呼叫後端
  → 後端驗證參與者、讀寫資料庫、控制結果解鎖
```

原始碼與網站公開範圍要各自確認；私人 repository 不代表 Pages 網址必然是私人。GitHub Free 可使用公開 repository 的 Pages；私人來源 repository 的支援取決於方案。具體方案與存取方式要在實際部署時核對，不假定所有朋友專用網站都必須公開原始碼。

### 前端上線前需完成

- 若網址為 `https://<帳號>.github.io/<repository>/`，建置時 Vite `base` 必須對應 `/<repository>/`；帳號首頁或自訂網域通常為 `/`。本機目前使用預設 `/`，不能當作已支援所有 Pages 路徑。
- 核對 `index.html` 的 favicon 與建置後 CSS／JS 的 URL；不能在 repository 子目錄站點仍指向網站根目錄的資產。
- 使用 `npm ci → npm run check → npm run build` 建置，只發布 `dist/`；不發布原始私密資料、`.env`、快取或 `node_modules/`。
- 設定 Pages 的 GitHub Actions 建置來源，部署 workflow 需限制分支／標籤與權限。
- 建議正式版本使用 `v*` 標籤或手動觸發部署，功能開發 commit 不等於自動更新朋友正在使用的網站。實際工作流程待設定。
- 接入後端後，須處理允許的前端來源（CORS）、憑證傳遞、儲存期限、存取規則與前後端相容性。

官方參考：[GitHub Pages 的性質與方案](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Vite 的 GitHub Pages 部署方式](https://vite.dev/guide/static-deploy.html#github-pages)。此處只記錄設計，尚未驗證實際 GitHub 部署。
