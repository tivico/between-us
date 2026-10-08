# 維護與除錯

## 第一次啟動

```powershell
cd C:\Users\lydai\Desktop\forest
node --version
npm ci
npm run dev
```

終端機顯示 Local URL 後開啟；手機版可先用瀏覽器裝置模擬。`127.0.0.1` 只供此電腦使用，目前沒有真實跨裝置邀請功能。

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

| 想修改 | 位置與注意事項 |
| --- | --- |
| 名稱、首頁說明、流程文字 | `src/App.tsx`；網站標題另有 `App` 的 `document.title` 與 `index.html` |
| 題目與選項 | `src/content/quizzes.ts`；改 ID 會影響既有答案對應，正式版必須建立新版本 |
| 全站色彩／排版 | `src/styles.css` 的 `:root` 與對應 class |
| 主題配色 | `.theme-sage` 等 CSS 變數；新增 theme 要同步 TypeScript `Theme` |
| 插圖 | `src/components/Motif.tsx`；新增 motif 要同步 `QuizDefinition` |
| 新頁面 | `src/lib/routes.ts` 加路由，`src/App.tsx` 的 `Page` 加呈現，再補路由測試 |
| 後端 | 依 `docs/architecture.md` 契約另行接入，現在沒有資料庫可操作 |

例如想把主色改成更深的綠：先調整 `.primary` 的背景，再確認白字對比、hover、鍵盤外框與手機畫面，不只改首頁按鈕。

## 排查順序

### 服務無法啟動／連不上

1. 確認在專案根目錄，有 `package.json`。
2. `node --version`；至少 22.12。
3. `npm ci` 安裝 lockfile 對應依賴，留意第一個錯誤。
4. `npm run dev`，以終端機實際顯示 URL 為準。
5. 若出現 5173 被占用，先看哪個程式持有，不要直接殺掉陌生服務：

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```

可改用 `npm run dev -- --port 5174`。檢查 HTTP 的安全指令：

```powershell
(Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing).StatusCode
```

### 畫面空白／新增題目後壞掉

1. 打開瀏覽器開發工具 Console，先看第一個錯誤。
2. 若訊息含主題 ID、`找不到研究來源`、`題目 ID 重複`，檢查 `quizzes.ts`。
3. 執行 `npm run check`，型別錯誤指向 `quiz.ts` 的資料契約，測試錯誤指向內容一致性。
4. 若 URL 不對，試 `http://127.0.0.1:5173/#/`；未知頁面應出現返回入口。
5. 在 `App.tsx` 的 `Page`、`getQuiz()` 或 `Demo` 的 `onChange` 加斷點，查看主題 ID、題目 ID 與選項 ID。

現在沒有後端 log 或資料表；不要追不存在的 API。未來接入後端再更新此章與診斷指令。

### 答案「不見了」／下一題不能按

- 沒有選 radio 時，下一題刻意停用。
- 上一題與返回修改會保留當次選擇。
- 重新整理或離開預覽會清除記憶體中的答案，這是目前已說明的限制。
- 正式跨裝置暫存尚未實作，請勿用目前預覽蒐集朋友的正式答案。

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

修正失敗先回復自己剛改的內容，勿使用整個專案的遞迴刪除或無差別 reset。`node_modules/` 和 `dist/` 是可再生成的產物，不把它們當原始碼修改。沒有部署服務、Git remote 或真實使用資料需要回復。

## 提交與版本規則

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

Tag 是指向特定 commit 的版本標記。不可覆寫已交付 tag；本機 tag 並不代表網站已部署。推送與部署留給指定 GitHub repository 後的工作流程，不把 `git push --tags` 當一般存檔操作。

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
