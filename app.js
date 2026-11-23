(function () {
  "use strict";

  const STORAGE_KEY = "anime_log_watchlist_v1";
  const COVER_CACHE_KEY = "anime_log_covers_v1";
  const STATUS_LABELS = {
    unwatched: "沒看過",
    watched: "看過",
    liked: "喜歡",
    disliked: "不喜歡"
  };
  const WEEKDAY_ORDER = {
    "星期一": 1,
    "星期二": 2,
    "星期三": 3,
    "星期四": 4,
    "星期五": 5,
    "星期六": 6,
    "星期日": 7,
    "一次上架": 8
  };

  // 預留第二階段 Supabase 替換的 StorageAdapter 抽象層
  const StorageAdapter = {
    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { schemaVersion: 1, updatedAt: null, items: {} };
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.items === "object" && parsed.items !== null) {
          return parsed;
        }
      } catch (e) {
        // 忽略受限環境或格式錯誤
      }
      return { schemaVersion: 1, updatedAt: null, items: {} };
    },
    save(data) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  // 自動偵測是否為手機裝置
  function detectMobileDevice() {
    const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || ""
    );
    const narrowScreen = window.innerWidth < 768;
    const coarsePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    return uaMobile || narrowScreen || coarsePointer;
  }

  // 動漫縮圖快取與非同步載入器（透過公開 CORS 支援的 AniList GraphQL API）
  const CoverArtManager = {
    cache: {},
    pending: new Set(),
    failed: new Set(),
    queue: [],
    running: false,

    init() {
      try {
        const raw = window.localStorage.getItem(COVER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            this.cache = parsed;
          }
        }
      } catch (e) {
        this.cache = {};
      }
    },

    saveCache() {
      try {
        window.localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(this.cache));
      } catch (e) {
        // 忽略儲存空間限制
      }
    },

    getUrl(animeId) {
      return this.cache[animeId] || null;
    },

    enqueue(animeListToFetch) {
      let added = false;
      animeListToFetch.forEach((a) => {
        if (!a || !a.id) return;
        if (this.cache[a.id] || this.pending.has(a.id) || this.failed.has(a.id)) return;
        this.pending.add(a.id);
        this.queue.push(a);
        added = true;
      });
      if (added && !this.running) {
        this.processQueue();
      }
    },

    async processQueue() {
      if (this.running) return;
      this.running = true;
      while (this.queue.length > 0) {
        const anime = this.queue.shift();
        await this.fetchOne(anime);
        // 禮貌性間隔，避免觸發 API 速率限制
        await new Promise((r) => setTimeout(r, 220));
      }
      this.running = false;
    },

    async fetchOne(anime) {
      const searchTitle = anime.titleJp || anime.titleZh;
      const query = `
        query ($search: String) {
          Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            coverImage {
              large
              medium
            }
          }
        }
      `;
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ query, variables: { search: searchTitle } })
        });
        if (!res.ok) {
          this.failed.add(anime.id);
          return;
        }
        const json = await res.json();
        const imgUrl =
          json?.data?.Media?.coverImage?.large ||
          json?.data?.Media?.coverImage?.medium ||
          null;
        if (imgUrl) {
          this.cache[anime.id] = imgUrl;
          this.saveCache();
          this.applyCoverToDom(anime.id, imgUrl);
        } else {
          this.failed.add(anime.id);
        }
      } catch (e) {
        this.failed.add(anime.id);
      } finally {
        this.pending.delete(anime.id);
      }
    },

    applyCoverToDom(animeId, imgUrl) {
      document.querySelectorAll(`[data-poster-id="${CSS.escape(animeId)}"]`).forEach((box) => {
        const img = box.querySelector("img");
        const fallback = box.querySelector("[data-poster-fallback]");
        if (img) {
          img.src = imgUrl;
          img.classList.remove("hidden");
        }
        if (fallback) {
          fallback.classList.add("hidden");
        }
      });
    }
  };

  CoverArtManager.init();

  const animeList = Array.isArray(window.ANIME_DATA) ? window.ANIME_DATA : [];
  const seasonMeta = window.ANIME_SEASON_META || {};
  const animeMap = new Map(animeList.map((item) => [item.id, item]));

  let store = StorageAdapter.load();
  let lastSnapshot = null;
  let toastTimer = null;
  const isInitialMobile = detectMobileDevice();

  const state = {
    view: "home",
    catalogSeason: "all",
    catalogSearch: "",
    catalogStatus: "all",
    catalogWeekday: "all",
    catalogGenre: "all",
    catalogDisplayMode: isInitialMobile ? "card" : "list",
    singleIndex: 0,
    singleAutoNext: true,
    mylistSearch: "",
    mylistSeason: "all",
    mylistStatus: "all",
    mylistSort: "updated",
    aiSeasonScope: "all",
    aiExcludeShorts: true
  };

  // 收集並排序所有類型標籤（依出現頻率由高到低）
  const genreCountsAll = {};
  animeList.forEach((a) => {
    (a.genres || []).forEach((g) => {
      genreCountsAll[g] = (genreCountsAll[g] || 0) + 1;
    });
  });
  const allGenres = Object.keys(genreCountsAll).sort(
    (a, b) => genreCountsAll[b] - genreCountsAll[a]
  );

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

    if (nextStatus === "unwatched") {
      delete store.items[animeId];
    } else {
      store.items[animeId] = {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      };
    }
    store.updatedAt = new Date().toISOString();
    StorageAdapter.save(store);

    const anime = animeMap.get(animeId);
    const title = anime ? anime.titleZh : "作品";
    showToast(`「${title}」已標記為「${STATUS_LABELS[nextStatus]}」`, !skipUndo);

    // 若在單張模式且開啟自動下一部，且目前狀態篩選為 all（不會自動從清單消失）時，順暢切到下一部
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

  function showToast(message, canUndo) {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-message");
    const undoBtn = document.getElementById("toast-undo");
    if (!toast || !msgEl || !undoBtn) return;

    msgEl.textContent = message;
    if (canUndo && lastSnapshot) {
      undoBtn.classList.remove("hidden");
    } else {
      undoBtn.classList.add("hidden");
    }

    toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3600);
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

    const close = () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    cancelBtn.onclick = close;
    okBtn.onclick = () => {
      close();
      onConfirm();
    };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function switchView(nextView) {
    state.view = nextView;
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== `view-${nextView}`);
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const active = btn.dataset.nav === nextView;
      btn.className = active
        ? "nav-btn px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white shadow transition"
        : "nav-btn px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition";
    });

    document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
      const active = btn.dataset.nav === nextView;
      btn.className = active
        ? "mobile-nav-btn flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-violet-400"
        : "mobile-nav-btn flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-400";
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    renderAll();
  }

  function computeStats(subset) {
    let liked = 0;
    let watched = 0;
    let disliked = 0;
    let unwatched = 0;

    subset.forEach((a) => {
      const st = getStatus(a.id);
      if (st === "liked") liked++;
      else if (st === "watched") watched++;
      else if (st === "disliked") disliked++;
      else unwatched++;
    });

    const ratedTotal = liked + watched + disliked;
    const likeDenom = liked + disliked;
    const likeRate = likeDenom > 0 ? Math.round((liked / likeDenom) * 100) : null;
    return { total: subset.length, liked, watched, disliked, unwatched, ratedTotal, likeRate };
  }

  function renderHome() {
    const overall = computeStats(animeList);
    const ratedEl = document.getElementById("stat-rated-total");
    const likedEl = document.getElementById("stat-liked");
    const watchedEl = document.getElementById("stat-watched");
    const rateEl = document.getElementById("stat-like-rate");
    const dislikedHintEl = document.getElementById("stat-disliked-hint");

    if (ratedEl) ratedEl.textContent = overall.ratedTotal;
    if (likedEl) likedEl.textContent = overall.liked;
    if (watchedEl) watchedEl.textContent = overall.watched;
    if (rateEl) rateEl.textContent = overall.likeRate !== null ? `${overall.likeRate}%` : "—";
    if (dislikedHintEl) dislikedHintEl.textContent = `${overall.disliked} 部不喜歡`;

    const seasonContainer = document.getElementById("home-season-cards");
    if (seasonContainer) {
      const keys = ["2026-spring", "2026-summer", "2026-fall"];
      seasonContainer.innerHTML = keys
        .map((key) => {
          const meta = seasonMeta[key] || { label: key, shortLabel: "" };
          const subset = animeList.filter((a) => a.season === key);
          const s = computeStats(subset);
          const pct = s.total > 0 ? Math.round((s.ratedTotal / s.total) * 100) : 0;
          return `
            <button type="button" data-jump-season="${key}" class="text-left rounded-2xl p-4 bg-[#121826] hover:bg-[#171f31] border border-slate-800/80 hover:border-violet-500/40 transition space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-white">${escapeHtml(meta.label)}</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${s.total} 部</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style="width:${pct}%"></div>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span>已標記 ${s.ratedTotal} 部（${pct}%）</span>
                <span class="text-rose-300">喜歡 ${s.liked}</span>
              </div>
            </button>
          `;
        })
        .join("");

      seasonContainer.querySelectorAll("[data-jump-season]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.catalogSeason = btn.dataset.jumpSeason;
          state.singleIndex = 0;
          switchView("catalog");
        });
      });
    }

    const genreBars = document.getElementById("home-genre-bars");
    if (genreBars) {
      const likedAnime = animeList.filter((a) => getStatus(a.id) === "liked");
      if (likedAnime.length === 0) {
        genreBars.innerHTML = `
          <div class="rounded-xl bg-slate-900/60 border border-dashed border-slate-700 p-4 text-center text-xs sm:text-sm text-slate-400">
            你尚未標記任何「喜歡」的作品。前往「新番檢核」標記幾部喜歡的作品，這裡就會自動分析你的偏好類型！
          </div>
        `;
      } else {
        const counts = {};
        likedAnime.forEach((a) => {
          (a.genres || []).forEach((g) => {
            counts[g] = (counts[g] || 0) + 1;
          });
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);
        const maxVal = sorted[0] ? sorted[0][1] : 1;

        genreBars.innerHTML = sorted
          .map(([genre, count]) => {
            const widthPct = Math.round((count / maxVal) * 100);
            return `
              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-slate-200">${escapeHtml(genre)}</span>
                  <span class="text-slate-400">${count} 部喜歡</span>
                </div>
                <div class="w-full h-2 rounded-full bg-slate-800/90 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-rose-500 to-violet-500" style="width:${widthPct}%"></div>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }
  }

  function renderPosterHtml(anime, sizeClasses, isLarge) {
    const coverUrl = CoverArtManager.getUrl(anime.id);
    const meta = seasonMeta[anime.season] || { shortLabel: anime.season };
    const mainGenre = (anime.genres && anime.genres[0]) || "動畫";
    const imgHidden = coverUrl ? "" : "hidden";
    const fallbackHidden = coverUrl ? "hidden" : "";
    const srcAttr = coverUrl ? `src="${escapeHtml(coverUrl)}"` : "";

    return `
      <div data-poster-id="${escapeHtml(anime.id)}" class="poster-box ${sizeClasses} rounded-xl shrink-0">
        <img ${srcAttr} alt="${escapeHtml(anime.titleZh)}" loading="lazy" class="${imgHidden}" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');" />
        <div data-poster-fallback class="${fallbackHidden} w-full h-full flex flex-col items-center justify-center p-2 text-center select-none bg-gradient-to-br from-violet-950/90 via-slate-900 to-indigo-950/90">
          <svg class="${isLarge ? "w-9 h-9 mb-2" : "w-5 h-5 mb-1"} text-violet-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <span class="${isLarge ? "text-xs px-2 py-0.5" : "text-[9px] px-1.5 py-0.5"} rounded bg-violet-500/20 text-violet-200 font-semibold mb-1">${escapeHtml(mainGenre)}</span>
          <span class="${isLarge ? "text-xs line-clamp-3 px-2" : "text-[10px] line-clamp-2"} text-slate-300/90 font-medium leading-tight">${escapeHtml(anime.titleZh)}</span>
          ${isLarge ? `<span class="text-[10px] text-slate-500 mt-1">${escapeHtml(meta.shortLabel || "")}</span>` : ""}
        </div>
      </div>
    `;
  }

  function renderAnimeCard(anime) {
    const status = getStatus(anime.id);
    const meta = seasonMeta[anime.season] || { shortLabel: anime.season };
    const weekdayText = anime.weekdayNote
      ? `${anime.weekday}（${anime.weekdayNote}）`
      : anime.weekday;

    const genreHtml = (anime.genres || [])
      .map(
        (g) =>
          `<span class="inline-block text-[11px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/70">${escapeHtml(g)}</span>`
      )
      .join("");

    const buttons = [
      { key: "unwatched", label: "沒看過" },
      { key: "watched", label: "看過" },
      { key: "liked", label: "喜歡" },
      { key: "disliked", label: "不喜歡" }
    ]
      .map((b) => {
        const isActive = status === b.key;
        const activeClass = isActive ? `active-${b.key}` : "";
        return `<button type="button" data-anime-id="${escapeHtml(anime.id)}" data-set-status="${b.key}" class="status-btn ${activeClass} flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center">${b.label}</button>`;
      })
      .join("");

    const posterHtml = renderPosterHtml(anime, "w-20 h-28 sm:w-24 sm:h-32", false);

    return `
      <article class="anime-card rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3" data-status="${status}">
        <div class="flex gap-3 min-w-0">
          ${posterHtml}
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span class="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25 font-medium shrink-0">${escapeHtml(meta.shortLabel || anime.season)}</span>
              <span class="truncate">${escapeHtml(weekdayText)}</span>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">${escapeHtml(anime.titleZh)}</h3>
              <p class="text-xs text-slate-400 mt-0.5 truncate">${escapeHtml(anime.titleJp)}</p>
            </div>
            <div class="flex flex-wrap gap-1 pt-0.5">${genreHtml}</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 pt-1">${buttons}</div>
      </article>
    `;
  }

  function renderSingleAnimeCard(anime) {
    const status = getStatus(anime.id);
    const meta = seasonMeta[anime.season] || { shortLabel: anime.season };
    const weekdayText = anime.weekdayNote
      ? `${anime.weekday}（${anime.weekdayNote}）`
      : anime.weekday;

    const genreHtml = (anime.genres || [])
      .map(
        (g) =>
          `<span class="inline-block text-xs px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700/80">${escapeHtml(g)}</span>`
      )
      .join("");

    const buttons = [
      { key: "unwatched", label: "沒看過" },
      { key: "watched", label: "看過" },
      { key: "liked", label: "喜歡" },
      { key: "disliked", label: "不喜歡" }
    ]
      .map((b) => {
        const isActive = status === b.key;
        const activeClass = isActive ? `active-${b.key}` : "";
        return `<button type="button" data-anime-id="${escapeHtml(anime.id)}" data-set-status="${b.key}" class="status-btn ${activeClass} py-3 px-2 rounded-xl text-sm font-semibold text-center">${b.label}</button>`;
      })
      .join("");

    const posterHtml = renderPosterHtml(anime, "w-44 h-64 sm:w-52 sm:h-72 mx-auto shadow-2xl", true);

    return `
      <article class="anime-card rounded-3xl p-5 flex flex-col items-center text-center gap-4" data-status="${status}">
        <div class="w-full flex items-center justify-between text-xs text-slate-400">
          <span class="px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/25 font-semibold">${escapeHtml(meta.label || anime.season)}</span>
          <span>${escapeHtml(weekdayText)}</span>
        </div>

        ${posterHtml}

        <div class="space-y-1.5 w-full">
          <h3 class="text-lg sm:text-xl font-bold text-white leading-snug">${escapeHtml(anime.titleZh)}</h3>
          <p class="text-xs sm:text-sm text-slate-400">${escapeHtml(anime.titleJp)}</p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-1.5">${genreHtml}</div>

        <div class="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">${buttons}</div>
        <p class="text-[11px] text-slate-500">提示：可左右滑動卡片或使用下方按鈕切換作品</p>
      </article>
    `;
  }

  function getFilteredCatalog() {
    const kw = state.catalogSearch.trim().toLowerCase();
    return animeList.filter((a) => {
      if (state.catalogSeason !== "all" && a.season !== state.catalogSeason) return false;
      if (state.catalogStatus !== "all" && getStatus(a.id) !== state.catalogStatus) return false;
      if (state.catalogWeekday !== "all" && a.weekday !== state.catalogWeekday) return false;
      if (state.catalogGenre !== "all" && !(a.genres || []).includes(state.catalogGenre)) return false;
      if (kw) {
        const zh = (a.titleZh || "").toLowerCase();
        const jp = (a.titleJp || "").toLowerCase();
        if (!zh.includes(kw) && !jp.includes(kw)) return false;
      }
      return true;
    });
  }

  function renderCatalog() {
    // 顯示模式按鈕高亮
    document.querySelectorAll(".display-mode-btn").forEach((btn) => {
      const active = btn.dataset.displayMode === state.catalogDisplayMode;
      btn.className = active
        ? "display-mode-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white shadow transition flex items-center gap-1"
        : "display-mode-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-1";
    });

    const hintEl = document.getElementById("device-mode-hint");
    if (hintEl) {
      hintEl.textContent = isInitialMobile
        ? "已偵測為手機裝置（可隨時切換列表）"
        : "點擊按鈕即自動存檔";
    }

    // 季度 Tabs 高亮
    document.querySelectorAll(".season-tab").forEach((btn) => {
      const active = btn.dataset.season === state.catalogSeason;
      btn.className = active
        ? "season-tab pill-active px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition"
        : "season-tab px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
    });

    // 狀態 Tabs 高亮
    document.querySelectorAll(".status-filter-tab").forEach((btn) => {
      const active = btn.dataset.status === state.catalogStatus;
      btn.className = active
        ? "status-filter-tab shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white border border-violet-500 transition"
        : "status-filter-tab shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
    });

    // 類型 Chips
    const genreWrap = document.getElementById("catalog-genre-chips");
    if (genreWrap) {
      const chips = ["all", ...allGenres]
        .map((g) => {
          const active = state.catalogGenre === g;
          const label = g === "all" ? "全部類型" : `${g} (${genreCountsAll[g]})`;
          const cls = active
            ? "genre-chip-active"
            : "bg-slate-900 text-slate-300 border-slate-700/80 hover:bg-slate-800";
          return `<button type="button" data-genre="${escapeHtml(g)}" class="genre-chip shrink-0 px-2.5 py-1 rounded-lg text-xs border transition ${cls}">${escapeHtml(label)}</button>`;
        })
        .join("");
      genreWrap.innerHTML = chips;
      genreWrap.querySelectorAll(".genre-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.catalogGenre = btn.dataset.genre;
          state.singleIndex = 0;
          renderCatalog();
        });
      });
    }

    const hasFilter =
      state.catalogSearch.trim() !== "" ||
      state.catalogStatus !== "all" ||
      state.catalogWeekday !== "all" ||
      state.catalogGenre !== "all";
    const clearBtn = document.getElementById("catalog-clear-filters");
    if (clearBtn) clearBtn.classList.toggle("hidden", !hasFilter);

    const filtered = getFilteredCatalog();
    const countEl = document.getElementById("catalog-result-count");
    if (countEl) countEl.textContent = `顯示 ${filtered.length} 部作品`;

    const listEl = document.getElementById("catalog-list");
    const singleWrap = document.getElementById("catalog-single-wrap");
    if (!listEl || !singleWrap) return;

    if (state.catalogDisplayMode === "card") {
      listEl.classList.add("hidden");
      singleWrap.classList.remove("hidden");

      const stage = document.getElementById("single-card-stage");
      const pageEl = document.getElementById("single-page-indicator");
      const barEl = document.getElementById("single-progress-bar");
      const prevBtn = document.getElementById("single-prev-btn");
      const nextBtn = document.getElementById("single-next-btn");

      if (filtered.length === 0) {
        if (pageEl) pageEl.textContent = "第 0 / 0 部";
        if (barEl) barEl.style.width = "0%";
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (stage) {
          stage.innerHTML = `
            <div class="rounded-2xl bg-[#121826] border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
              找不到符合目前條件的作品，試著清除部分篩選條件吧。
            </div>
          `;
        }
      } else {
        if (state.singleIndex >= filtered.length) state.singleIndex = filtered.length - 1;
        if (state.singleIndex < 0) state.singleIndex = 0;

        const currentAnime = filtered[state.singleIndex];
        const total = filtered.length;
        const pct = Math.round(((state.singleIndex + 1) / total) * 100);

        if (pageEl) pageEl.textContent = `第 ${state.singleIndex + 1} / ${total} 部`;
        if (barEl) barEl.style.width = `${pct}%`;
        if (prevBtn) prevBtn.disabled = state.singleIndex <= 0;
        if (nextBtn) nextBtn.disabled = state.singleIndex >= total - 1;
        if (stage) stage.innerHTML = renderSingleAnimeCard(currentAnime);

        // 預載目前與接下來 3 部的縮圖
        CoverArtManager.enqueue(filtered.slice(state.singleIndex, state.singleIndex + 4));
      }
    } else {
      singleWrap.classList.add("hidden");
      listEl.classList.remove("hidden");

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="col-span-full rounded-2xl bg-[#121826] border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            找不到符合目前條件的作品，試著清除部分篩選條件吧。
          </div>
        `;
      } else {
        listEl.innerHTML = filtered.map(renderAnimeCard).join("");
        // 優先載入前 20 部縮圖
        CoverArtManager.enqueue(filtered.slice(0, 20));
      }
    }
  }

  function renderMyList() {
    const kw = state.mylistSearch.trim().toLowerCase();
    let items = animeList.filter((a) => getStatus(a.id) !== "unwatched");

    items = items.filter((a) => {
      if (state.mylistSeason !== "all" && a.season !== state.mylistSeason) return false;
      if (state.mylistStatus !== "all" && getStatus(a.id) !== state.mylistStatus) return false;
      if (kw) {
        const zh = (a.titleZh || "").toLowerCase();
        const jp = (a.titleJp || "").toLowerCase();
        if (!zh.includes(kw) && !jp.includes(kw)) return false;
      }
      return true;
    });

    if (state.mylistSort === "updated") {
      items.sort((a, b) => getUpdatedAt(b.id).localeCompare(getUpdatedAt(a.id)));
    } else if (state.mylistSort === "weekday") {
      items.sort(
        (a, b) => (WEEKDAY_ORDER[a.weekday] || 99) - (WEEKDAY_ORDER[b.weekday] || 99)
      );
    } else {
      items.sort((a, b) => a.id.localeCompare(b.id));
    }

    const countEl = document.getElementById("mylist-count");
    if (countEl) countEl.textContent = `共 ${items.length} 筆已標記紀錄`;

    const container = document.getElementById("mylist-cards");
    if (container) {
      if (items.length === 0) {
        container.innerHTML = `
          <div class="col-span-full rounded-2xl bg-[#121826] border border-dashed border-slate-700 p-8 text-center space-y-2">
            <p class="text-sm text-slate-300 font-medium">目前沒有符合條件的追番紀錄</p>
            <p class="text-xs text-slate-400">你可以前往「新番檢核」頁，將看過或喜歡的作品標記起來。</p>
          </div>
        `;
      } else {
        container.innerHTML = items.map(renderAnimeCard).join("");
        CoverArtManager.enqueue(items.slice(0, 20));
      }
    }
  }

  function buildAiPrompt() {
    const scope = state.aiSeasonScope;
    const excludeShorts = state.aiExcludeShorts;

    const likedList = animeList.filter((a) => getStatus(a.id) === "liked");
    const dislikedList = animeList.filter((a) => getStatus(a.id) === "disliked");

    let unwatchedCandidates = animeList.filter((a) => getStatus(a.id) === "unwatched");
    if (scope !== "all") {
      unwatchedCandidates = unwatchedCandidates.filter((a) => a.season === scope);
    }
    if (excludeShorts) {
      unwatchedCandidates = unwatchedCandidates.filter(
        (a) => !(a.genres || []).includes("短篇")
      );
    }

    const likedGenreCounts = {};
    likedList.forEach((a) => {
      (a.genres || []).forEach((g) => {
        likedGenreCounts[g] = (likedGenreCounts[g] || 0) + 1;
      });
    });
    const topGenresText =
      Object.entries(likedGenreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([g, c]) => `${g}(${c})`)
        .join("、") || "尚無足夠喜歡紀錄";

    const scopeLabel =
      scope === "all" ? "2026 春・夏・秋三季" : (seasonMeta[scope]?.label || scope);

    const likedLines =
      likedList.length > 0
        ? likedList.map((a) => `- ${a.titleZh} [${(a.genres || []).join("／")}]`).join("\n")
        : "（尚未標記喜歡的作品）";

    const dislikedLines =
      dislikedList.length > 0
        ? dislikedList.map((a) => `- ${a.titleZh} [${(a.genres || []).join("／")}]`).join("\n")
        : "（無）";

    const candidateLines =
      unwatchedCandidates.length > 0
        ? unwatchedCandidates
            .map(
              (a) =>
                `- [${seasonMeta[a.season]?.shortLabel || a.season}] ${a.titleZh}（${a.titleJp}）| 類型：${(a.genres || []).join("、")}`
            )
            .join("\n")
        : "（此範圍內沒有沒看過的作品）";

    const promptText = `請擔任我的專屬動漫推薦顧問！以下是我從「ANIME LOG. 2026 新番檢核表」匯出的個人觀影偏好與未看片單：

【1. 我的偏好類型統計】
最常喜歡的類型：${topGenresText}

【2. 我標記「喜歡」的作品（共 ${likedList.length} 部）】
${likedLines}

【3. 我標記「不喜歡」的避雷作品（共 ${dislikedList.length} 部）】
${dislikedLines}

【4. 我還沒看過的候選清單（範圍：${scopeLabel}，共 ${unwatchedCandidates.length} 部）】
${candidateLines}

【任務需求】
請根據我「喜歡」與「不喜歡」的作品調性與類型分布，**只從上面「第 4 點沒看過的候選清單」中**，幫我挑選 5～8 部我最可能會喜歡、但還沒看過的遺珠動畫。
請為每部推薦作品說明：
1. 為什麼符合我的口味（對應到我喜歡的哪幾部或哪種元素）
2. 是否有任何可能踩雷的風險點`;

    return {
      likedCount: likedList.length,
      dislikedCount: dislikedList.length,
      unwatchedCount: unwatchedCandidates.length,
      promptText
    };
  }

  function renderAiView() {
    const res = buildAiPrompt();
    const likedEl = document.getElementById("ai-liked-count");
    const dislikedEl = document.getElementById("ai-disliked-count");
    const unwatchedEl = document.getElementById("ai-unwatched-count");
    const previewEl = document.getElementById("ai-prompt-preview");

    if (likedEl) likedEl.textContent = res.likedCount;
    if (dislikedEl) dislikedEl.textContent = res.dislikedCount;
    if (unwatchedEl) unwatchedEl.textContent = res.unwatchedCount;
    if (previewEl) previewEl.value = res.promptText;
  }

  function renderAll() {
    if (state.view === "home") renderHome();
    if (state.view === "catalog") renderCatalog();
    if (state.view === "mylist") renderMyList();
    if (state.view === "ai") renderAiView();
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

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast("已複製 AI 推薦提示詞到剪貼簿！", false))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const previewEl = document.getElementById("ai-prompt-preview");
    if (previewEl) {
      previewEl.select();
      previewEl.setSelectionRange(0, text.length);
      try {
        document.execCommand("copy");
        showToast("已複製 AI 推薦提示詞到剪貼簿！", false);
        return;
      } catch (e) {
        // 忽略失敗
      }
    }
    showToast("請手動全選文字框內容並複製", false);
  }

  // 事件委派：處理所有作品卡片狀態按鈕點擊
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set-status]");
    if (!btn) return;
    const animeId = btn.dataset.animeId;
    const nextStatus = btn.dataset.setStatus;
    if (animeId && nextStatus) {
      setStatus(animeId, nextStatus, false);
    }
  });

  // 導覽列綁定
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.nav));
  });

  // 顯示模式切換綁定
  document.querySelectorAll(".display-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogDisplayMode = btn.dataset.displayMode;
      renderCatalog();
    });
  });

  // 單張模式：上一部 / 下一部 / 自動下一部 / 觸控左右滑動
  document.getElementById("single-prev-btn")?.addEventListener("click", () => {
    if (state.singleIndex > 0) {
      state.singleIndex -= 1;
      renderCatalog();
    }
  });
  document.getElementById("single-next-btn")?.addEventListener("click", () => {
    const total = getFilteredCatalog().length;
    if (state.singleIndex < total - 1) {
      state.singleIndex += 1;
      renderCatalog();
    }
  });
  document.getElementById("single-auto-next")?.addEventListener("change", (e) => {
    state.singleAutoNext = e.target.checked;
  });

  const singleStage = document.getElementById("single-card-stage");
  if (singleStage) {
    let touchStartX = 0;
    let touchStartY = 0;
    singleStage.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );
    singleStage.addEventListener(
      "touchend",
      (e) => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          const total = getFilteredCatalog().length;
          if (dx < 0 && state.singleIndex < total - 1) {
            state.singleIndex += 1;
            renderCatalog();
          } else if (dx > 0 && state.singleIndex > 0) {
            state.singleIndex -= 1;
            renderCatalog();
          }
        }
      },
      { passive: true }
    );
  }

  // 首頁快捷按鈕
  document.getElementById("home-goto-catalog")?.addEventListener("click", () => switchView("catalog"));
  document.getElementById("home-goto-ai")?.addEventListener("click", () => switchView("ai"));

  // 復原按鈕
  document.getElementById("toast-undo")?.addEventListener("click", () => {
    if (!lastSnapshot) return;
    const { animeId, prevStatus } = lastSnapshot;
    lastSnapshot = null;
    setStatus(animeId, prevStatus, true);
  });

  // 新番頁篩選控制項
  document.querySelectorAll(".season-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogSeason = btn.dataset.season;
      state.singleIndex = 0;
      renderCatalog();
    });
  });

  document.querySelectorAll(".status-filter-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogStatus = btn.dataset.status;
      state.singleIndex = 0;
      renderCatalog();
    });
  });

  document.getElementById("catalog-search")?.addEventListener("input", (e) => {
    state.catalogSearch = e.target.value;
    state.singleIndex = 0;
    renderCatalog();
  });

  document.getElementById("catalog-weekday")?.addEventListener("change", (e) => {
    state.catalogWeekday = e.target.value;
    state.singleIndex = 0;
    renderCatalog();
  });

  document.getElementById("catalog-clear-filters")?.addEventListener("click", () => {
    state.catalogSearch = "";
    state.catalogStatus = "all";
    state.catalogWeekday = "all";
    state.catalogGenre = "all";
    state.singleIndex = 0;
    const sEl = document.getElementById("catalog-search");
    const wEl = document.getElementById("catalog-weekday");
    if (sEl) sEl.value = "";
    if (wEl) wEl.value = "all";
    renderCatalog();
  });

  // 我的清單控制項
  document.getElementById("mylist-search")?.addEventListener("input", (e) => {
    state.mylistSearch = e.target.value;
    renderMyList();
  });
  document.getElementById("mylist-season")?.addEventListener("change", (e) => {
    state.mylistSeason = e.target.value;
    renderMyList();
  });
  document.getElementById("mylist-status")?.addEventListener("change", (e) => {
    state.mylistStatus = e.target.value;
    renderMyList();
  });
  document.getElementById("mylist-sort")?.addEventListener("change", (e) => {
    state.mylistSort = e.target.value;
    renderMyList();
  });

  // 匯出 CSV
  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    const header = ["ID", "季度", "繁體中文名稱", "日文原名", "開播星期", "動畫類型", "觀看狀態", "更新時間"];
    const rows = animeList
      .filter((a) => getStatus(a.id) !== "unwatched")
      .map((a) => [
        a.id,
        seasonMeta[a.season]?.label || a.season,
        a.titleZh,
        a.titleJp,
        a.weekday,
        (a.genres || []).join("、"),
        STATUS_LABELS[getStatus(a.id)],
        getUpdatedAt(a.id)
      ]);
    const csvContent =
      "\uFEFF" +
      [header, ...rows]
        .map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    downloadFile("anime-log-2026.csv", csvContent, "text/csv;charset=utf-8;");
    showToast(`已匯出 ${rows.length} 筆 CSV 紀錄`, false);
  });

  // 備份 JSON
  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    downloadFile(
      "anime-log-2026-backup.json",
      JSON.stringify(store, null, 2),
      "application/json;charset=utf-8;"
    );
    showToast("已下載 JSON 備份檔", false);
  });

  // 還原 JSON
  document.getElementById("input-import-json")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (parsed && typeof parsed.items === "object" && parsed.items !== null) {
          store = parsed;
          StorageAdapter.save(store);
          renderAll();
          showToast("已成功還原 JSON 備份！", false);
        } else {
          showToast("JSON 格式不正確", false);
        }
      } catch (err) {
        showToast("無法讀取該 JSON 檔案", false);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // 重設全部紀錄
  document.getElementById("btn-clear-all")?.addEventListener("click", () => {
    openConfirm(
      "重設全部追番紀錄",
      "確定要清除所有已標記的「看過、喜歡、不喜歡」紀錄嗎？建議先下載 JSON 備份。",
      () => {
        store = { schemaVersion: 1, updatedAt: new Date().toISOString(), items: {} };
        lastSnapshot = null;
        StorageAdapter.save(store);
        renderAll();
        showToast("已重設全部紀錄", false);
      }
    );
  });

  // AI 推薦頁控制項
  document.getElementById("ai-season-scope")?.addEventListener("change", (e) => {
    state.aiSeasonScope = e.target.value;
    renderAiView();
  });
  document.getElementById("ai-exclude-shorts")?.addEventListener("change", (e) => {
    state.aiExcludeShorts = e.target.checked;
    renderAiView();
  });
  document.getElementById("btn-copy-ai-prompt")?.addEventListener("click", () => {
    const { promptText } = buildAiPrompt();
    copyText(promptText);
  });
  document.getElementById("btn-download-ai-txt")?.addEventListener("click", () => {
    const { promptText } = buildAiPrompt();
    downloadFile("anime-log-ai-prompt.txt", promptText, "text/plain;charset=utf-8;");
    showToast("已下載 AI 推薦提示詞 .txt", false);
  });

  // 初始化
  switchView("home");
})();
