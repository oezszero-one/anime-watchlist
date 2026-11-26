(function () {
  "use strict";

  const STORAGE_KEY = "anime_log_watchlist_v1";
  const PUSH_STORAGE_KEY = "anime_log_pushes_v2";
  const COVER_CACHE_KEY = "anime_log_covers_v2";
  const THEME_KEY = "anime_log_theme_v1";
  const LANG_KEY = "anime_log_lang_v1";
  const TOUR_KEY = "anime_log_tour_done_v2";
  const DAILY_KEY = "anime_log_daily_pick_v2";
  const VISIT_COUNT_LOCAL_KEY = "anime_log_visits_local_v2";
  const REPORTS_LOCAL_KEY = "anime_log_reports_local_v2";
  const PAGE_SIZE = 40;

  // ==================== 三語字典 ====================
  const I18N = {
    zh: {
      navHome: "首頁總覽", navCatalog: "新番檢核", navMyList: "我的清單", navAi: "AI 推薦包", navAbout: "關於",
      mobHome: "首頁", mobCatalog: "新番", mobMyList: "我的", mobAi: "AI 找片",
      heroBadge: "v2.0 · 雲端同步 · 每日一推 · 推坑互動",
      heroTitle: "新番動漫追番儀表板",
      heroSubtitle: "標記看過與喜好，一鍵打包給 AI 幫你從未看清單挖掘遺珠。",
      btnStartCheck: "開始檢核新番", btnGotoAi: "打包給 AI 找片",
      statRated: "已標記進度", statLikeRate: "評價喜歡率",
      dailyPickTitle: "✨ 今日為你推薦",
      dailyPickDesc: "每天依你的偏好類型權重，從「沒看過」的作品中精選一部。",
      dailyPickRefresh: "換一部看看",
      dailyPickReason: (g) => g ? `符合你偏好的類型：${g}` : "精選未看新番，標記喜好後推薦會更準確",
      dailyPickEmpty: "這個範圍內的作品你都標記過囉！",
      homeSeasonHeading: "各年度與季度片單進度",
      homeGenreHeading: "你的偏好類型分布（依「喜歡」作品統計）",
      homeGenreDesc: "標記越多喜歡的作品，這份類型口味分析與 AI 推薦包會越精準。",
      homeGenreEmpty: "你尚未標記任何「喜歡」的作品。前往「新番檢核」標記幾部喜歡的作品，這裡就會自動分析你的偏好類型！",
      modeSingle: "一頁一部", modeList: "列表模式",
      yearAll: "全部年份", yearSuffix: " 年",
      seasonAll: "全部季度", seasonWinter: "冬季 1月", seasonSpring: "春季 4月", seasonSummer: "夏季 7月", seasonFall: "秋季 10月",
      statusAll: "全部狀態", statusUnwatched: "沒看過", statusWatched: "看過", statusLiked: "喜歡", statusDisliked: "不喜歡",
      weekdayAll: "全部開播星期",
      genreAll: "全部類型", genreFilterLabel: "動畫類型篩選（電腦可用箭頭或滾輪左右滑動）", clearFilters: "清除篩選",
      searchPlaceholder: "搜尋中文、日文或英文片名...",
      myListSearchPlaceholder: "在我的清單中搜尋...",
      deviceMobileHint: "已偵測為手機裝置（可隨時切換列表）",
      deviceDesktopHint: "點擊按鈕即自動存檔",
      autoNext: "標記後自動下一部", btnPrev: "上一部", btnNext: "下一部",
      singleSwipeHint: "提示：可左右滑動卡片或使用下方按鈕切換作品",
      noMatch: "找不到符合目前條件的作品，試著清除部分篩選條件吧。",
      myListTitle: "我的追番紀錄清單", myListSubtitle: "管理所有已標記作品，支援匯出 CSV 與 JSON 備份。",
      myListEmptyTitle: "目前沒有符合條件的追番紀錄", myListEmptySub: "你可以前往「新番檢核」頁，將看過或喜歡的作品標記起來。",
      btnExportCsv: "匯出 CSV", btnExportJson: "備份 JSON", btnImportJson: "還原 JSON", btnClearAll: "重設全部",
      sortUpdated: "最新標記優先", sortId: "依年份與季度順序", sortWeekday: "依開播星期",
      aiTitle: "打包喜好清單給 AI 找「沒看過的遺珠」與分享",
      aiDesc: "自動彙整你「喜歡」的口味特徵、「不喜歡」的避雷清單，以及指定年份／季度的「沒看過」候選片單。支援三語提示詞、公開分享連結與隱藏 R18 作品。",
      aiExcludeShorts: "排除短篇／泡麵番", aiHideR18: "隱藏 R18 作品",
      aiLikedBox: "喜歡清單", aiDislikedBox: "不喜歡避雷", aiCandidateBox: "沒看過候選",
      aiPreviewLabel: "產生的 AI 推薦提示詞預覽",
      btnCopyShareUrl: "複製公開分享網址", btnCopyShare: "複製純文字分享", btnDownloadTxt: "下載 .txt", btnCopyAi: "一鍵複製給 AI",
      aboutVisitLabel: "網站累計訪問人次：", btnReportIssue: "回報問題", btnReplayTour: "功能導覽",
      reportModalTitle: "回報問題／缺番許願", btnSubmit: "送出回報",
      btnBack: "返回", btnUndo: "復原", btnCancel: "取消", btnConfirm: "確定",
      tourSkip: "略過導覽 Skip", tourPrev: "上一步", tourNext: "下一步", tourDone: "開始使用",
      tourSteps: [
        { title: "1. 快速檢核與手機「一頁一部」模式", body: "為每部新番標記「沒看過、看過、喜歡、不喜歡」。手機開啟會自動進入一頁一部滑動卡片模式，右上角也能隨時切換成列表。" },
        { title: "2. 多維篩選與 Google 快速搜圖", body: "可依年份、季度、狀態與動畫類型（含 R18）篩選；不確定有沒有看過時，點標題旁的放大鏡按鈕即可複製片名並另開 Google 搜尋。" },
        { title: "3. AI 找片提示包與 R18 隱藏", body: "切到「AI 推薦包」可一鍵打包你喜歡／避雷的作品與未看片單，貼給任何 AI 幫你挖出遺珠；預設可勾選隱藏 R18 作品。" },
        { title: "4. 每日一推、推坑互動與雲端分享", body: "首頁每天會依喜好為你推薦一部未看動畫，卡片支援 +1 推坑互動；登入雲端後還能跨裝置同步與產生專屬公開分享連結。" }
      ],
      pushLabel: "推坑",
      googleSearchTitle: "複製片名並用 Google 搜尋", googleKeyword: "動畫",
      copiedSearch: (t) => `已複製「${t}」並開啟 Google 搜尋`,
      markedToast: (t, st) => `「${t}」已標記為「${st}」`,
      resultCount: (n) => `符合條件共 ${n} 部作品`,
      myListCount: (n) => `共 ${n} 筆已標記紀錄`,
      loadMore: (n) => `載入更多作品（還有 ${n} 部）`,
      dislikedCountText: (n) => `${n} 部不喜歡`,
      seasonRatedText: (r, p) => `已標記 ${r} 部（${p}%）`,
      likedShort: (n) => `喜歡 ${n}`,
      likedGenreUnit: (n) => `${n} 部喜歡`,
      confirmResetTitle: "重設全部追番紀錄",
      confirmResetBody: "確定要清除所有已標記的紀錄嗎？建議先下載 JSON 備份。",
      copiedAi: "已複製 AI 推薦提示詞到剪貼簿！",
      copiedShare: "已複製純文字分享清單到剪貼簿！",
      copiedShareUrl: "已複製公開分享連結！",
      loadingYear: (y) => `正在載入 ${y} 年片單...`
    },
    ja: {
      navHome: "ホーム", navCatalog: "アニメ一覧", navMyList: "マイリスト", navAi: "AIおすすめ", navAbout: "About",
      mobHome: "ホーム", mobCatalog: "一覧", mobMyList: "記録", mobAi: "AI検索",
      heroBadge: "v2.0 · クラウド同期 · 毎日おすすめ · 推し投票",
      heroTitle: "アニメ視聴記録ダッシュボード",
      heroSubtitle: "視聴済みや好みを記録して、未視聴リストからAIに隠れた名作を探してもらおう。",
      btnStartCheck: "アニメを記録する", btnGotoAi: "AI用プロンプト作成",
      statRated: "記録済み", statLikeRate: "高評価率",
      dailyPickTitle: "✨ 今日のおすすめ",
      dailyPickDesc: "好みのジャンル傾向から、未視聴アニメを毎日1本ピックアップ。",
      dailyPickRefresh: "別の作品を見る",
      dailyPickReason: (g) => g ? `好みのジャンル：${g}` : "未視聴からランダム推薦（記録するほど精度アップ）",
      dailyPickEmpty: "この範囲の作品はすべて記録済みです！",
      homeSeasonHeading: "年度・クール別進捗",
      homeGenreHeading: "好みのジャンル傾向（「好き」基準）",
      homeGenreDesc: "「好き」な作品を多く記録するほど、ジャンル分析とAI推薦の精度が上がります。",
      homeGenreEmpty: "まだ「好き」な作品がありません。アニメ一覧から記録してみましょう！",
      modeSingle: "1件ずつ", modeList: "リスト表示",
      yearAll: "全年度", yearSuffix: "年",
      seasonAll: "全クール", seasonWinter: "冬 (1月)", seasonSpring: "春 (4月)", seasonSummer: "夏 (7月)", seasonFall: "秋 (10月)",
      statusAll: "すべて", statusUnwatched: "未視聴", statusWatched: "視聴済", statusLiked: "好き", statusDisliked: "苦手",
      weekdayAll: "全曜日",
      genreAll: "全ジャンル", genreFilterLabel: "ジャンル絞り込み（PCは矢印やホイールで横スクロール可）", clearFilters: "条件クリア",
      searchPlaceholder: "日本語・英語・中国語タイトルで検索...",
      myListSearchPlaceholder: "マイリストを検索...",
      deviceMobileHint: "スマホ自動検出（リスト切替可）",
      deviceDesktopHint: "ボタン押下で自動保存",
      autoNext: "記録後に自動で次へ", btnPrev: "前へ", btnNext: "次へ",
      singleSwipeHint: "ヒント：左右スワイプまたは下のボタンで切替できます",
      noMatch: "条件に一致する作品が見つかりませんでした。",
      myListTitle: "マイ視聴リスト", myListSubtitle: "記録済みの作品を管理。CSV出力やJSONバックアップに対応。",
      myListEmptyTitle: "記録済みの作品がありません", myListEmptySub: "「アニメ一覧」から視聴した作品を記録してください。",
      btnExportCsv: "CSV出力", btnExportJson: "JSON保存", btnImportJson: "JSON復元", btnClearAll: "全リセット",
      sortUpdated: "更新が新しい順", sortId: "年度・クール順", sortWeekday: "放送曜日順",
      aiTitle: "AIおすすめ用プロンプト作成＆シェア",
      aiDesc: "「好き」「苦手」の傾向と指定年度・クールの「未視聴」リストを自動整形。R18作品の非表示にも対応。",
      aiExcludeShorts: "ショートアニメを除外", aiHideR18: "R18作品を非表示",
      aiLikedBox: "好き", aiDislikedBox: "苦手", aiCandidateBox: "未視聴候補",
      aiPreviewLabel: "生成されたAI推薦プロンプト",
      btnCopyShareUrl: "公開シェアURLコピー", btnCopyShare: "共有テキストコピー", btnDownloadTxt: ".txt保存", btnCopyAi: "AI用にコピー",
      aboutVisitLabel: "累計アクセス数：", btnReportIssue: "不具合・要望報告", btnReplayTour: "ガイドを見る",
      reportModalTitle: "不具合報告・作品リクエスト", btnSubmit: "送信する",
      btnBack: "戻る", btnUndo: "元に戻す", btnCancel: "キャンセル", btnConfirm: "確定",
      tourSkip: "スキップ Skip", tourPrev: "前へ", tourNext: "次へ", tourDone: "はじめる",
      tourSteps: [
        { title: "1. かんたん記録＆スマホ「1件ずつ」モード", body: "「未視聴・視聴済・好き・苦手」をワンタップで記録。スマホでは1件ずつスワイプできるカード表示になり、リスト表示にも切替可能です。" },
        { title: "2. 絞り込み＆Google検索ボタン", body: "年度・クール・ジャンル（R18含む）で絞り込み可能。見たか迷ったらタイトル横の虫眼鏡ボタンでコピー＆Google検索ができます。" },
        { title: "3. AIおすすめ用プロンプト出力", body: "「AIおすすめ」タブから好みの傾向と未視聴リストをまとめてコピー。そのままAIに貼るだけで隠れた名作を提案してもらえます。" },
        { title: "4. 今日のおすすめ＆推し投票・クラウド同期", body: "ホーム画面で毎日1本おすすめを表示。推しボタン（+1）や公開シェアURL、クラウド同期にも対応しています。" }
      ],
      pushLabel: "推し",
      googleSearchTitle: "タイトルをコピーしてGoogle検索", googleKeyword: "アニメ",
      copiedSearch: (t) => `「${t}」をコピーしてGoogle検索を開きました`,
      markedToast: (t, st) => `「${t}」を「${st}」にしました`,
      resultCount: (n) => `該当作品：${n} 件`,
      myListCount: (n) => `記録済み：${n} 件`,
      loadMore: (n) => `さらに読み込む（残り ${n} 件）`,
      dislikedCountText: (n) => `苦手 ${n}件`,
      seasonRatedText: (r, p) => `記録 ${r}件（${p}%）`,
      likedShort: (n) => `好き ${n}`,
      likedGenreUnit: (n) => `${n}件`,
      confirmResetTitle: "全記録をリセット",
      confirmResetBody: "すべての視聴記録を削除しますか？先にJSONバックアップを推奨します。",
      copiedAi: "AI用プロンプトをコピーしました！",
      copiedShare: "共有テキストをコピーしました！",
      copiedShareUrl: "公開シェアURLをコピーしました！",
      loadingYear: (y) => `${y}年のデータを読み込み中...`
    },
    en: {
      navHome: "Home", navCatalog: "Catalog", navMyList: "My List", navAi: "AI Prompt", navAbout: "About",
      mobHome: "Home", mobCatalog: "Catalog", mobMyList: "My List", mobAi: "AI Pick",
      heroBadge: "v2.0 · Cloud Sync · Daily Pick · Reactions",
      heroTitle: "Anime Watchlist Dashboard",
      heroSubtitle: "Rate what you've watched and export a ready-to-paste prompt so AI can find hidden gems you missed.",
      btnStartCheck: "Browse Catalog", btnGotoAi: "Build AI Prompt",
      statRated: "Rated Progress", statLikeRate: "Like Ratio",
      dailyPickTitle: "✨ Daily Pick for You",
      dailyPickDesc: "One unwatched anime picked daily based on your liked genre weights.",
      dailyPickRefresh: "Pick Another",
      dailyPickReason: (g) => g ? `Matches your taste: ${g}` : "Curated unwatched pick (rate more to refine)",
      dailyPickEmpty: "You've rated everything in this scope!",
      homeSeasonHeading: "Progress by Year & Season",
      homeGenreHeading: "Your Favorite Genres (from Liked Anime)",
      homeGenreDesc: "The more anime you mark as Liked, the sharper your genre profile and AI recommendations become.",
      homeGenreEmpty: "No Liked anime yet. Head to Catalog and mark a few favorites!",
      modeSingle: "1-by-1 Card", modeList: "List View",
      yearAll: "All Years", yearSuffix: "",
      seasonAll: "All Seasons", seasonWinter: "Winter (Jan)", seasonSpring: "Spring (Apr)", seasonSummer: "Summer (Jul)", seasonFall: "Fall (Oct)",
      statusAll: "All Status", statusUnwatched: "Unwatched", statusWatched: "Watched", statusLiked: "Liked", statusDisliked: "Disliked",
      weekdayAll: "All Days",
      genreAll: "All Genres", genreFilterLabel: "Genre Filter (use arrows or mouse wheel on desktop)", clearFilters: "Clear Filters",
      searchPlaceholder: "Search English, Japanese, or Chinese title...",
      myListSearchPlaceholder: "Search in My List...",
      deviceMobileHint: "Mobile detected (switchable to List)",
      deviceDesktopHint: "Changes auto-save locally",
      autoNext: "Auto-next after rating", btnPrev: "Prev", btnNext: "Next",
      singleSwipeHint: "Tip: Swipe left/right or use the buttons below",
      noMatch: "No anime match your current filters.",
      myListTitle: "My Watchlist", myListSubtitle: "Manage rated titles, export CSV, or backup/restore JSON.",
      myListEmptyTitle: "No rated anime yet", myListEmptySub: "Go to Catalog to mark anime you've watched or liked.",
      btnExportCsv: "Export CSV", btnExportJson: "Backup JSON", btnImportJson: "Restore JSON", btnClearAll: "Reset All",
      sortUpdated: "Recently Updated", sortId: "Year & Season", sortWeekday: "Broadcast Day",
      aiTitle: "AI Recommendation Prompt & Share Export",
      aiDesc: "Packages your Liked tastes, Disliked titles, and Unwatched candidates from a chosen year/season. Supports hiding R18 titles.",
      aiExcludeShorts: "Exclude Shorts", aiHideR18: "Hide R18 Titles",
      aiLikedBox: "Liked", aiDislikedBox: "Disliked", aiCandidateBox: "Unwatched Pool",
      aiPreviewLabel: "Generated AI Prompt Preview",
      btnCopyShareUrl: "Copy Share URL", btnCopyShare: "Copy Share Text", btnDownloadTxt: "Download .txt", btnCopyAi: "Copy Prompt for AI",
      aboutVisitLabel: "Total Site Visits:", btnReportIssue: "Report Issue", btnReplayTour: "Feature Tour",
      reportModalTitle: "Report Issue / Request Anime", btnSubmit: "Submit",
      btnBack: "Back", btnUndo: "Undo", btnCancel: "Cancel", btnConfirm: "Confirm",
      tourSkip: "Skip Tour", tourPrev: "Prev", tourNext: "Next", tourDone: "Get Started",
      tourSteps: [
        { title: "1. Fast Watchlist & Mobile 1-by-1 Mode", body: "Mark titles as Unwatched, Watched, Liked, or Disliked. On mobile, you automatically get a swipeable 1-by-1 card mode (switchable to List anytime)." },
        { title: "2. Multi-Filters & Quick Google Search", body: "Filter by year, season, status, and genres (including R18). Click the search icon next to any title to copy it and open Google Search." },
        { title: "3. AI Recommendation Prompt Builder", body: "Export your Liked/Disliked tastes and Unwatched pool as a structured prompt for any AI to uncover hidden gems, with an option to hide R18 titles." },
        { title: "4. Daily Pick, Reactions & Cloud Sync", body: "Get a tailored Daily Pick on Home, +1 recommend titles to others, share your public list URL, and sync across devices via Supabase." }
      ],
      pushLabel: "Rec",
      googleSearchTitle: "Copy title & search on Google", googleKeyword: "anime",
      copiedSearch: (t) => `Copied "${t}" & opened Google Search`,
      markedToast: (t, st) => `Marked "${t}" as ${st}`,
      resultCount: (n) => `${n} titles found`,
      myListCount: (n) => `${n} rated titles`,
      loadMore: (n) => `Load More (${n} remaining)`,
      dislikedCountText: (n) => `${n} disliked`,
      seasonRatedText: (r, p) => `${r} rated (${p}%)`,
      likedShort: (n) => `Liked ${n}`,
      likedGenreUnit: (n) => `${n} liked`,
      confirmResetTitle: "Reset All Watchlist Data",
      confirmResetBody: "Clear all your rated anime records? Consider backing up JSON first.",
      copiedAi: "AI prompt copied to clipboard!",
      copiedShare: "Share text copied to clipboard!",
      copiedShareUrl: "Public share URL copied!",
      loadingYear: (y) => `Loading ${y} catalog...`
    }
  };

  const GENRE_I18N = {
    "奇幻": { ja: "ファンタジー", en: "Fantasy" }, "戰鬥": { ja: "バトル", en: "Action" },
    "動作": { ja: "アクション", en: "Action" }, "冒險": { ja: "冒険", en: "Adventure" },
    "異世界": { ja: "異世界", en: "Isekai" }, "轉生": { ja: "転生", en: "Reincarnation" },
    "戀愛": { ja: "恋愛", en: "Romance" }, "日常": { ja: "日常", en: "Slice of Life" },
    "喜劇": { ja: "コメディ", en: "Comedy" }, "懸疑": { ja: "ミステリー", en: "Mystery" },
    "科幻": { ja: "SF", en: "Sci-Fi" }, "校園": { ja: "学園", en: "School" },
    "運動": { ja: "スポーツ", en: "Sports" }, "競技": { ja: "競技", en: "Competitive" },
    "音樂": { ja: "音楽", en: "Music" }, "偶像": { ja: "アイドル", en: "Idol" },
    "歷史": { ja: "歴史", en: "Historical" }, "恐怖": { ja: "ホラー", en: "Horror" },
    "職場": { ja: "お仕事", en: "Workplace" }, "短篇": { ja: "ショート", en: "Short" },
    "超自然": { ja: "超常現象", en: "Supernatural" }, "超能力": { ja: "超能力", en: "Superpower" },
    "劇情": { ja: "ドラマ", en: "Drama" }, "青春": { ja: "青春", en: "Youth" },
    "治癒": { ja: "癒やし", en: "Iyashikei" }, "魔法": { ja: "魔法", en: "Magic" },
    "魔法少女": { ja: "魔法少女", en: "Mahou Shoujo" }, "機甲": { ja: "メカ", en: "Mecha" },
    "心理": { ja: "心理", en: "Psychological" }, "鬥智": { ja: "頭脳戦", en: "Mind Games" },
    "黑暗": { ja: "ダーク", en: "Dark" }, "美食": { ja: "グルメ", en: "Gourmet" },
    "戰爭": { ja: "戦争", en: "Military" }, "宮廷": { ja: "宮廷", en: "Court" },
    "勵志": { ja: "成長", en: "Inspiring" }, "闔家觀賞": { ja: "ファミリー", en: "Family" },
    "R18": { ja: "R18", en: "R18" }
  };

  const WEEKDAY_I18N = {
    "星期一": { ja: "月曜", en: "Mon" }, "星期二": { ja: "火曜", en: "Tue" },
    "星期三": { ja: "水曜", en: "Wed" }, "星期四": { ja: "木曜", en: "Thu" },
    "星期五": { ja: "金曜", en: "Fri" }, "星期六": { ja: "土曜", en: "Sat" },
    "星期日": { ja: "日曜", en: "Sun" }, "一次上架": { ja: "一挙配信", en: "All at once" }
  };

  const WEEKDAY_ORDER = {
    "星期一": 1, "星期二": 2, "星期三": 3, "星期四": 4,
    "星期五": 5, "星期六": 6, "星期日": 7, "一次上架": 8
  };

  const SEASON_PARTS = ["winter", "spring", "summer", "fall"];

  // ==================== Supabase 第二階段整合層 ====================
  const cfg = window.ANIME_LOG_CONFIG || {};
  let sbClient = null;
  let currentUser = null;
  let communityStats = {}; // animeId -> { watched, liked, disliked, push }

  function isSupabaseConfigured() {
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  }

  function isAdminUser() {
    if (isDebugParam) return true;
    if (!currentUser || !Array.isArray(cfg.adminUserIds)) return false;
    return cfg.adminUserIds.includes(currentUser.id);
  }

  function updateAuthUI() {
    const dot = document.getElementById("auth-dot");
    const label = document.getElementById("auth-btn-label");
    const dbgDesk = document.getElementById("nav-debug-desktop");
    const dbgMob = document.getElementById("nav-debug-mobile");

    if (currentUser && sbClient) {
      if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400";
      if (label) label.textContent = currentUser.is_anonymous ? "雲端(匿名)" : "已登入";
    } else if (isSupabaseConfigured()) {
      if (dot) dot.className = "w-2 h-2 rounded-full bg-amber-400";
      if (label) label.textContent = "未連線";
    } else {
      if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-400";
      if (label) label.textContent = "本機";
    }

    const admin = isAdminUser();
    if (dbgDesk) dbgDesk.classList.toggle("hidden", !admin);
    if (dbgMob) dbgMob.classList.toggle("hidden", !admin);
  }

  async function initSupabaseAndSync() {
    if (!isSupabaseConfigured()) {
      updateAuthUI();
      return;
    }
    try {
      sbClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data: sessionData } = await sbClient.auth.getSession();
      currentUser = sessionData?.session?.user || null;

      if (!currentUser && sbClient.auth.signInAnonymously) {
        const { data: anonData } = await sbClient.auth.signInAnonymously();
        currentUser = anonData?.user || null;
      }

      if (currentUser) {
        await syncWatchlistWithCloud();
        await syncPushesWithCloud();
      }
      await trackVisitCount();
    } catch (e) {
      // 若連線異常自動降級為本機模式
    }
    updateAuthUI();
  }

  async function syncWatchlistWithCloud() {
    if (!sbClient || !currentUser) return;
    try {
      const { data: cloudRows } = await sbClient
        .from("user_watchlist")
        .select("anime_id,status,updated_at")
        .eq("user_id", currentUser.id);

      const localItems = store.items || {};
      const upserts = [];

      if (Array.isArray(cloudRows)) {
        cloudRows.forEach((row) => {
          const loc = localItems[row.anime_id];
          if (!loc || (row.updated_at && row.updated_at > (loc.updatedAt || ""))) {
            localItems[row.anime_id] = { status: row.status, updatedAt: row.updated_at };
          }
        });
      }

      Object.entries(localItems).forEach(([aid, entry]) => {
        if (entry && entry.status && entry.status !== "unwatched") {
          const cloudMatch = (cloudRows || []).find((r) => r.anime_id === aid);
          if (!cloudMatch || (entry.updatedAt || "") > (cloudMatch.updated_at || "")) {
            upserts.push({
              user_id: currentUser.id,
              anime_id: aid,
              status: entry.status,
              updated_at: entry.updatedAt || new Date().toISOString()
            });
          }
        }
      });

      store.items = localItems;
      StorageAdapter.save(store);

      if (upserts.length > 0) {
        await sbClient.from("user_watchlist").upsert(upserts);
      }
    } catch (e) {}
  }

  async function syncPushesWithCloud() {
    if (!sbClient || !currentUser) return;
    try {
      const { data } = await sbClient
        .from("anime_recommendations")
        .select("anime_id")
        .eq("user_id", currentUser.id);
      if (Array.isArray(data)) {
        data.forEach((r) => userPushes.add(r.anime_id));
        saveUserPushes();
      }
    } catch (e) {}
  }

  async function loadCommunityStats() {
    if (window.ANIME_STATS_DATA && window.ANIME_STATS_DATA.items) {
      communityStats = window.ANIME_STATS_DATA.items;
      return;
    }
    try {
      const res = await fetch("./stats.json");
      if (res.ok) {
        const json = await res.json();
        if (json && json.items) communityStats = json.items;
      }
    } catch (e) {}
  }

  async function trackVisitCount() {
    const el = document.getElementById("about-visit-count");
    let visitedThisSession = false;
    try {
      visitedThisSession = Boolean(window.sessionStorage.getItem("anime_log_visited"));
      if (!visitedThisSession) window.sessionStorage.setItem("anime_log_visited", "1");
    } catch (e) {}

    if (sbClient) {
      try {
        if (!visitedThisSession) {
          const { data } = await sbClient.rpc("increment_visit_count");
          if (typeof data === "number" && el) {
            el.textContent = data.toLocaleString();
            return;
          }
        }
        const { data: row } = await sbClient
          .from("site_metrics")
          .select("value")
          .eq("key", "total_visits")
          .single();
        if (row && el) {
          el.textContent = Number(row.value || 0).toLocaleString();
          return;
        }
      } catch (e) {}
    }

    // 本機計數備援
    let localCount = 1;
    try {
      localCount = Number(window.localStorage.getItem(VISIT_COUNT_LOCAL_KEY) || "0");
      if (!visitedThisSession) {
        localCount += 1;
        window.localStorage.setItem(VISIT_COUNT_LOCAL_KEY, String(localCount));
      }
    } catch (e) {}
    if (el) el.textContent = `${localCount.toLocaleString()}`;
  }

  // ==================== 本地儲存與主題／語言 ====================
  const StorageAdapter = {
    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { schemaVersion: 1, updatedAt: null, items: {} };
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.items === "object" && parsed.items !== null) return parsed;
      } catch (e) {}
      return { schemaVersion: 1, updatedAt: null, items: {} };
    },
    save(data) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
    }
  };

  let userPushes = new Set();
  try {
    const rawP = window.localStorage.getItem(PUSH_STORAGE_KEY);
    if (rawP) userPushes = new Set(JSON.parse(rawP));
  } catch (e) {}
  function saveUserPushes() {
    try { window.localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify(Array.from(userPushes))); } catch (e) {}
  }

  const ThemeManager = {
    current: "dark",
    init() {
      let saved = null;
      try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) {}
      this.apply(saved === "light" ? "light" : "dark", false);
    },
    apply(theme, persist) {
      this.current = theme;
      const html = document.documentElement;
      html.classList.remove("dark", "light");
      html.classList.add(theme);
      const sun = document.getElementById("icon-sun");
      const moon = document.getElementById("icon-moon");
      if (sun && moon) {
        sun.classList.toggle("hidden", theme !== "dark");
        moon.classList.toggle("hidden", theme !== "light");
      }
      if (persist) {
        try { window.localStorage.setItem(THEME_KEY, theme); } catch (e) {}
      }
    },
    toggle() {
      this.apply(this.current === "dark" ? "light" : "dark", true);
    }
  };

  function detectInitialLang() {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved && I18N[saved]) return saved;
    } catch (e) {}
    const nav = (navigator.language || "zh-TW").toLowerCase();
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("en")) return "en";
    return "zh";
  }

  function detectMobileDevice() {
    const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
    const narrowScreen = window.innerWidth < 768;
    const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    return uaMobile || narrowScreen || coarsePointer;
  }

  function cleanJpTitle(title) {
    return String(title || "")
      .replace(/[～〜~].*?[～〜~]/g, " ")
      .replace(/[（(].*?[）)]/g, " ")
      .replace(/(第\s*\d+\s*期|\d+\s*期|[一二三四五六七八九十]+期|第\s*\d+\s*クール|Season\s*\d+|FINAL\s*SEASON|続編|後編|前編)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ==================== 封面管理 ====================
  const CoverArtManager = {
    cache: {}, pending: new Set(), failed: new Set(), queue: [], running: false, observer: null,

    init() {
      try {
        const raw = window.localStorage.getItem(COVER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") this.cache = parsed;
        }
      } catch (e) { this.cache = {}; }
      if (typeof IntersectionObserver !== "undefined") {
        this.observer = new IntersectionObserver(
          (entries) => {
            const batch = [];
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const el = entry.target;
              this.observer.unobserve(el);
              const anime = animeMap.get(el.dataset.posterId);
              if (anime && !this.getUrl(anime)) batch.push(anime);
            });
            if (batch.length > 0) this.enqueue(batch);
          },
          { rootMargin: "240px 0px" }
        );
      }
    },

    observeRenderedPosters(rootEl) {
      if (!rootEl || !this.observer) return;
      rootEl.querySelectorAll("[data-poster-id]").forEach((box) => {
        const anime = animeMap.get(box.dataset.posterId);
        if (anime && !this.getUrl(anime)) this.observer.observe(box);
      });
    },

    saveCache() {
      try { window.localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(this.cache)); } catch (e) {}
    },

    getUrl(anime) {
      if (!anime) return null;
      return anime.coverUrl || this.cache[anime.id] || null;
    },

    enqueue(items) {
      let added = false;
      items.forEach((a) => {
        if (!a || !a.id) return;
        if (this.getUrl(a) || this.pending.has(a.id) || this.failed.has(a.id)) return;
        this.pending.add(a.id);
        this.queue.push(a);
        added = true;
      });
      if (added && !this.running) this.processQueue();
    },

    async processQueue() {
      if (this.running) return;
      this.running = true;
      while (this.queue.length > 0) {
        const anime = this.queue.shift();
        await this.fetchOne(anime);
        await new Promise((r) => setTimeout(r, 260));
      }
      this.running = false;
    },

    async fetchAniList(q) {
      const query = `query ($search: String) { Media(search: $search, type: ANIME, sort: SEARCH_MATCH) { coverImage { large medium } } }`;
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables: { search: q } })
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data?.Media?.coverImage?.large || json?.data?.Media?.coverImage?.medium || null;
      } catch (e) { return null; }
    },

    async fetchJikan(q) {
      try {
        const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1`, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const json = await res.json();
        const first = json?.data?.[0];
        return first?.images?.jpg?.large_image_url || first?.images?.jpg?.image_url || null;
      } catch (e) { return null; }
    },

    async fetchOne(anime) {
      try {
        const rawJp = (anime.titleJp || anime.titleZh || "").trim();
        const cleaned = cleanJpTitle(rawJp);
        const candidates = cleaned && cleaned !== rawJp ? [rawJp, cleaned] : [rawJp];
        let imgUrl = null;
        for (const q of candidates) {
          imgUrl = await this.fetchAniList(q);
          if (imgUrl) break;
        }
        if (!imgUrl) {
          for (const q of candidates) {
            imgUrl = await this.fetchJikan(q);
            if (imgUrl) break;
          }
        }
        if (imgUrl) {
          this.cache[anime.id] = imgUrl;
          this.saveCache();
          document.querySelectorAll(`[data-poster-id="${CSS.escape(anime.id)}"]`).forEach((box) => {
            const img = box.querySelector("img");
            const fallback = box.querySelector("[data-poster-fallback]");
            if (img) { img.src = imgUrl; img.classList.remove("hidden"); }
            if (fallback) fallback.classList.add("hidden");
          });
        } else {
          this.failed.add(anime.id);
        }
      } finally {
        this.pending.delete(anime.id);
      }
    }
  };

  // ==================== 資料索引與年份載入 ====================
  let manifestYears = [];
  const loadedYears = new Map();
  let animeList = [];
  let animeMap = new Map();
  let genreCountsAll = {};
  let allGenres = [];
  let debugLastIssues = [];

  let store = StorageAdapter.load();
  let lastSnapshot = null;
  let toastTimer = null;
  const isInitialMobile = detectMobileDevice();
  const urlParams = new URLSearchParams(window.location.search);
  const isDebugParam = urlParams.get("debug") === "1";
  const shareUidParam = urlParams.get("share") || "";

  const state = {
    lang: detectInitialLang(),
    view: "home",
    prevView: "home",
    homeYear: "2026",
    catalogYear: "2026",
    catalogSeasonPart: "all",
    catalogSearch: "",
    catalogStatus: "all",
    catalogWeekday: "all",
    catalogGenre: "all",
    catalogDisplayMode: isInitialMobile ? "card" : "list",
    catalogLimit: PAGE_SIZE,
    singleIndex: 0,
    singleAutoNext: true,
    mylistSearch: "",
    mylistYear: "all",
    mylistStatus: "all",
    mylistSort: "updated",
    aiYearScope: "2026",
    aiSeasonPart: "all",
    aiExcludeShorts: true,
    aiHideR18: true,
    tourStep: 0
  };

  function t(key) {
    return (I18N[state.lang] && I18N[state.lang][key]) || I18N.zh[key] || key;
  }

  function genreLabel(g) {
    if (state.lang === "zh") return g;
    return (GENRE_I18N[g] && GENRE_I18N[g][state.lang]) || g;
  }

  function weekdayLabel(w) {
    if (state.lang === "zh") return w;
    return (WEEKDAY_I18N[w] && WEEKDAY_I18N[w][state.lang]) || w;
  }

  function statusLabel(st) {
    const map = { unwatched: "statusUnwatched", watched: "statusWatched", liked: "statusLiked", disliked: "statusDisliked" };
    return t(map[st] || "statusUnwatched");
  }

  function seasonLabel(seasonKey, shortMode) {
    const [yr, part] = String(seasonKey || "").split("-");
    const partMap = {
      zh: { winter: shortMode ? "冬" : "冬季", spring: shortMode ? "春" : "春季", summer: shortMode ? "夏" : "夏季", fall: shortMode ? "秋" : "秋季" },
      ja: { winter: "冬", spring: "春", summer: "夏", fall: "秋" },
      en: { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" }
    };
    const pText = (partMap[state.lang] && partMap[state.lang][part]) || part || "";
    return state.lang === "en" ? `${pText} ${yr}` : `${yr} ${pText}`;
  }

  function getDisplayTitles(anime) {
    const zh = anime.titleZh || anime.titleJp || "";
    const jp = anime.titleJp || anime.titleZh || "";
    const en = anime.titleEn || "";
    if (state.lang === "ja") return { primary: jp, secondary: en || (zh !== jp ? zh : "") };
    if (state.lang === "en") return { primary: en || jp, secondary: en ? jp : "" };
    return { primary: zh, secondary: jp !== zh ? jp : "" };
  }

  function isR18Anime(anime) {
    return Array.isArray(anime.genres) && anime.genres.includes("R18");
  }

  function rebuildIndexes() {
    const yearsDesc = Array.from(loadedYears.keys()).sort((a, b) => b - a);
    animeList = yearsDesc.flatMap((y) => loadedYears.get(y) || []);
    animeMap = new Map(animeList.map((item) => [item.id, item]));
    genreCountsAll = {};
    animeList.forEach((a) => {
      (a.genres || []).forEach((g) => {
        genreCountsAll[g] = (genreCountsAll[g] || 0) + 1;
      });
    });
    allGenres = Object.keys(genreCountsAll).sort((a, b) => {
      if (a === "R18") return 1;
      if (b === "R18") return -1;
      return genreCountsAll[b] - genreCountsAll[a];
    });

    const totalCatalogCount = manifestYears.reduce((acc, y) => acc + (y.count || 0), 0) || animeList.length;
    const minY = manifestYears.length ? Math.min(...manifestYears.map((y) => y.year)) : 2025;
    const maxY = manifestYears.length ? Math.max(...manifestYears.map((y) => y.year)) : 2026;

    const badge = document.getElementById("header-year-badge");
    if (badge) badge.textContent = minY === maxY ? `${maxY}` : `${minY}–${maxY}`;
    const sub = document.getElementById("header-subtitle");
    if (sub) sub.textContent = `Watch. Rate. Discover. · ${totalCatalogCount}`;
    const allTotalEl = document.getElementById("stat-all-total");
    if (allTotalEl) allTotalEl.textContent = `/ ${totalCatalogCount}`;
  }

  async function initManifest() {
    if (window.ANIME_YEARS_MANIFEST && Array.isArray(window.ANIME_YEARS_MANIFEST.years)) {
      manifestYears = window.ANIME_YEARS_MANIFEST.years.slice().sort((a, b) => b.year - a.year);
      return;
    }
    try {
      const res = await fetch("./years-manifest.json");
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.years) && json.years.length > 0) {
          manifestYears = json.years.slice().sort((a, b) => b.year - a.year);
          return;
        }
      }
    } catch (e) {}
    manifestYears = [
      { year: 2026, file: "data-2026.json", count: 319 },
      { year: 2025, file: "data-2025.json", count: 291 }
    ];
  }

  async function ensureYearLoaded(yearInt) {
    const y = Number(yearInt);
    if (loadedYears.has(y)) return;
    if (window.ANIME_DATA_BY_YEAR && Array.isArray(window.ANIME_DATA_BY_YEAR[y])) {
      loadedYears.set(y, window.ANIME_DATA_BY_YEAR[y]);
      rebuildIndexes();
      return;
    }
    const info = manifestYears.find((item) => item.year === y);
    const filename = info ? info.file : `data-${y}.json`;
    try {
      const res = await fetch(`./${filename}`);
      if (res.ok) {
        const arr = await res.json();
        loadedYears.set(y, Array.isArray(arr) ? arr : []);
      } else {
        loadedYears.set(y, []);
      }
    } catch (e) {
      loadedYears.set(y, []);
    }
    rebuildIndexes();
  }

  async function ensureAllYearsLoaded() {
    await Promise.all(manifestYears.map((y) => ensureYearLoaded(y.year)));
  }

  // ==================== 狀態 & 推坑操作 ====================
  function getStatus(animeId) {
    const entry = store.items[animeId];
    return entry && entry.status ? entry.status : "unwatched";
  }

  function getUpdatedAt(animeId) {
    const entry = store.items[animeId];
    return entry && entry.updatedAt ? entry.updatedAt : "";
  }

  function setStatus(animeId, nextStatus, skipUndo) {
    const prevStatus = getStatus(animeId);
    if (prevStatus === nextStatus) return;

    if (!skipUndo) {
      lastSnapshot = {
        animeId,
        prevStatus,
        prevEntry: store.items[animeId] ? { ...store.items[animeId] } : null
      };
    }

    const nowIso = new Date().toISOString();
    if (nextStatus === "unwatched") delete store.items[animeId];
    else store.items[animeId] = { status: nextStatus, updatedAt: nowIso };

    store.updatedAt = nowIso;
    StorageAdapter.save(store);

    // 非同步同步至 Supabase
    if (sbClient && currentUser) {
      if (nextStatus === "unwatched") {
        sbClient.from("user_watchlist").delete().eq("user_id", currentUser.id).eq("anime_id", animeId).then(() => {});
      } else {
        sbClient.from("user_watchlist").upsert({
          user_id: currentUser.id,
          anime_id: animeId,
          status: nextStatus,
          updated_at: nowIso
        }).then(() => {});
      }
    }

    const anime = animeMap.get(animeId);
    const title = anime ? getDisplayTitles(anime).primary : "Anime";
    showToast(t("markedToast")(title, statusLabel(nextStatus)), !skipUndo);

    const shouldAdvance =
      !skipUndo &&
      state.view === "catalog" &&
      state.catalogDisplayMode === "card" &&
      state.singleAutoNext &&
      state.catalogStatus === "all";

    if (shouldAdvance) {
      renderAll();
      setTimeout(() => {
        const filtered = getFilteredCatalog();
        if (state.singleIndex < filtered.length - 1) {
          state.singleIndex += 1;
          renderCatalog();
        }
      }, 180);
    } else {
      renderAll();
    }
  }

  function togglePush(animeId) {
    const pushed = userPushes.has(animeId);
    if (pushed) {
      userPushes.delete(animeId);
      if (sbClient && currentUser) {
        sbClient.from("anime_recommendations").delete().eq("user_id", currentUser.id).eq("anime_id", animeId).then(() => {});
      }
    } else {
      userPushes.add(animeId);
      if (sbClient && currentUser) {
        sbClient.from("anime_recommendations").upsert({ user_id: currentUser.id, anime_id: animeId }).then(() => {});
      }
    }
    saveUserPushes();
    renderAll();
  }

  function getPushCount(animeId) {
    const base = (communityStats[animeId] && communityStats[animeId].push) || 0;
    return base + (userPushes.has(animeId) ? 1 : 0);
  }

  // ==================== 每日一推演算法 ====================
  function computeDailyPick(forceRefresh) {
    const today = new Date().toISOString().slice(0, 10);
    if (!forceRefresh) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(DAILY_KEY) || "null");
        if (saved && saved.date === today && saved.animeId && animeMap.has(saved.animeId)) {
          const cand = animeMap.get(saved.animeId);
          if (getStatus(cand.id) === "unwatched") return saved;
        }
      } catch (e) {}
    }

    const hideR18 = state.aiHideR18;
    const pool = animeList.filter((a) => getStatus(a.id) === "unwatched" && !(hideR18 && isR18Anime(a)));
    if (pool.length === 0) return null;

    const genreScore = {};
    animeList.forEach((a) => {
      const st = getStatus(a.id);
      if (st === "liked") (a.genres || []).forEach((g) => { genreScore[g] = (genreScore[g] || 0) + 3; });
      if (st === "disliked") (a.genres || []).forEach((g) => { genreScore[g] = (genreScore[g] || 0) - 2; });
    });

    const scored = pool.map((a) => {
      let score = 0;
      const matched = [];
      (a.genres || []).forEach((g) => {
        const w = genreScore[g] || 0;
        score += w;
        if (w > 0) matched.push(g);
      });
      // 加入微小隨機擾動，讓同分作品每天不同
      score += Math.random() * 1.5;
      return { anime: a, score, matched };
    });

    scored.sort((a, b) => b.score - a.score);
    const topSlice = scored.slice(0, Math.min(8, scored.length));
    const chosen = topSlice[Math.floor(Math.random() * topSlice.length)];
    const payload = { date: today, animeId: chosen.anime.id, matchedGenres: chosen.matched.slice(0, 3) };
    try { window.localStorage.setItem(DAILY_KEY, JSON.stringify(payload)); } catch (e) {}
    return payload;
  }

  function renderDailyPick(forceRefresh) {
    const container = document.getElementById("home-daily-pick");
    if (!container) return;
    const pick = computeDailyPick(Boolean(forceRefresh));
    if (!pick || !animeMap.has(pick.animeId)) {
      container.innerHTML = `<div class="rounded-xl surface-stat p-4 text-xs sm:text-sm text-dim text-center">${escapeHtml(t("dailyPickEmpty"))}</div>`;
      return;
    }
    const anime = animeMap.get(pick.animeId);
    const { primary, secondary } = getDisplayTitles(anime);
    const reasonGenres = (pick.matchedGenres || []).map(genreLabel).join(" / ");
    const reasonText = t("dailyPickReason")(reasonGenres);

    container.innerHTML = `
      <div class="rounded-2xl surface-stat p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between">
        <div class="flex gap-3 min-w-0 flex-1">
          ${renderPosterHtml(anime, "w-16 h-24 sm:w-20 sm:h-28", false)}
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 text-[11px] text-dim">
              <span class="px-2 py-0.5 rounded bg-violet-500/15 text-violet-500 font-semibold">${escapeHtml(seasonLabel(anime.season, true))}</span>
              <span>${escapeHtml(reasonText)}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <h3 class="text-sm sm:text-base font-bold text-main truncate">${escapeHtml(primary)}</h3>
              ${renderGoogleBtnHtml(anime)}
            </div>
            ${secondary ? `<p class="text-xs text-dim truncate">${escapeHtml(secondary)}</p>` : ""}
            <div class="flex flex-wrap gap-1 pt-0.5">${renderGenreBadges(anime.genres, false)}</div>
          </div>
        </div>
        <div class="flex sm:flex-col gap-1.5 w-full sm:w-28 shrink-0">
          <button type="button" data-anime-id="${escapeHtml(anime.id)}" data-set-status="liked" class="status-btn flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center">${escapeHtml(statusLabel("liked"))}</button>
          <button type="button" data-anime-id="${escapeHtml(anime.id)}" data-set-status="watched" class="status-btn flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center">${escapeHtml(statusLabel("watched"))}</button>
        </div>
      </div>
    `;
    CoverArtManager.enqueue([anime]);
  }

  // ==================== Toast / Modal / Tour ====================
  function showToast(message, canUndo) {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-message");
    const undoBtn = document.getElementById("toast-undo");
    if (!toast || !msgEl || !undoBtn) return;
    msgEl.textContent = message;
    undoBtn.classList.toggle("hidden", !(canUndo && lastSnapshot));
    toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 3600);
  }

  function openConfirm(title, body, onConfirm) {
    const modal = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("confirm-title");
    const bodyEl = document.getElementById("confirm-body");
    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");
    if (!modal || !titleEl || !bodyEl || !okBtn || !cancelBtn) return;
    titleEl.textContent = title;
    bodyEl.textContent = body;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    const close = () => { modal.classList.add("hidden"); modal.classList.remove("flex"); okBtn.onclick = null; cancelBtn.onclick = null; };
    cancelBtn.onclick = close;
    okBtn.onclick = () => { close(); onConfirm(); };
  }

  function renderTourModal() {
    const modal = document.getElementById("tour-modal");
    const steps = t("tourSteps");
    if (!modal || !Array.isArray(steps)) return;
    const idx = Math.max(0, Math.min(state.tourStep, steps.length - 1));
    state.tourStep = idx;
    document.getElementById("tour-step-badge").textContent = `${idx + 1} / ${steps.length}`;
    document.getElementById("tour-title").textContent = steps[idx].title;
    document.getElementById("tour-body").textContent = steps[idx].body;
    document.getElementById("tour-prev").disabled = idx === 0;
    document.getElementById("tour-next").textContent = idx === steps.length - 1 ? t("tourDone") : t("tourNext");
  }

  function openTour() {
    state.tourStep = 0;
    renderTourModal();
    const modal = document.getElementById("tour-modal");
    if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
  }

  function closeTour() {
    const modal = document.getElementById("tour-modal");
    if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ==================== 三語介面更新 ====================
  function applyStaticI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const val = t(el.dataset.i18n);
      if (typeof val === "string") el.textContent = val;
    });
    const catSearch = document.getElementById("catalog-search");
    if (catSearch) catSearch.placeholder = t("searchPlaceholder");
    const mySearch = document.getElementById("mylist-search");
    if (mySearch) mySearch.placeholder = t("myListSearchPlaceholder");

    const wdSel = document.getElementById("catalog-weekday");
    if (wdSel) {
      const cur = state.catalogWeekday;
      const days = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日", "一次上架"];
      wdSel.innerHTML = `<option value="all">${escapeHtml(t("weekdayAll"))}</option>` + days.map((d) => `<option value="${d}">${escapeHtml(weekdayLabel(d))}</option>`).join("");
      wdSel.value = cur;
    }

    const myYearSel = document.getElementById("mylist-year");
    if (myYearSel) {
      myYearSel.innerHTML = `<option value="all">${escapeHtml(t("yearAll"))}</option>` + manifestYears.map((y) => `<option value="${y.year}">${y.year}${escapeHtml(t("yearSuffix"))}</option>`).join("");
      myYearSel.value = state.mylistYear;
    }

    const myStatusSel = document.getElementById("mylist-status");
    if (myStatusSel) {
      myStatusSel.innerHTML = `<option value="all">${escapeHtml(t("statusAll"))}</option><option value="liked">${escapeHtml(t("statusLiked"))}</option><option value="watched">${escapeHtml(t("statusWatched"))}</option><option value="disliked">${escapeHtml(t("statusDisliked"))}</option>`;
      myStatusSel.value = state.mylistStatus;
    }

    const mySortSel = document.getElementById("mylist-sort");
    if (mySortSel) {
      mySortSel.innerHTML = `<option value="updated">${escapeHtml(t("sortUpdated"))}</option><option value="id">${escapeHtml(t("sortId"))}</option><option value="weekday">${escapeHtml(t("sortWeekday"))}</option>`;
      mySortSel.value = state.mylistSort;
    }

    const homeYearSel = document.getElementById("home-year-select");
    if (homeYearSel) {
      homeYearSel.innerHTML = manifestYears.map((y) => `<option value="${y.year}">${y.year}${escapeHtml(t("yearSuffix"))} (${y.count})</option>`).join("");
      homeYearSel.value = state.homeYear;
    }

    const aiYearSel = document.getElementById("ai-year-scope");
    if (aiYearSel) {
      aiYearSel.innerHTML = manifestYears.map((y) => `<option value="${y.year}">${y.year}${escapeHtml(t("yearSuffix"))}</option>`).join("") + `<option value="all">${escapeHtml(t("yearAll"))}</option>`;
      aiYearSel.value = state.aiYearScope;
    }

    const aiSeasonSel = document.getElementById("ai-season-part");
    if (aiSeasonSel) {
      aiSeasonSel.innerHTML = `<option value="all">${escapeHtml(t("seasonAll"))}</option><option value="winter">${escapeHtml(t("seasonWinter"))}</option><option value="spring">${escapeHtml(t("seasonSpring"))}</option><option value="summer">${escapeHtml(t("seasonSummer"))}</option><option value="fall">${escapeHtml(t("seasonFall"))}</option>`;
      aiSeasonSel.value = state.aiSeasonPart;
    }
  }

  // ==================== 檢視切換 ====================
  async function switchView(nextView) {
    if (state.view !== "about" && nextView === "about") state.prevView = state.view;
    state.view = nextView;

    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== `view-${nextView}`);
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const active = btn.dataset.nav === nextView;
      if (btn.dataset.nav === "debug") {
        btn.className = active
          ? "nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 transition"
          : "nav-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-slate-800/70 transition";
        if (!isAdminUser()) btn.classList.add("hidden");
        return;
      }
      btn.className = active
        ? "nav-btn px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white shadow transition"
        : "nav-btn px-3 py-1.5 rounded-lg text-sm font-medium text-sub hover:text-main transition";
    });

    document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
      const active = btn.dataset.nav === nextView;
      btn.className = active
        ? "mobile-nav-btn flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-violet-500"
        : "mobile-nav-btn flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-dim";
    });

    document.querySelectorAll(".mobile-top-about").forEach((btn) => {
      btn.classList.toggle("pill-active", nextView === "about");
    });

    if (nextView === "mylist") await ensureAllYearsLoaded();
    else if (nextView === "ai" && state.aiYearScope !== "all") await ensureYearLoaded(state.aiYearScope);

    window.scrollTo({ top: 0, behavior: "smooth" });
    renderAll();
  }

  function computeStats(subset) {
    let liked = 0, watched = 0, disliked = 0, unwatched = 0;
    subset.forEach((a) => {
      const st = getStatus(a.id);
      if (st === "liked") liked++;
      else if (st === "watched") watched++;
      else if (st === "disliked") disliked++;
      else unwatched++;
    });
    const ratedTotal = liked + watched + disliked;
    const likeRate = liked + disliked > 0 ? Math.round((liked / (liked + disliked)) * 100) : null;
    return { total: subset.length, liked, watched, disliked, unwatched, ratedTotal, likeRate };
  }

  function renderHome() {
    const entries = Object.values(store.items || {});
    let liked = 0, watched = 0, disliked = 0;
    entries.forEach((e) => {
      if (e.status === "liked") liked++;
      else if (e.status === "watched") watched++;
      else if (e.status === "disliked") disliked++;
    });
    const ratedTotal = liked + watched + disliked;
    const likeRate = liked + disliked > 0 ? Math.round((liked / (liked + disliked)) * 100) : null;

    document.getElementById("stat-rated-total").textContent = ratedTotal;
    document.getElementById("stat-liked").textContent = liked;
    document.getElementById("stat-watched").textContent = watched;
    document.getElementById("stat-like-rate").textContent = likeRate !== null ? `${likeRate}%` : "—";
    document.getElementById("stat-disliked-hint").textContent = t("dislikedCountText")(disliked);

    renderDailyPick(false);

    const seasonContainer = document.getElementById("home-season-cards");
    if (seasonContainer) {
      const y = Number(state.homeYear);
      const yearItems = loadedYears.get(y) || [];
      seasonContainer.innerHTML = SEASON_PARTS.map((part) => {
        const key = `${y}-${part}`;
        const subset = yearItems.filter((a) => a.season === key);
        const s = computeStats(subset);
        const pct = s.total > 0 ? Math.round((s.ratedTotal / s.total) * 100) : 0;
        return `
          <button type="button" data-jump-year="${y}" data-jump-part="${part}" class="text-left rounded-2xl p-4 surface-card hover:border-violet-500/45 transition space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-main">${escapeHtml(seasonLabel(key, false))}</span>
              <span class="text-xs px-2 py-0.5 rounded-full surface-chip">${s.total}</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style="width:${pct}%"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-dim">
              <span>${escapeHtml(t("seasonRatedText")(s.ratedTotal, pct))}</span>
              <span class="text-rose-500 font-medium">${escapeHtml(t("likedShort")(s.liked))}</span>
            </div>
          </button>
        `;
      }).join("");

      seasonContainer.querySelectorAll("[data-jump-year]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          state.catalogYear = btn.dataset.jumpYear;
          state.catalogSeasonPart = btn.dataset.jumpPart;
          state.singleIndex = 0;
          state.catalogLimit = PAGE_SIZE;
          await ensureYearLoaded(state.catalogYear);
          switchView("catalog");
        });
      });
    }

    const genreBars = document.getElementById("home-genre-bars");
    if (genreBars) {
      const likedAnime = animeList.filter((a) => getStatus(a.id) === "liked");
      if (likedAnime.length === 0) {
        genreBars.innerHTML = `<div class="rounded-xl surface-stat border-dashed p-4 text-center text-xs sm:text-sm text-dim">${escapeHtml(t("homeGenreEmpty"))}</div>`;
      } else {
        const counts = {};
        likedAnime.forEach((a) => (a.genres || []).forEach((g) => { counts[g] = (counts[g] || 0) + 1; }));
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const maxVal = sorted[0] ? sorted[0][1] : 1;
        genreBars.innerHTML = sorted
          .map(([genre, count]) => {
            const widthPct = Math.round((count / maxVal) * 100);
            return `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-main">${escapeHtml(genreLabel(genre))}</span>
                  <span class="text-dim">${escapeHtml(t("likedGenreUnit")(count))}</span>
                </div>
                <div class="w-full h-2 rounded-full bg-slate-500/20 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-rose-500 to-violet-500" style="width:${widthPct}%"></div>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }
  }

  // ==================== 作品卡片元件 ====================
  function renderPosterHtml(anime, sizeClasses, isLarge) {
    const coverUrl = CoverArtManager.getUrl(anime);
    const { primary } = getDisplayTitles(anime);
    const mainGenre = (anime.genres && anime.genres[0]) ? genreLabel(anime.genres[0]) : "Anime";
    return `
      <div data-poster-id="${escapeHtml(anime.id)}" class="poster-box ${sizeClasses} rounded-xl shrink-0">
        <img ${coverUrl ? `src="${escapeHtml(coverUrl)}"` : ""} alt="${escapeHtml(primary)}" loading="lazy" referrerpolicy="no-referrer" class="${coverUrl ? "" : "hidden"}" onerror="this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');" />
        <div data-poster-fallback class="${coverUrl ? "hidden" : ""} w-full h-full flex flex-col items-center justify-center p-2 text-center select-none bg-gradient-to-br from-violet-950/90 via-slate-900 to-indigo-950/90">
          <svg class="${isLarge ? "w-9 h-9 mb-2" : "w-5 h-5 mb-1"} text-violet-400/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <span class="${isLarge ? "text-xs px-2 py-0.5" : "text-[9px] px-1.5 py-0.5"} rounded bg-violet-500/25 text-violet-200 font-semibold mb-1">${escapeHtml(mainGenre)}</span>
          <span class="${isLarge ? "text-xs line-clamp-3 px-2" : "text-[10px] line-clamp-2"} text-slate-200 font-medium leading-tight">${escapeHtml(primary)}</span>
        </div>
      </div>
    `;
  }

  function renderGenreBadges(genres, isLarge) {
    return (genres || [])
      .map((g) => `<span class="inline-block ${isLarge ? "text-xs px-2.5 py-1 rounded-lg" : "text-[11px] px-2 py-0.5 rounded-md"} ${g === "R18" ? "badge-r18" : "surface-chip"}">${escapeHtml(genreLabel(g))}</span>`)
      .join("");
  }

  function renderGoogleBtnHtml(anime) {
    return `
      <button type="button" data-google-id="${escapeHtml(anime.id)}" title="${escapeHtml(t("googleSearchTitle"))}" aria-label="${escapeHtml(t("googleSearchTitle"))}" class="inline-flex items-center justify-center w-6 h-6 rounded-md surface-chip hover:border-violet-500/60 hover:text-violet-400 transition shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    `;
  }

  function renderPushBtnHtml(anime) {
    const pushed = userPushes.has(anime.id);
    const count = getPushCount(anime.id);
    const cls = pushed
      ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
      : "surface-chip hover:border-orange-500/40";
    return `
      <button type="button" data-push-id="${escapeHtml(anime.id)}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${cls}">
        <span>🔥</span>
        <span>${escapeHtml(t("pushLabel"))} ${count > 0 ? count : "+1"}</span>
      </button>
    `;
  }

  function renderAnimeCard(anime, readOnly) {
    const status = getStatus(anime.id);
    const { primary, secondary } = getDisplayTitles(anime);
    const wdText = weekdayLabel(anime.weekday) + (anime.weekdayNote && state.lang === "zh" ? `（${anime.weekdayNote}）` : "");
    const genreHtml = renderGenreBadges(anime.genres, false);

    const buttons = readOnly
      ? ""
      : `<div class="flex items-center gap-1.5 pt-1">` +
        ["unwatched", "watched", "liked", "disliked"]
          .map((key) => `<button type="button" data-anime-id="${escapeHtml(anime.id)}" data-set-status="${key}" class="status-btn ${status === key ? `active-${key}` : ""} flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center">${escapeHtml(statusLabel(key))}</button>`)
          .join("") +
        `</div>`;

    return `
      <article class="anime-card rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3" data-status="${readOnly ? "liked" : status}">
        <div class="flex gap-3 min-w-0">
          ${renderPosterHtml(anime, "w-20 h-28 sm:w-24 sm:h-32", false)}
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-[11px] text-dim">
              <span class="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25 font-medium shrink-0">${escapeHtml(seasonLabel(anime.season, true))}</span>
              <span class="truncate">${escapeHtml(wdText)}</span>
            </div>
            <div>
              <div class="flex items-start justify-between gap-1.5">
                <h3 class="text-sm sm:text-base font-bold text-main leading-snug line-clamp-2 flex-1">${escapeHtml(primary)}</h3>
                ${renderGoogleBtnHtml(anime)}
              </div>
              ${secondary ? `<p class="text-xs text-dim mt-0.5 truncate">${escapeHtml(secondary)}</p>` : ""}
            </div>
            <div class="flex flex-wrap items-center gap-1 pt-0.5">
              ${genreHtml}
              ${readOnly ? "" : renderPushBtnHtml(anime)}
            </div>
          </div>
        </div>
        ${buttons}
      </article>
    `;
  }

  function renderSingleAnimeCard(anime) {
    const status = getStatus(anime.id);
    const { primary, secondary } = getDisplayTitles(anime);
    const wdText = weekdayLabel(anime.weekday) + (anime.weekdayNote && state.lang === "zh" ? `（${anime.weekdayNote}）` : "");
    const buttons = ["unwatched", "watched", "liked", "disliked"]
      .map((key) => `<button type="button" data-anime-id="${escapeHtml(anime.id)}" data-set-status="${key}" class="status-btn ${status === key ? `active-${key}` : ""} py-3 px-2 rounded-xl text-sm font-semibold text-center">${escapeHtml(statusLabel(key))}</button>`)
      .join("");

    return `
      <article class="anime-card rounded-3xl p-5 flex flex-col items-center text-center gap-4" data-status="${status}">
        <div class="w-full flex items-center justify-between text-xs text-dim">
          <span class="px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25 font-semibold">${escapeHtml(seasonLabel(anime.season, false))}</span>
          <span>${escapeHtml(wdText)}</span>
        </div>
        ${renderPosterHtml(anime, "w-44 h-64 sm:w-52 sm:h-72 mx-auto shadow-xl", true)}
        <div class="space-y-1.5 w-full">
          <div class="flex items-center justify-center gap-2">
            <h3 class="text-lg sm:text-xl font-bold text-main leading-snug">${escapeHtml(primary)}</h3>
            ${renderGoogleBtnHtml(anime)}
          </div>
          ${secondary ? `<p class="text-xs sm:text-sm text-dim">${escapeHtml(secondary)}</p>` : ""}
        </div>
        <div class="flex flex-wrap items-center justify-center gap-1.5">
          ${renderGenreBadges(anime.genres, true)}
          ${renderPushBtnHtml(anime)}
        </div>
        <div class="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">${buttons}</div>
        <p class="text-[11px] text-dim">${escapeHtml(t("singleSwipeHint"))}</p>
      </article>
    `;
  }

  // ==================== 新番清單渲染 ====================
  function getFilteredCatalog() {
    const kw = state.catalogSearch.trim().toLowerCase();
    const base = state.catalogYear === "all" ? animeList : loadedYears.get(Number(state.catalogYear)) || [];
    return base.filter((a) => {
      if (state.catalogSeasonPart !== "all" && !String(a.season).endsWith(`-${state.catalogSeasonPart}`)) return false;
      if (state.catalogStatus !== "all" && getStatus(a.id) !== state.catalogStatus) return false;
      if (state.catalogWeekday !== "all" && a.weekday !== state.catalogWeekday) return false;
      if (state.catalogGenre !== "all" && !(a.genres || []).includes(state.catalogGenre)) return false;
      if (kw) {
        const zh = (a.titleZh || "").toLowerCase();
        const jp = (a.titleJp || "").toLowerCase();
        const en = (a.titleEn || "").toLowerCase();
        if (!zh.includes(kw) && !jp.includes(kw) && !en.includes(kw)) return false;
      }
      return true;
    });
  }

  function renderCatalog() {
    const yearWrap = document.getElementById("catalog-year-tabs");
    if (yearWrap) {
      const yearBtns = manifestYears.map((y) => `<button type="button" data-year="${y.year}" class="year-tab shrink-0 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold surface-pill transition ${state.catalogYear === String(y.year) ? "pill-active" : ""}">${y.year}${escapeHtml(t("yearSuffix"))}</button>`);
      yearBtns.push(`<button type="button" data-year="all" class="year-tab shrink-0 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold surface-pill transition ${state.catalogYear === "all" ? "pill-active" : ""}">${escapeHtml(t("yearAll"))}</button>`);
      yearWrap.innerHTML = yearBtns.join("");
      yearWrap.querySelectorAll(".year-tab").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const val = btn.dataset.year;
          state.catalogYear = val;
          state.singleIndex = 0;
          state.catalogLimit = PAGE_SIZE;
          if (val === "all") { showToast(t("loadingYear")(t("yearAll")), false); await ensureAllYearsLoaded(); }
          else if (!loadedYears.has(Number(val))) { showToast(t("loadingYear")(val), false); await ensureYearLoaded(val); }
          renderCatalog();
        });
      });
    }

    document.querySelectorAll(".season-tab").forEach((btn) => btn.classList.toggle("pill-active", btn.dataset.seasonPart === state.catalogSeasonPart));
    document.querySelectorAll(".display-mode-btn").forEach((btn) => {
      const active = btn.dataset.displayMode === state.catalogDisplayMode;
      btn.className = active
        ? "display-mode-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white shadow transition flex items-center gap-1"
        : "display-mode-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-dim hover:text-main transition flex items-center gap-1";
    });
    document.getElementById("device-mode-hint").textContent = isInitialMobile ? t("deviceMobileHint") : t("deviceDesktopHint");
    document.querySelectorAll(".status-filter-tab").forEach((btn) => btn.classList.toggle("pill-active", btn.dataset.status === state.catalogStatus));

    const genreWrap = document.getElementById("catalog-genre-chips");
    if (genreWrap) {
      genreWrap.innerHTML = ["all", ...allGenres].map((g) => {
        const active = state.catalogGenre === g;
        const label = g === "all" ? t("genreAll") : `${genreLabel(g)} (${genreCountsAll[g]})`;
        let cls = active ? "genre-chip-active" : "surface-pill";
        if (!active && g === "R18") cls = "badge-r18";
        return `<button type="button" data-genre="${escapeHtml(g)}" class="genre-chip shrink-0 px-2.5 py-1 rounded-lg text-xs border transition ${cls}">${escapeHtml(label)}</button>`;
      }).join("");
      genreWrap.querySelectorAll(".genre-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.catalogGenre = btn.dataset.genre;
          state.singleIndex = 0;
          state.catalogLimit = PAGE_SIZE;
          renderCatalog();
        });
      });
    }

    const hasFilter = state.catalogSearch.trim() !== "" || state.catalogStatus !== "all" || state.catalogWeekday !== "all" || state.catalogGenre !== "all";
    document.getElementById("catalog-clear-filters")?.classList.toggle("hidden", !hasFilter);

    const filtered = getFilteredCatalog();
    document.getElementById("catalog-result-count").textContent = t("resultCount")(filtered.length);

    const listEl = document.getElementById("catalog-list");
    const loadMoreWrap = document.getElementById("catalog-load-more-wrap");
    const loadMoreBtn = document.getElementById("btn-load-more");
    const singleWrap = document.getElementById("catalog-single-wrap");
    if (!listEl || !singleWrap) return;

    if (state.catalogDisplayMode === "card") {
      listEl.classList.add("hidden");
      loadMoreWrap?.classList.add("hidden");
      singleWrap.classList.remove("hidden");

      const stage = document.getElementById("single-card-stage");
      const pageEl = document.getElementById("single-page-indicator");
      const barEl = document.getElementById("single-progress-bar");
      const prevBtn = document.getElementById("single-prev-btn");
      const nextBtn = document.getElementById("single-next-btn");

      if (filtered.length === 0) {
        pageEl.textContent = "0 / 0";
        barEl.style.width = "0%";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        stage.innerHTML = `<div class="rounded-2xl surface-card border-dashed p-8 text-center text-sm text-dim">${escapeHtml(t("noMatch"))}</div>`;
      } else {
        if (state.singleIndex >= filtered.length) state.singleIndex = filtered.length - 1;
        if (state.singleIndex < 0) state.singleIndex = 0;
        const currentAnime = filtered[state.singleIndex];
        const total = filtered.length;
        pageEl.textContent = `${state.singleIndex + 1} / ${total}`;
        barEl.style.width = `${Math.round(((state.singleIndex + 1) / total) * 100)}%`;
        prevBtn.disabled = state.singleIndex <= 0;
        nextBtn.disabled = state.singleIndex >= total - 1;
        stage.innerHTML = renderSingleAnimeCard(currentAnime);
        CoverArtManager.enqueue(filtered.slice(state.singleIndex, state.singleIndex + 4));
      }
    } else {
      singleWrap.classList.add("hidden");
      listEl.classList.remove("hidden");
      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="col-span-full rounded-2xl surface-card border-dashed p-8 text-center text-sm text-dim">${escapeHtml(t("noMatch"))}</div>`;
        loadMoreWrap?.classList.add("hidden");
      } else {
        const visibleItems = filtered.slice(0, state.catalogLimit);
        listEl.innerHTML = visibleItems.map((a) => renderAnimeCard(a, false)).join("");
        CoverArtManager.observeRenderedPosters(listEl);
        const remaining = filtered.length - visibleItems.length;
        if (loadMoreWrap && loadMoreBtn) {
          loadMoreWrap.classList.toggle("hidden", remaining <= 0);
          if (remaining > 0) loadMoreBtn.textContent = t("loadMore")(remaining);
        }
      }
    }
  }

  // ==================== 我的清單 & AI & 公開分享 ====================
  function renderMyList() {
    const kw = state.mylistSearch.trim().toLowerCase();
    let items = animeList.filter((a) => getStatus(a.id) !== "unwatched");
    items = items.filter((a) => {
      if (state.mylistYear !== "all" && String(a.year) !== state.mylistYear) return false;
      if (state.mylistStatus !== "all" && getStatus(a.id) !== state.mylistStatus) return false;
      if (kw) {
        const zh = (a.titleZh || "").toLowerCase();
        const jp = (a.titleJp || "").toLowerCase();
        const en = (a.titleEn || "").toLowerCase();
        if (!zh.includes(kw) && !jp.includes(kw) && !en.includes(kw)) return false;
      }
      return true;
    });

    if (state.mylistSort === "updated") items.sort((a, b) => getUpdatedAt(b.id).localeCompare(getUpdatedAt(a.id)));
    else if (state.mylistSort === "weekday") items.sort((a, b) => (WEEKDAY_ORDER[a.weekday] || 99) - (WEEKDAY_ORDER[b.weekday] || 99));
    else items.sort((a, b) => a.id.localeCompare(b.id));

    document.getElementById("mylist-count").textContent = t("myListCount")(items.length);
    const container = document.getElementById("mylist-cards");
    if (items.length === 0) {
      container.innerHTML = `<div class="col-span-full rounded-2xl surface-card border-dashed p-8 text-center space-y-2"><p class="text-sm text-main font-medium">${escapeHtml(t("myListEmptyTitle"))}</p><p class="text-xs text-dim">${escapeHtml(t("myListEmptySub"))}</p></div>`;
    } else {
      container.innerHTML = items.map((a) => renderAnimeCard(a, false)).join("");
      CoverArtManager.observeRenderedPosters(container);
    }
  }

  function buildAiAndShareData() {
    const yScope = state.aiYearScope;
    const part = state.aiSeasonPart;
    const excludeShorts = state.aiExcludeShorts;
    const hideR18 = state.aiHideR18;
    const r18Pass = (a) => !(hideR18 && isR18Anime(a));

    const likedList = animeList.filter((a) => getStatus(a.id) === "liked" && r18Pass(a));
    const watchedList = animeList.filter((a) => getStatus(a.id) === "watched" && r18Pass(a));
    const dislikedList = animeList.filter((a) => getStatus(a.id) === "disliked" && r18Pass(a));

    let unwatchedCandidates = animeList.filter((a) => getStatus(a.id) === "unwatched" && r18Pass(a));
    if (yScope !== "all") unwatchedCandidates = unwatchedCandidates.filter((a) => String(a.year) === yScope);
    if (part !== "all") unwatchedCandidates = unwatchedCandidates.filter((a) => String(a.season).endsWith(`-${part}`));
    if (excludeShorts) unwatchedCandidates = unwatchedCandidates.filter((a) => !(a.genres || []).includes("短篇"));

    const likedGenreCounts = {};
    likedList.forEach((a) => {
      (a.genres || []).forEach((g) => {
        if (hideR18 && g === "R18") return;
        likedGenreCounts[g] = (likedGenreCounts[g] || 0) + 1;
      });
    });
    const topGenresText = Object.entries(likedGenreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, c]) => `${genreLabel(g)}(${c})`).join(", ") || "—";

    const fmtTitle = (a) => getDisplayTitles(a).primary;
    const fmtGenres = (a) => (a.genres || []).map(genreLabel).join(" / ");
    const likedLines = likedList.length > 0 ? likedList.map((a) => `- ${fmtTitle(a)} [${fmtGenres(a)}]`).join("\n") : "(None)";
    const dislikedLines = dislikedList.length > 0 ? dislikedList.map((a) => `- ${fmtTitle(a)} [${fmtGenres(a)}]`).join("\n") : "(None)";
    const candidateLines = unwatchedCandidates.length > 0 ? unwatchedCandidates.map((a) => `- [${seasonLabel(a.season, true)}] ${fmtTitle(a)} (${a.titleJp}) | ${fmtGenres(a)}`).join("\n") : "(None)";
    const scopeText = `${yScope === "all" ? t("yearAll") : yScope} · ${t(part === "all" ? "seasonAll" : "season" + part[0].toUpperCase() + part.slice(1))}`;

    let promptText = "", shareText = "";
    if (state.lang === "ja") {
      const r18Note = hideR18 ? "（R18除外）" : "（R18含む）";
      promptText = `あなたは私の専属アニメ推薦アドバイザーです。ANIME LOG.から出力した視聴傾向と未視聴リストをもとに、隠れた名作を提案してください${r18Note}。\n\n【1. 好みのジャンル傾向】\n${topGenresText}\n\n【2. 「好き」と評価した作品（${likedList.length}件）】\n${likedLines}\n\n【3. 「苦手」と評価した作品（${dislikedList.length}件）】\n${dislikedLines}\n\n【4. 未視聴の候補リスト（対象：${scopeText} / ${unwatchedCandidates.length}件）】\n${candidateLines}\n\n【お願い】\n上記の傾向を踏まえ、**必ず「4. 未視聴の候補リスト」の中から**私に合いそうな作品を5〜8本厳選し、おすすめ理由と注意点を教えてください。`;
      shareText = `📺 ANIME LOG. マイリスト共有${r18Note}\n好みジャンル：${topGenresText}\n\n❤️ 好き（${likedList.length}件）\n${likedLines}\n\n👀 視聴済（${watchedList.length}件）\n${watchedList.length ? watchedList.map((a) => `- ${fmtTitle(a)}`).join("\n") : "（なし）"}`;
    } else if (state.lang === "en") {
      const r18Note = hideR18 ? " (R18 hidden)" : " (R18 included)";
      promptText = `Act as my personal anime advisor. Based on my ANIME LOG. export${r18Note}, pick hidden gems I haven't watched yet.\n\n[1. Top Liked Genres]\n${topGenresText}\n\n[2. Liked (${likedList.length})]\n${likedLines}\n\n[3. Disliked (${dislikedList.length})]\n${dislikedLines}\n\n[4. Unwatched Candidates (${scopeText} | ${unwatchedCandidates.length})]\n${candidateLines}\n\n[Task]\nPick 5–8 anime **strictly from Section 4** that fit my taste and explain why.`;
      shareText = `📺 My ANIME LOG. Watchlist${r18Note}\nTop Genres: ${topGenresText}\n\n❤️ Liked (${likedList.length}):\n${likedLines}\n\n👀 Watched (${watchedList.length}):\n${watchedList.length ? watchedList.map((a) => `- ${fmtTitle(a)}`).join("\n") : "(None)"}`;
    } else {
      const r18Note = hideR18 ? "（已隱藏 R18 作品）" : "（含 R18 作品）";
      promptText = `請擔任我的專屬動漫推薦顧問！以下是我從「ANIME LOG. 新番檢核表」匯出的個人觀影偏好與未看片單${r18Note}：\n\n【1. 我的偏好類型統計】\n最常喜歡的類型：${topGenresText}\n\n【2. 我標記「喜歡」的作品（共 ${likedList.length} 部）】\n${likedLines}\n\n【3. 我標記「不喜歡」的避雷作品（共 ${dislikedList.length} 部）】\n${dislikedLines}\n\n【4. 我還沒看過的候選清單（範圍：${scopeText}，共 ${unwatchedCandidates.length} 部）】\n${candidateLines}\n\n【任務需求】\n請根據我「喜歡」與「不喜歡」的作品調性，**只從上面「第 4 點沒看過的候選清單」中**，幫我挑選 5～8 部最可能合我胃口的遺珠動畫，並說明推薦理由與可能踩雷點。`;
      shareText = `📺 我的 ANIME LOG. 追番片單分享${r18Note}\n偏好類型：${topGenresText}\n\n❤️ 喜歡（${likedList.length} 部）：\n${likedLines}\n\n👀 看過（${watchedList.length} 部）：\n${watchedList.length ? watchedList.map((a) => `- ${fmtTitle(a)}`).join("\n") : "（無）"}`;
    }

    return { likedCount: likedList.length, dislikedCount: dislikedList.length, unwatchedCount: unwatchedCandidates.length, promptText, shareText };
  }

  function renderAiView() {
    const res = buildAiAndShareData();
    document.getElementById("ai-liked-count").textContent = res.likedCount;
    document.getElementById("ai-disliked-count").textContent = res.dislikedCount;
    document.getElementById("ai-unwatched-count").textContent = res.unwatchedCount;
    document.getElementById("ai-prompt-preview").value = res.promptText;
  }

  async function openPublicShareView(shareTarget) {
    await ensureAllYearsLoaded();
    const hideR18 = urlParams.get("hideR18") !== "0";
    let itemsToShow = [];

    if (shareTarget !== "local" && sbClient) {
      try {
        const { data: rows } = await sbClient
          .from("user_watchlist")
          .select("anime_id,status")
          .eq("user_id", shareTarget)
          .in("status", ["liked", "watched"]);
        if (Array.isArray(rows)) {
          itemsToShow = rows
            .map((r) => animeMap.get(r.anime_id))
            .filter((a) => a && !(hideR18 && isR18Anime(a)));
        }
      } catch (e) {}
    } else {
      itemsToShow = animeList.filter((a) => (getStatus(a.id) === "liked" || getStatus(a.id) === "watched") && !(hideR18 && isR18Anime(a)));
    }

    document.getElementById("share-owner-stats").textContent = `共分享 ${itemsToShow.length} 部推薦／看過作品${hideR18 ? "（已隱藏 R18）" : ""}`;
    const container = document.getElementById("share-cards");
    container.innerHTML =
      itemsToShow.length === 0
        ? `<div class="col-span-full rounded-2xl surface-card p-8 text-center text-sm text-dim">目前沒有可顯示的公開片單內容。</div>`
        : itemsToShow.map((a) => renderAnimeCard(a, true)).join("");
    CoverArtManager.observeRenderedPosters(container);
    await switchView("share");
  }

  // ==================== Debug 掃描與回報清單 ====================
  function testImageLoad(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      const timer = setTimeout(() => resolve(false), 7000);
      img.onload = () => { clearTimeout(timer); resolve(true); };
      img.onerror = () => { clearTimeout(timer); resolve(false); };
      img.src = url;
    });
  }

  async function runDebugScan() {
    const statusEl = document.getElementById("debug-status-text");
    const listEl = document.getElementById("debug-results");
    const btn = document.getElementById("btn-debug-scan");
    if (!statusEl || !listEl || !btn) return;

    btn.disabled = true;
    statusEl.textContent = "正在載入全部年份並掃描封面與資料...";
    await ensureAllYearsLoaded();

    let okCount = 0, missingCount = 0, brokenCount = 0;
    const issues = [];
    const seenIds = new Set();

    for (let i = 0; i < animeList.length; i++) {
      const a = animeList[i];
      if (seenIds.has(a.id)) issues.push({ type: "DUPLICATE_ID", id: a.id, titleZh: a.titleZh });
      seenIds.add(a.id);

      const url = CoverArtManager.getUrl(a);
      if (!url) {
        missingCount++;
        issues.push({ type: "MISSING_COVER", id: a.id, titleZh: a.titleZh, titleJp: a.titleJp });
      } else {
        const ok = await testImageLoad(url);
        if (ok) okCount++;
        else { brokenCount++; issues.push({ type: "BROKEN_IMAGE", id: a.id, titleZh: a.titleZh, titleJp: a.titleJp, url }); }
      }

      if ((i + 1) % 10 === 0 || i === animeList.length - 1) {
        document.getElementById("dbg-total").textContent = i + 1;
        document.getElementById("dbg-ok").textContent = okCount;
        document.getElementById("dbg-missing").textContent = missingCount;
        document.getElementById("dbg-broken").textContent = brokenCount;
        statusEl.textContent = `掃描進度：${i + 1} / ${animeList.length}`;
      }
    }

    debugLastIssues = issues;
    statusEl.textContent = `掃描完成！共發現 ${issues.length} 筆異常（缺圖 ${missingCount}、破圖 ${brokenCount}）。`;
    listEl.innerHTML =
      issues.length === 0
        ? `<div class="p-3 rounded-xl surface-stat text-emerald-400">全部作品封面與資料皆正常！</div>`
        : issues.map((x) => `<div class="p-2 rounded-lg surface-stat flex justify-between gap-2"><span class="${x.type === "BROKEN_IMAGE" ? "text-rose-400" : "text-amber-400"} font-bold">[${x.type}]</span><span class="flex-1 truncate text-main">${escapeHtml(x.id)} ${escapeHtml(x.titleZh)}</span></div>`).join("");
    btn.disabled = false;
  }

  async function loadReportsForDebug() {
    const el = document.getElementById("debug-reports-list");
    if (!el) return;
    let rows = [];
    if (sbClient) {
      try {
        const { data } = await sbClient.from("issue_reports").select("*").order("created_at", { ascending: false }).limit(50);
        if (Array.isArray(data)) rows = data;
      } catch (e) {}
    }
    if (rows.length === 0) {
      try { rows = JSON.parse(window.localStorage.getItem(REPORTS_LOCAL_KEY) || "[]"); } catch (e) {}
    }
    el.innerHTML =
      rows.length === 0
        ? `<div class="text-dim">目前沒有使用者回報紀錄。</div>`
        : rows.map((r) => `<div class="p-2.5 rounded-xl surface-stat space-y-1"><div class="flex justify-between text-[11px] text-dim"><span class="font-bold text-amber-400">${escapeHtml(r.category)}</span><span>${escapeHtml(r.created_at || "")}</span></div><div class="font-semibold text-main">${escapeHtml(r.anime_title || "未指定作品")}</div><div>${escapeHtml(r.description)}</div></div>`).join("");
  }

  function renderAll() {
    if (state.view === "home") renderHome();
    if (state.view === "catalog") renderCatalog();
    if (state.view === "mylist") renderMyList();
    if (state.view === "ai") renderAiView();
    if (state.view === "debug") loadReportsForDebug();
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copyText(text, successMsg) {
    const msg = successMsg || "Copied!";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(msg, false)).catch(() => fallbackCopy(text, msg));
    } else fallbackCopy(text, msg);
  }

  function fallbackCopy(text, msg) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showToast(msg, false); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ==================== 事件綁定 ====================
  document.addEventListener("click", (e) => {
    const gBtn = e.target.closest("[data-google-id]");
    if (gBtn) {
      const anime = animeMap.get(gBtn.dataset.googleId);
      if (anime) {
        const title = getDisplayTitles(anime).primary;
        copyText(title, t("copiedSearch")(title));
        window.open(`https://www.google.com/search?q=${encodeURIComponent(`${title} ${t("googleKeyword")}`)}`, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const pBtn = e.target.closest("[data-push-id]");
    if (pBtn) {
      togglePush(pBtn.dataset.pushId);
      return;
    }

    const stBtn = e.target.closest("[data-set-status]");
    if (stBtn) {
      const animeId = stBtn.dataset.animeId;
      const nextStatus = stBtn.dataset.setStatus;
      if (animeId && nextStatus) setStatus(animeId, nextStatus, false);
    }
  });

  // 年份與類型水平捲動箭頭 + 滑鼠滾輪橫滑
  document.querySelectorAll("[data-scroll-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.scrollTarget);
      if (target) target.scrollBy({ left: Number(btn.dataset.scrollDir || 1) * 240, behavior: "smooth" });
    });
  });
  document.querySelectorAll(".h-scroll-track").forEach((track) => {
    track.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && track.scrollWidth > track.clientWidth) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  });

  // 導覽、主題、語言、關於頁
  document.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.nav)));
  document.getElementById("btn-theme-toggle")?.addEventListener("click", () => ThemeManager.toggle());
  document.getElementById("btn-about-back")?.addEventListener("click", () => switchView(state.prevView && state.prevView !== "about" ? state.prevView : "home"));
  document.getElementById("btn-replay-tour")?.addEventListener("click", openTour);
  document.getElementById("btn-share-back-home")?.addEventListener("click", () => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
    switchView("home");
  });

  const langSel = document.getElementById("lang-select");
  if (langSel) {
    langSel.value = state.lang;
    langSel.addEventListener("change", (e) => {
      state.lang = e.target.value;
      try { window.localStorage.setItem(LANG_KEY, state.lang); } catch (err) {}
      applyStaticI18n();
      renderAll();
    });
  }

  // Tour 控制
  document.getElementById("tour-skip")?.addEventListener("click", closeTour);
  document.getElementById("tour-prev")?.addEventListener("click", () => { state.tourStep -= 1; renderTourModal(); });
  document.getElementById("tour-next")?.addEventListener("click", () => {
    const steps = t("tourSteps");
    if (state.tourStep >= steps.length - 1) closeTour();
    else { state.tourStep += 1; renderTourModal(); }
  });

  // 回報問題 Modal 控制
  const reportModal = document.getElementById("report-modal");
  const closeReportModal = () => { if (reportModal) { reportModal.classList.add("hidden"); reportModal.classList.remove("flex"); } };
  document.getElementById("btn-open-report")?.addEventListener("click", () => {
    if (reportModal) { reportModal.classList.remove("hidden"); reportModal.classList.add("flex"); }
  });
  document.getElementById("report-close")?.addEventListener("click", closeReportModal);
  document.getElementById("report-cancel")?.addEventListener("click", closeReportModal);
  document.getElementById("report-submit")?.addEventListener("click", async () => {
    const category = document.getElementById("report-category")?.value || "missing_anime";
    const animeTitle = (document.getElementById("report-title")?.value || "").trim();
    const description = (document.getElementById("report-desc")?.value || "").trim();
    if (!description) { showToast("請填寫問題或許願說明", false); return; }

    if (sbClient && currentUser) {
      try {
        await sbClient.from("issue_reports").insert({ user_id: currentUser.id, category, anime_title: animeTitle, description });
      } catch (e) {}
    } else {
      try {
        const arr = JSON.parse(window.localStorage.getItem(REPORTS_LOCAL_KEY) || "[]");
        arr.unshift({ category, anime_title: animeTitle, description, created_at: new Date().toISOString() });
        window.localStorage.setItem(REPORTS_LOCAL_KEY, JSON.stringify(arr.slice(0, 50)));
      } catch (e) {}
    }
    document.getElementById("report-title").value = "";
    document.getElementById("report-desc").value = "";
    closeReportModal();
    showToast("感謝你的回報，已記錄完成！", false);
  });

  // 雲端帳號 Modal 控制
  const authModal = document.getElementById("auth-modal");
  const closeAuthModal = () => { if (authModal) { authModal.classList.add("hidden"); authModal.classList.remove("flex"); } };
  document.getElementById("btn-auth-open")?.addEventListener("click", () => {
    const box = document.getElementById("auth-status-box");
    const form = document.getElementById("auth-login-form");
    const logoutBtn = document.getElementById("btn-auth-logout");
    if (!isSupabaseConfigured()) {
      box.innerHTML = `目前為 <strong>本機模式</strong>（資料安全儲存在瀏覽器中）。<br>若要啟用跨裝置雲端同步，請於 <code>config.js</code> 填入你的 Supabase URL 與 Anon Key。`;
      form?.classList.add("hidden");
      logoutBtn?.classList.add("hidden");
    } else if (currentUser) {
      box.innerHTML = `已連線至 Supabase 雲端同步。<br>帳號類型：<strong>${currentUser.is_anonymous ? "匿名訪客" : escapeHtml(currentUser.email || "已綁定帳號")}</strong><br>User ID：<code>${escapeHtml(currentUser.id)}</code>`;
      form?.classList.toggle("hidden", !currentUser.is_anonymous);
      logoutBtn?.classList.toggle("hidden", currentUser.is_anonymous);
    }
    authModal.classList.remove("hidden");
    authModal.classList.add("flex");
  });
  document.getElementById("auth-close")?.addEventListener("click", closeAuthModal);
  document.getElementById("auth-done")?.addEventListener("click", closeAuthModal);
  document.getElementById("btn-auth-magic")?.addEventListener("click", async () => {
    const email = (document.getElementById("auth-email-input")?.value || "").trim();
    if (!email || !sbClient) return;
    const { error } = await sbClient.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
    showToast(error ? "寄送失敗：" + error.message : "已寄出登入連結，請至信箱點擊完成綁定！", false);
  });
  document.getElementById("btn-auth-logout")?.addEventListener("click", async () => {
    if (sbClient) await sbClient.auth.signOut();
    currentUser = null;
    updateAuthUI();
    closeAuthModal();
    showToast("已登出雲端帳號", false);
  });

  // 首頁與新番篩選控制
  document.getElementById("home-year-select")?.addEventListener("change", async (e) => { state.homeYear = e.target.value; await ensureYearLoaded(state.homeYear); renderHome(); });
  document.getElementById("home-goto-catalog")?.addEventListener("click", () => switchView("catalog"));
  document.getElementById("home-goto-ai")?.addEventListener("click", () => switchView("ai"));
  document.getElementById("btn-refresh-daily")?.addEventListener("click", () => renderDailyPick(true));

  document.querySelectorAll(".season-tab").forEach((btn) => btn.addEventListener("click", () => { state.catalogSeasonPart = btn.dataset.seasonPart; state.singleIndex = 0; state.catalogLimit = PAGE_SIZE; renderCatalog(); }));
  document.querySelectorAll(".display-mode-btn").forEach((btn) => btn.addEventListener("click", () => { state.catalogDisplayMode = btn.dataset.displayMode; renderCatalog(); }));
  document.querySelectorAll(".status-filter-tab").forEach((btn) => btn.addEventListener("click", () => { state.catalogStatus = btn.dataset.status; state.singleIndex = 0; state.catalogLimit = PAGE_SIZE; renderCatalog(); }));
  document.getElementById("catalog-search")?.addEventListener("input", (e) => { state.catalogSearch = e.target.value; state.singleIndex = 0; state.catalogLimit = PAGE_SIZE; renderCatalog(); });
  document.getElementById("catalog-weekday")?.addEventListener("change", (e) => { state.catalogWeekday = e.target.value; state.singleIndex = 0; state.catalogLimit = PAGE_SIZE; renderCatalog(); });
  document.getElementById("catalog-clear-filters")?.addEventListener("click", () => {
    state.catalogSearch = ""; state.catalogStatus = "all"; state.catalogWeekday = "all"; state.catalogGenre = "all"; state.singleIndex = 0; state.catalogLimit = PAGE_SIZE;
    document.getElementById("catalog-search").value = "";
    document.getElementById("catalog-weekday").value = "all";
    renderCatalog();
  });
  document.getElementById("btn-load-more")?.addEventListener("click", () => { state.catalogLimit += PAGE_SIZE; renderCatalog(); });

  // 單張滑動控制
  document.getElementById("single-prev-btn")?.addEventListener("click", () => { if (state.singleIndex > 0) { state.singleIndex -= 1; renderCatalog(); } });
  document.getElementById("single-next-btn")?.addEventListener("click", () => { const total = getFilteredCatalog().length; if (state.singleIndex < total - 1) { state.singleIndex += 1; renderCatalog(); } });
  document.getElementById("single-auto-next")?.addEventListener("change", (e) => { state.singleAutoNext = e.target.checked; });

  const singleStage = document.getElementById("single-card-stage");
  if (singleStage) {
    let touchStartX = 0, touchStartY = 0;
    singleStage.addEventListener("touchstart", (e) => { if (e.touches && e.touches[0]) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; } }, { passive: true });
    singleStage.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        const total = getFilteredCatalog().length;
        if (dx < 0 && state.singleIndex < total - 1) { state.singleIndex += 1; renderCatalog(); }
        else if (dx > 0 && state.singleIndex > 0) { state.singleIndex -= 1; renderCatalog(); }
      }
    }, { passive: true });
  }

  document.getElementById("toast-undo")?.addEventListener("click", () => {
    if (!lastSnapshot) return;
    const { animeId, prevStatus } = lastSnapshot;
    lastSnapshot = null;
    setStatus(animeId, prevStatus, true);
  });

  // 我的清單控制
  document.getElementById("mylist-search")?.addEventListener("input", (e) => { state.mylistSearch = e.target.value; renderMyList(); });
  document.getElementById("mylist-year")?.addEventListener("change", (e) => { state.mylistYear = e.target.value; renderMyList(); });
  document.getElementById("mylist-status")?.addEventListener("change", (e) => { state.mylistStatus = e.target.value; renderMyList(); });
  document.getElementById("mylist-sort")?.addEventListener("change", (e) => { state.mylistSort = e.target.value; renderMyList(); });

  document.getElementById("btn-export-csv")?.addEventListener("click", async () => {
    await ensureAllYearsLoaded();
    const header = ["ID", "Year", "Season", "Title_ZH", "Title_JP", "Title_EN", "Weekday", "Genres", "Status", "UpdatedAt"];
    const rows = animeList.filter((a) => getStatus(a.id) !== "unwatched").map((a) => [a.id, a.year, a.season, a.titleZh, a.titleJp, a.titleEn || "", a.weekday, (a.genres || []).join("/"), statusLabel(getStatus(a.id)), getUpdatedAt(a.id)]);
    downloadFile("anime-log-export.csv", "\uFEFF" + [header, ...rows].map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8;");
    showToast(`CSV (${rows.length})`, false);
  });
  document.getElementById("btn-export-json")?.addEventListener("click", () => { downloadFile("anime-log-backup.json", JSON.stringify(store, null, 2), "application/json;charset=utf-8;"); showToast("JSON backup downloaded", false); });
  document.getElementById("input-import-json")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (parsed && typeof parsed.items === "object" && parsed.items !== null) {
          store = parsed; StorageAdapter.save(store); renderAll(); showToast("JSON restored!", false);
        }
      } catch (err) { showToast("Invalid JSON", false); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });
  document.getElementById("btn-clear-all")?.addEventListener("click", () => {
    openConfirm(t("confirmResetTitle"), t("confirmResetBody"), () => {
      store = { schemaVersion: 1, updatedAt: new Date().toISOString(), items: {} }; lastSnapshot = null; StorageAdapter.save(store); renderAll(); showToast("Reset complete", false);
    });
  });

  // AI & 公開分享控制
  document.getElementById("ai-year-scope")?.addEventListener("change", async (e) => {
    state.aiYearScope = e.target.value;
    if (state.aiYearScope === "all") await ensureAllYearsLoaded();
    else await ensureYearLoaded(state.aiYearScope);
    renderAiView();
  });
  document.getElementById("ai-season-part")?.addEventListener("change", (e) => { state.aiSeasonPart = e.target.value; renderAiView(); });
  document.getElementById("ai-exclude-shorts")?.addEventListener("change", (e) => { state.aiExcludeShorts = e.target.checked; renderAiView(); });
  document.getElementById("ai-hide-r18")?.addEventListener("change", (e) => { state.aiHideR18 = e.target.checked; renderAiView(); });
  document.getElementById("btn-copy-ai-prompt")?.addEventListener("click", () => copyText(buildAiAndShareData().promptText, t("copiedAi")));
  document.getElementById("btn-copy-share-list")?.addEventListener("click", () => copyText(buildAiAndShareData().shareText, t("copiedShare")));
  document.getElementById("btn-copy-share-url")?.addEventListener("click", () => {
    const uid = currentUser ? currentUser.id : "local";
    const r18Flag = state.aiHideR18 ? "1" : "0";
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(uid)}&hideR18=${r18Flag}`;
    copyText(shareUrl, t("copiedShareUrl"));
  });
  document.getElementById("btn-download-ai-txt")?.addEventListener("click", () => { downloadFile("anime-log-ai-prompt.txt", buildAiAndShareData().promptText, "text/plain;charset=utf-8;"); showToast("Downloaded .txt", false); });

  // Debug 控制
  document.getElementById("btn-debug-scan")?.addEventListener("click", runDebugScan);
  document.getElementById("btn-debug-copy")?.addEventListener("click", () => copyText(JSON.stringify(debugLastIssues, null, 2), "已複製異常清單 JSON"));
  document.getElementById("btn-load-reports")?.addEventListener("click", loadReportsForDebug);

  // ==================== 啟動流程 ====================
  ThemeManager.init();
  CoverArtManager.init();

  Promise.all([initManifest(), loadCommunityStats(), initSupabaseAndSync()]).then(async () => {
    const newestYear = manifestYears[0] ? String(manifestYears[0].year) : "2026";
    state.homeYear = newestYear;
    state.catalogYear = newestYear;
    state.aiYearScope = newestYear;

    applyStaticI18n();
    await ensureYearLoaded(newestYear);

    if (shareUidParam) {
      await openPublicShareView(shareUidParam);
    } else {
      await switchView("home");
      // 初次訪問自動顯示功能導覽（含 Skip 按鈕）
      let tourDone = false;
      try { tourDone = Boolean(window.localStorage.getItem(TOUR_KEY)); } catch (e) {}
      if (!tourDone) openTour();
    }

    if (manifestYears[1]) {
      ensureYearLoaded(manifestYears[1].year).then(() => {
        if (state.view === "home") renderHome();
      });
    }
  });
})();
