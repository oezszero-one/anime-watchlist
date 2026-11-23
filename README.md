# ANIME LOG. (2025–2026 Watchlist · v1.1)

> Watch. Rate. Discover. — 2025～2026 新番動漫手機版檢核平台（第一階段 1.1）

## v1.1 功能亮點
- **兩年八季 610 部完整片單**：按年份拆分為 `data-2025.json`（291 部）與 `data-2026.json`（319 部），涵蓋冬、春、夏、秋四季新番，支援年份切換與列表分頁。
- **封面網址預先寫入＋雙來源自動補圖**：內建 `.github/workflows/fetch-covers.yml` 與 `scripts/fetch_covers.py`，上傳 GitHub 後可一鍵將 AniList／MyAnimeList 封面網址寫回片單 JSON；前端同時改用 `IntersectionObserver` 滑到哪抓到哪並具備破圖保護。
- **手機專用「一頁一部」模式**：自動偵測手機裝置預設進入單張滑動模式（含左右滑動、進度條與標記後自動下一部），並可隨時切回列表模式。
- **R18 分類與隱藏開關**：支援 `R18` 類型標籤篩選，並在「AI 推薦包／純文字分享」提供「隱藏 R18 作品」開關（預設勾選）。
- **淺色／深色雙主題切換**：頂部一鍵切換淺色／深色模式並自動記憶偏好。
- **關於頁**：頂部選單提供「關於」頁面（OEZS STUDIO）。

## 部署至 GitHub Pages 與一鍵預先寫入封面網址
1. 在 GitHub 建立名為 `anime-watchlist` 的公開 Repository。
2. 將本資料夾內的所有檔案（包含隱藏資料夾 `.github/workflows/fetch-covers.yml`、`scripts/fetch_covers.py`、`data-2025.json`、`data-2026.json`、`index.html`、`styles.css`、`app.js`、`manifest.webmanifest`）上傳至 `main` 分支根目錄。
3. 前往 **Settings → Pages**，選擇 `Deploy from a branch` → `main` / `/ (root)` 並儲存。
4. **一鍵預先寫入所有封面網址**：前往儲存庫的 **Actions** 分頁，點選左側 **「自動補齊動漫封面網址 (Fetch Covers)」**，點擊右上角 **Run workflow**。執行完成後 GitHub 會自動將所有抓到的封面圖網址寫入 `data-2025.json` 與 `data-2026.json` 並自動更新網站！
