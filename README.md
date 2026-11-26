# ANIME LOG. (v2.0 · Cloud Sync & Community)

> Watch. Rate. Discover. — 新番動漫手機版檢核平台（第二階段）

## v2.0 新增功能
- **初次訪問功能導覽**：首次開站自動彈出 4 步功能介紹，並提供「略過導覽 Skip」按鈕。
- **每日一推**：首頁依你的「喜歡／不喜歡」類型權重，每天從「沒看過」的作品中精選推薦一部。
- **推坑互動（🔥 +1）**：在每部作品卡片上點擊推坑，並讀取靜態統計快取 `stats.json`。
- **公開分享網址（`?share=...`）**：一鍵產生個人唯讀追番分享頁，並遵循「隱藏 R18」設定。
- **關於頁升級**：新增網站累計訪問人次與「回報問題（缺番／許願／異常）」彈窗。
- **Supabase 雲端同步與管理員面板**：支援匿名登入與 Email 免密碼登入跨裝置同步；設定 `adminUserIds` 後於選單開啟偵錯與使用者回報管理面板。

## 啟用第二階段 Supabase 雲端步驟
1. 前往 [Supabase](https://supabase.com/) 建立免費專案。
2. 打開 **SQL Editor**，貼上並執行本專案 `supabase/schema.sql` 內的全部 SQL。
3. 到 **Authentication → Providers** 確認啟用 **Anonymous Sign-Ins** 與 **Email**。
4. 打開本專案的 `config.js`，填入你的 `supabaseUrl`、`supabaseAnonKey` 與管理員 `adminUserIds`。
5. （省流量社群統計）在 GitHub 儲存庫的 **Settings → Secrets and variables → Actions** 新增 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`，即可每天自動更新 `stats.json`。
