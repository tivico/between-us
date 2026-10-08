# 專案工作協議

本專案是小型雙人主題測驗平台，產品核心見 README 與 docs/product.md。

- 使用繁體中文。維持單一前端專案，不無故加入會員、CMS、微服務或大型狀態套件。
- 修改後完成必要驗證與維護交接：說明改了什麼、原因、實際流程、除錯順序與日後修改範例。
- 架構／操作知識更新到現有 README、docs/architecture.md、docs/runbook.md 等最接近的文件。
- 共用流程與主題內容分開；新增主題優先編輯 src/content/quizzes.ts。
- 學術依據與工具驗證必須分清楚；草題不能冒充已驗證量表。生育不在目前範圍。
- 使用者已要求全性向適用，涵蓋不同性別認同；不按性別／性向選題、計分或決定參與資格，不新增必填性別／性向欄位。量表以不限定性別的人物描述施測，結果使用「你／對方／雙方」或暱稱；原文保留追溯，改寫另記版本與證據限制。
- 不產生假伴侶答案、不用前端隱藏冒充後端保密、不以名目選項 ID 當分數。
- 程式變更執行 npm run check 與 npm run build，再做與變更相關的畫面檢查。
- 0.2 已實作 Node＋SQLite 的本機雙人骨架，題庫仍是三題示例；正式工具、分數、保存／刪除、雲端部署另依後續範圍辦理。
- 不在原始碼、log、測試或 VITE_ 變數中放私人答案、token、管理金鑰。
- 依使用者偏好，每個完整且已驗證的功能里程碑建立一次本機 commit；修正可獨立提交，不把多個無關大功能塞進同一筆。
- Commit 與發布版號分開：交付新功能升 0.x 的中間碼，交付修正升最後一碼；同步 package.json、package-lock.json 與 CHANGELOG.md。純文件整理通常不升版。
- 網站版號與 QuizDefinition.version 是不同概念。題目或結果規則變更要另更新該測驗版本，不因全站版號變更就一起修改所有題庫。
- 使用者已指定公開 repository https://github.com/tivico/between-us.git，origin/main 與 v0.1.0～v0.3.0 已推送；GitHub Pages 使用 Actions＋HTTPS，尚未發布。GitHub Pages 可承載前端，正式雙人儲存／解鎖仍需要另外後端。不要擅自改 remote 或 force push。
- 已確認初期免會員，後端保存＋每輪私人返回連結＋此裝置最近紀錄入口；不得以 browser-only 暫存當成跨裝置歷史。保存期限、刪除與遺失憑證找回仍待定。
- 感情科普也必須有可查核來源；分清楚研究發現、測量證據與自編應用。獨立科普＋結果短卡的分工已確認，文章與顯示條件仍待設計，不把尚未核定內容當正式功能。
- 第一份三觀聚焦核心價值與人生方向，依 docs/quizzes/core-values.md 開發；六個白話概念不是已驗證的六面向量表，正式題庫／計分須另核定。
- 已同意三觀契合度總覽作為趣味入口，定義為本輪價值取向相近程度；核心價值同頻度與人生方向交集分開。數字公式尚待核定，不產生假分數或關係成功率，不任意合併兩個區塊。
- 本機資料為 .local/data/between-us.sqlite，不能進入 Git／前端資產，維持 Vite fs.deny 的 .local 保護；不要刪除實際回合資料來讓測試通過。
- 後端與前端共用 src/content/quizzes.ts，原生 Node 讀取的 TypeScript import 需保留 .ts 副檔名。變更資料庫結構需明確 migration，不覆寫較新的 user_version。
- 0.3 已備妥 CI、手動 Pages workflow、公開 API URL／base 設定與 npm start 獨立 API；GitHub CI 已通過，仍不是已上線。後端方案／主機尚待選定，不假定能直接在 Pages 跑 SQLite。
- 公開 API 必須明確設定 DATA_FILE 與 ALLOWED_ORIGINS；只能單一實例＋持久磁碟，不能以會被重啟清空的檔案系統保存答案。Pages 發布先檢查後端健康狀態與 CORS，VITE_ 只放公開網址。
- 0.4 已選用 Cloudflare Workers＋D1，同一網址提供網頁/API。部署入口 wrangler.jsonc；雲端 store 在 cloudflare/store.mjs，schema 用 cloudflare/migrations。不要將 node:sqlite 帶進 Worker。
- 0.4 已上線 https://between-us.forest-between-us.workers.dev/ ，已設定真正 account_id / database_id，公開健康與完整雙人 API 已驗證。不要重建 D1；GitHub push 目前只做 CI，發布需 cloudflare:deploy。OAuth 由 Wrangler 管理，不提交到 repo。
- 本機 Node 與雲端 D1 是獨立資料庫；不自動搬移既有答案。改 API／提交規則時同步兩種 store，D1 必須使用交易／條件更新處理非同步競爭。
- 0.5 新增本機 `#/trial/core-values` 的 57 題中性候選試讀，來源 docs/quizzes/core-values-pvqrr.json，轉換在 src/content/core-values-trial.ts；不加入共用 quizzes 陣列或後端回合。答案／標記只在 React state，跳過保持未答，不提供分數。公開網站仍為 0.4，候選內容 0.2.0；不把工程試答當作實際訪談或測量驗證。
