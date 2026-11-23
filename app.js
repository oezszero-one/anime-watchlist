(function () {
  "use strict";

  const STORAGE_KEY = "anime_log_watchlist_v1";
  const COVER_CACHE_KEY = "anime_log_covers_v2";
  const THEME_KEY = "anime_log_theme_v1";
  const PAGE_SIZE = 40;

  const STATUS_LABELS = {
    unwatched: "沒看過",
    watched: "看過",
    liked: "喜歡",
    disliked: "不喜歡"
  };

  const SEASON_META = {
    "2026-winter": { year: 2026, part: "winter", label: "2026 冬季", shortLabel: "2026 冬" },
    "2026-spring": { year: 2026, part: "spring", label: "2026 春季", shortLabel: "2026 春" },
    "2026-summer": { year: 2026, part: "summer", label: "2026 夏季", shortLabel: "2026 夏" },
    "2026-fall":   { year: 2026, part: "fall",   label: "2026 秋季", shortLabel: "2026 秋" },
    "2025-winter": { year: 2025, part: "winter", label: "2025 冬季", shortLabel: "2025 冬" },
    "2025-spring": { year: 2025, part: "spring", label: "2025 春季", shortLabel: "2025 春" },
    "2025-summer": { year: 2025, part: "summer", label: "2025 夏季", shortLabel: "2025 夏" },
    "2025-fall":   { year: 2025, part: "fall",   label: "2025 秋季", shortLabel: "2025 秋" }
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

  // 淺色／深色主題管理
  const ThemeManager = {
    current: "dark",
    init() {
      let saved = null;
      try {
        saved = window.localStorage.getItem(THEME_KEY);
      } catch (e) {
        saved = null;
      }
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
        try {
          window.localStorage.setItem(THEME_KEY, theme);
        } catch (e) {
          // 忽略儲存錯誤
        }
      }
    },
    toggle() {
      this.apply(this.current === "dark" ? "light" : "dark", true);
    }
  };

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

  function cleanJpTitle(title) {
    return String(title || "")
      .replace(/[～〜~].*?[～〜~]/g, " ")
      .replace(/[（(].*?[）)]/g, " ")
      .replace(
        /(第\d+期|第\d+クール|Season\s*\d+|2nd\s*Season|3rd\s*Season|4th\s*Season|FINAL\s*SEASON|Part\s*\d+|後編|前編|前半|後半|最終章)/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  // 升級版封面管理：優先用預寫 coverUrl，否則透過 IntersectionObserver 依可視區域抓取（AniList + Jikan 雙來源備援）
  const CoverArtManager = {
    cache: {},
    pending: new Set(),
    failed: new Set(),
    queue: [],
    running: false,
    observer: null,

    init() {
      try {
        const raw = window.localStorage.getItem(COVER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") this.cache = parsed;
        }
      } catch (e) {
        this.cache = {};
      }

      if (typeof IntersectionObserver !== "undefined") {
        this.observer = new IntersectionObserver(
          (entries) => {
            const visibleBatch = [];
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const el = entry.target;
              this.observer.unobserve(el);
              const animeId = el.dataset.posterId;
              const anime = animeMap.get(animeId);
              if (anime && !this.getUrl(anime)) {
                visibleBatch.push(anime);
              }
            });
            if (visibleBatch.length > 0) this.enqueue(visibleBatch);
          },
          { rootMargin: "240px 0px" }
        );
      }
    },

    observeRenderedPosters(rootEl) {
      if (!rootEl) return;
      const boxes = rootEl.querySelectorAll("[data-poster-id]");
      if (this.observer) {
        boxes.forEach((box) => {
          const anime = animeMap.get(box.dataset.posterId);
          if (anime && !this.getUrl(anime)) {
            this.observer.observe(box);
          }
        });
      } else {
        const fallbackBatch = [];
        boxes.forEach((box) => {
          const anime = animeMap.get(box.dataset.posterId);
          if (anime && !this.getUrl(anime)) fallbackBatch.push(anime);
        });
        this.enqueue(fallbackBatch.slice(0, 15));
      }
    },

    saveCache() {
      try {
        window.localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(this.cache));
      } catch (e) {
        // 忽略配額限制
      }
    },

    getUrl(anime) {
      if (!anime) return null;
      if (anime.coverUrl) return anime.coverUrl;
      return this.cache[anime.id] || null;
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

    async fetchAniList(searchTitle) {
      const query = `
        query ($search: String) {
          Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            coverImage { large medium }
          }
        }
      `;
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables: { search: searchTitle } })
        });
        if (!res.ok) return null;
        const json = await res.json();
        return (
          json?.data?.Media?.coverImage?.large ||
          json?.data?.Media?.coverImage?.medium ||
          null
        );
      } catch (e) {
        return null;
      }
    },

    async fetchJikan(searchTitle) {
      try {
        const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTitle)}&limit=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const json = await res.json();
        const first = json?.data?.[0];
        return (
          first?.images?.jpg?.large_image_url ||
          first?.images?.jpg?.image_url ||
          null
        );
      } catch (e) {
        return null;
      }
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
          this.applyCoverToDom(anime.id, imgUrl);
        } else {
          this.failed.add(anime.id);
        }
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

  let animeList = [];
  let animeMap = new Map();
  let genreCountsAll = {};
  let allGenres = [];

  let store = StorageAdapter.load();
  let lastSnapshot = null;
  let toastTimer = null;
  const isInitialMobile = detectMobileDevice();

  const state = {
    view: "home",
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
    aiSeasonScope: "all",
    aiExcludeShorts: true,
    aiHideR18: true
  };

  function isR18Anime(anime) {
    return Array.isArray(anime.genres) && anime.genres.includes("R18");
  }

  function rebuildIndexes() {
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

    const sub = document.getElementById("header-subtitle");
    if (sub) {
      sub.textContent = `Watch. Rate. Discover. · 共 ${animeList.length} 部新番`;
    }
    const allTotalEl = document.getElementById("stat-all-total");
    if (allTotalEl) {
      allTotalEl.textContent = `/ ${animeList.length} 部`;
    }
  }

  async function loadAllYearDatasets() {
    // 優先讀取單檔預覽模式內嵌資料；部署於 GitHub Pages 時動態 fetch 分年 JSON
    if (window.ANIME_DATA_BY_YEAR && typeof window.ANIME_DATA_BY_YEAR === "object") {
      const y2026 = Array.isArray(window.ANIME_DATA_BY_YEAR[2026]) ? window.ANIME_DATA_BY_YEAR[2026] : [];
      const y2025 = Array.isArray(window.ANIME_DATA_BY_YEAR[2025]) ? window.ANIME_DATA_BY_YEAR[2025] : [];
      animeList = [...y2026, ...y2025];
      rebuildIndexes();
      return;
    }

    const years = [2026, 2025];
    const results = await Promise.all(
      years.map(async (y) => {
        try {
          const res = await fetch(`./data-${y}.json`);
          if (!res.ok) return [];
          const json = await res.json();
          return Array.isArray(json) ? json : [];
        } catch (e) {
          return [];
        }
      })
    );
    animeList = results.flat();
    rebuildIndexes();
  }

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

    document.querySelectorAll(".home-year-btn").forEach((btn) => {
      const active = btn.dataset.homeYear === state.homeYear;
      btn.className = active
        ? "home-year-btn px-2.5 py-1 rounded-md font-semibold bg-violet-600 text-white transition"
        : "home-year-btn px-2.5 py-1 rounded-md font-medium text-dim hover:text-main transition";
    });

    const seasonContainer = document.getElementById("home-season-cards");
    if (seasonContainer) {
      const y = state.homeYear;
      const keys = [`${y}-winter`, `${y}-spring`, `${y}-summer`, `${y}-fall`];
      seasonContainer.innerHTML = keys
        .map((key) => {
          const meta = SEASON_META[key] || { label: key, part: "all" };
          const subset = animeList.filter((a) => a.season === key);
          const s = computeStats(subset);
          const pct = s.total > 0 ? Math.round((s.ratedTotal / s.total) * 100) : 0;
          return `
            <button type="button" data-jump-year="${y}" data-jump-part="${meta.part}" class="text-left rounded-2xl p-4 surface-card hover:border-violet-500/45 transition space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-main">${escapeHtml(meta.label)}</span>
                <span class="text-xs px-2 py-0.5 rounded-full surface-chip">${s.total} 部</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-slate-500/20 overflow-hidden">
                <div class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" style="width:${pct}%"></div>
              </div>
              <div class="flex items-center justify-between text-xs text-dim">
                <span>已標記 ${s.ratedTotal} 部（${pct}%）</span>
                <span class="text-rose-500 font-medium">喜歡 ${s.liked}</span>
              </div>
            </button>
          `;
        })
        .join("");

      seasonContainer.querySelectorAll("[data-jump-year]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.catalogYear = btn.dataset.jumpYear;
          state.catalogSeasonPart = btn.dataset.jumpPart;
          state.singleIndex = 0;
          state.catalogLimit = PAGE_SIZE;
          switchView("catalog");
        });
      });
    }

    const genreBars = document.getElementById("home-genre-bars");
    if (genreBars) {
      const likedAnime = animeList.filter((a) => getStatus(a.id) === "liked");
      if (likedAnime.length === 0) {
        genreBars.innerHTML = `
          <div class="rounded-xl surface-stat border-dashed p-4 text-center text-xs sm:text-sm text-dim">
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
                  <span class="font-medium text-main">${escapeHtml(genre)}</span>
                  <span class="text-dim">${count} 部喜歡</span>
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

  function renderPosterHtml(anime, sizeClasses, isLarge) {
    const coverUrl = CoverArtManager.getUrl(anime);
    const meta = SEASON_META[anime.season] || { shortLabel: anime.season };
    const mainGenre = (anime.genres && anime.genres[0]) || "動畫";
    const imgHidden = coverUrl ? "" : "hidden";
    const fallbackHidden = coverUrl ? "hidden" : "";
    const srcAttr = coverUrl ? `src="${escapeHtml(coverUrl)}"` : "";

    return `
      <div data-poster-id="${escapeHtml(anime.id)}" class="poster-box ${sizeClasses} rounded-xl shrink-0">
        <img ${srcAttr} alt="${escapeHtml(anime.titleZh)}" loading="lazy" referrerpolicy="no-referrer" class="${imgHidden}" onerror="this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');" />
        <div data-poster-fallback class="${fallbackHidden} w-full h-full flex flex-col items-center justify-center p-2 text-center select-none bg-gradient-to-br from-violet-950/90 via-slate-900 to-indigo-950/90">
          <svg class="${isLarge ? "w-9 h-9 mb-2" : "w-5 h-5 mb-1"} text-violet-400/75" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <span class="${isLarge ? "text-xs px-2 py-0.5" : "text-[9px] px-1.5 py-0.5"} rounded bg-violet-500/25 text-violet-200 font-semibold mb-1">${escapeHtml(mainGenre)}</span>
          <span class="${isLarge ? "text-xs line-clamp-3 px-2" : "text-[10px] line-clamp-2"} text-slate-200 font-medium leading-tight">${escapeHtml(anime.titleZh)}</span>
          ${isLarge ? `<span class="text-[10px] text-slate-400 mt-1">${escapeHtml(meta.shortLabel || "")}</span>` : ""}
        </div>
      </div>
    `;
  }

  function renderGenreBadges(genres, isLarge) {
    return (genres || [])
      .map((g) => {
        const cls =
          g === "R18"
            ? "badge-r18"
            : "surface-chip";
        const pad = isLarge ? "text-xs px-2.5 py-1 rounded-lg" : "text-[11px] px-2 py-0.5 rounded-md";
        return `<span class="inline-block ${pad} ${cls}">${escapeHtml(g)}</span>`;
      })
      .join("");
  }

  function renderAnimeCard(anime) {
    const status = getStatus(anime.id);
    const meta = SEASON_META[anime.season] || { shortLabel: anime.season };
    const weekdayText = anime.weekdayNote
      ? `${anime.weekday}（${anime.weekdayNote}）`
      : anime.weekday;

    const genreHtml = renderGenreBadges(anime.genres, false);

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
            <div class="flex items-center justify-between gap-2 text-[11px] text-dim">
              <span class="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25 font-medium shrink-0">${escapeHtml(meta.shortLabel || anime.season)}</span>
              <span class="truncate">${escapeHtml(weekdayText)}</span>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-main leading-snug line-clamp-2">${escapeHtml(anime.titleZh)}</h3>
              <p class="text-xs text-dim mt-0.5 truncate">${escapeHtml(anime.titleJp)}</p>
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
    const meta = SEASON_META[anime.season] || { label: anime.season };
    const weekdayText = anime.weekdayNote
      ? `${anime.weekday}（${anime.weekdayNote}）`
      : anime.weekday;

    const genreHtml = renderGenreBadges(anime.genres, true);

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

    const posterHtml = renderPosterHtml(anime, "w-44 h-64 sm:w-52 sm:h-72 mx-auto shadow-xl", true);

    return `
      <article class="anime-card rounded-3xl p-5 flex flex-col items-center text-center gap-4" data-status="${status}">
        <div class="w-full flex items-center justify-between text-xs text-dim">
          <span class="px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25 font-semibold">${escapeHtml(meta.label || anime.season)}</span>
          <span>${escapeHtml(weekdayText)}</span>
        </div>

        ${posterHtml}

        <div class="space-y-1.5 w-full">
          <h3 class="text-lg sm:text-xl font-bold text-main leading-snug">${escapeHtml(anime.titleZh)}</h3>
          <p class="text-xs sm:text-sm text-dim">${escapeHtml(anime.titleJp)}</p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-1.5">${genreHtml}</div>

        <div class="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">${buttons}</div>
        <p class="text-[11px] text-dim">提示：可左右滑動卡片或使用下方按鈕切換作品</p>
      </article>
    `;
  }

  function getFilteredCatalog() {
    const kw = state.catalogSearch.trim().toLowerCase();
    return animeList.filter((a) => {
      if (state.catalogYear !== "all" && String(a.year) !== state.catalogYear) return false;
      if (state.catalogSeasonPart !== "all") {
        const meta = SEASON_META[a.season];
        if (!meta || meta.part !== state.catalogSeasonPart) return false;
      }
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
    document.querySelectorAll(".year-tab").forEach((btn) => {
      btn.classList.toggle("pill-active", btn.dataset.year === state.catalogYear);
    });

    document.querySelectorAll(".season-tab").forEach((btn) => {
      btn.classList.toggle("pill-active", btn.dataset.seasonPart === state.catalogSeasonPart);
    });

    document.querySelectorAll(".display-mode-btn").forEach((btn) => {
      const active = btn.dataset.displayMode === state.catalogDisplayMode;
      btn.className = active
        ? "display-mode-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white shadow transition flex items-center gap-1"
        : "display-mode-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-dim hover:text-main transition flex items-center gap-1";
    });

    const hintEl = document.getElementById("device-mode-hint");
    if (hintEl) {
      hintEl.textContent = isInitialMobile
        ? "已偵測為手機裝置（可隨時切換列表）"
        : "點擊按鈕即自動存檔";
    }

    document.querySelectorAll(".status-filter-tab").forEach((btn) => {
      btn.classList.toggle("pill-active", btn.dataset.status === state.catalogStatus);
    });

    const genreWrap = document.getElementById("catalog-genre-chips");
    if (genreWrap) {
      const chips = ["all", ...allGenres]
        .map((g) => {
          const active = state.catalogGenre === g;
          const label = g === "all" ? "全部類型" : `${g} (${genreCountsAll[g]})`;
          let cls = active ? "genre-chip-active" : "surface-pill";
          if (!active && g === "R18") cls = "badge-r18";
          return `<button type="button" data-genre="${escapeHtml(g)}" class="genre-chip shrink-0 px-2.5 py-1 rounded-lg text-xs border transition ${cls}">${escapeHtml(label)}</button>`;
        })
        .join("");
      genreWrap.innerHTML = chips;
      genreWrap.querySelectorAll(".genre-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.catalogGenre = btn.dataset.genre;
          state.singleIndex = 0;
          state.catalogLimit = PAGE_SIZE;
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
    if (countEl) countEl.textContent = `符合條件共 ${filtered.length} 部作品`;

    const listEl = document.getElementById("catalog-list");
    const loadMoreWrap = document.getElementById("catalog-load-more-wrap");
    const loadMoreBtn = document.getElementById("btn-load-more");
    const singleWrap = document.getElementById("catalog-single-wrap");
    if (!listEl || !singleWrap) return;

    if (state.catalogDisplayMode === "card") {
      listEl.classList.add("hidden");
      if (loadMoreWrap) loadMoreWrap.classList.add("hidden");
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
            <div class="rounded-2xl surface-card border-dashed p-8 text-center text-sm text-dim">
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

        // 預載目前與接下來 3 部封面
        CoverArtManager.enqueue(filtered.slice(state.singleIndex, state.singleIndex + 4));
      }
    } else {
      singleWrap.classList.add("hidden");
      listEl.classList.remove("hidden");

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="col-span-full rounded-2xl surface-card border-dashed p-8 text-center text-sm text-dim">
            找不到符合目前條件的作品，試著清除部分篩選條件吧。
          </div>
        `;
        if (loadMoreWrap) loadMoreWrap.classList.add("hidden");
      } else {
        const visibleItems = filtered.slice(0, state.catalogLimit);
        listEl.innerHTML = visibleItems.map(renderAnimeCard).join("");
        CoverArtManager.observeRenderedPosters(listEl);

        const remaining = filtered.length - visibleItems.length;
        if (loadMoreWrap && loadMoreBtn) {
          if (remaining > 0) {
            loadMoreWrap.classList.remove("hidden");
            loadMoreBtn.textContent = `載入更多作品（還有 ${remaining} 部）`;
          } else {
            loadMoreWrap.classList.add("hidden");
          }
        }
      }
    }
  }

  function renderMyList() {
    const kw = state.mylistSearch.trim().toLowerCase();
    let items = animeList.filter((a) => getStatus(a.id) !== "unwatched");

    items = items.filter((a) => {
      if (state.mylistYear !== "all" && String(a.year) !== state.mylistYear) return false;
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
          <div class="col-span-full rounded-2xl surface-card border-dashed p-8 text-center space-y-2">
            <p class="text-sm text-main font-medium">目前沒有符合條件的追番紀錄</p>
            <p class="text-xs text-dim">你可以前往「新番檢核」頁，將看過或喜歡的作品標記起來。</p>
          </div>
        `;
      } else {
        container.innerHTML = items.map(renderAnimeCard).join("");
        CoverArtManager.observeRenderedPosters(container);
      }
    }
  }

  function buildAiAndShareData() {
    const scope = state.aiSeasonScope;
    const excludeShorts = state.aiExcludeShorts;
    const hideR18 = state.aiHideR18;

    const r18Pass = (a) => !(hideR18 && isR18Anime(a));

    const likedList = animeList.filter((a) => getStatus(a.id) === "liked" && r18Pass(a));
    const watchedList = animeList.filter((a) => getStatus(a.id) === "watched" && r18Pass(a));
    const dislikedList = animeList.filter((a) => getStatus(a.id) === "disliked" && r18Pass(a));

    let unwatchedCandidates = animeList.filter((a) => getStatus(a.id) === "unwatched" && r18Pass(a));
    if (scope === "2026" || scope === "2025") {
      unwatchedCandidates = unwatchedCandidates.filter((a) => String(a.year) === scope);
    } else if (scope !== "all") {
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
        if (hideR18 && g === "R18") return;
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
      scope === "all"
        ? "2025–2026 全部"
        : scope === "2026" || scope === "2025"
        ? `${scope} 全年`
        : SEASON_META[scope]?.label || scope;

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
                `- [${SEASON_META[a.season]?.shortLabel || a.season}] ${a.titleZh}（${a.titleJp}）| 類型：${(a.genres || []).join("、")}`
            )
            .join("\n")
        : "（此範圍內沒有沒看過的作品）";

    const r18Note = hideR18 ? "（已隱藏 R18 作品）" : "（含 R18 作品）";

    const promptText = `請擔任我的專屬動漫推薦顧問！以下是我從「ANIME LOG. 2025–2026 新番檢核表」匯出的個人觀影偏好與未看片單${r18Note}：

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

    const shareText = `📺 我的 ANIME LOG. 2025–2026 追番片單分享${r18Note}
偏好類型：${topGenresText}

❤️ 喜歡（${likedList.length} 部）：
${likedLines}

👀 看過（${watchedList.length} 部）：
${watchedList.length > 0 ? watchedList.map((a) => `- ${a.titleZh}`).join("\n") : "（無）"}

⚠️ 不喜歡（${dislikedList.length} 部）：
${dislikedLines}`;

    return {
      likedCount: likedList.length,
      dislikedCount: dislikedList.length,
      unwatchedCount: unwatchedCandidates.length,
      promptText,
      shareText
    };
  }

  function renderAiView() {
    const res = buildAiAndShareData();
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

  function copyText(text, successMsg) {
    const msg = successMsg || "已複製到剪貼簿！";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast(msg, false))
        .catch(() => fallbackCopy(text, msg));
    } else {
      fallbackCopy(text, msg);
    }
  }

  function fallbackCopy(text, msg) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast(msg, false);
    } catch (e) {
      showToast("請手動全選文字框內容並複製", false);
    }
    document.body.removeChild(ta);
  }

  // 事件委派：處理作品狀態點擊
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set-status]");
    if (!btn) return;
    const animeId = btn.dataset.animeId;
    const nextStatus = btn.dataset.setStatus;
    if (animeId && nextStatus) setStatus(animeId, nextStatus, false);
  });

  // 導覽與主題按鈕
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.nav));
  });
  document.getElementById("btn-theme-toggle")?.addEventListener("click", () => ThemeManager.toggle());

  // 首頁年度切換與快捷按鈕
  document.querySelectorAll(".home-year-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.homeYear = btn.dataset.homeYear;
      renderHome();
    });
  });
  document.getElementById("home-goto-catalog")?.addEventListener("click", () => switchView("catalog"));
  document.getElementById("home-goto-ai")?.addEventListener("click", () => switchView("ai"));

  // 新番頁控制項
  document.querySelectorAll(".year-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogYear = btn.dataset.year;
      state.singleIndex = 0;
      state.catalogLimit = PAGE_SIZE;
      renderCatalog();
    });
  });
  document.querySelectorAll(".season-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogSeasonPart = btn.dataset.seasonPart;
      state.singleIndex = 0;
      state.catalogLimit = PAGE_SIZE;
      renderCatalog();
    });
  });
  document.querySelectorAll(".display-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogDisplayMode = btn.dataset.displayMode;
      renderCatalog();
    });
  });
  document.querySelectorAll(".status-filter-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.catalogStatus = btn.dataset.status;
      state.singleIndex = 0;
      state.catalogLimit = PAGE_SIZE;
      renderCatalog();
    });
  });
  document.getElementById("catalog-search")?.addEventListener("input", (e) => {
    state.catalogSearch = e.target.value;
    state.singleIndex = 0;
    state.catalogLimit = PAGE_SIZE;
    renderCatalog();
  });
  document.getElementById("catalog-weekday")?.addEventListener("change", (e) => {
    state.catalogWeekday = e.target.value;
    state.singleIndex = 0;
    state.catalogLimit = PAGE_SIZE;
    renderCatalog();
  });
  document.getElementById("catalog-clear-filters")?.addEventListener("click", () => {
    state.catalogSearch = "";
    state.catalogStatus = "all";
    state.catalogWeekday = "all";
    state.catalogGenre = "all";
    state.singleIndex = 0;
    state.catalogLimit = PAGE_SIZE;
    const sEl = document.getElementById("catalog-search");
    const wEl = document.getElementById("catalog-weekday");
    if (sEl) sEl.value = "";
    if (wEl) wEl.value = "all";
    renderCatalog();
  });
  document.getElementById("btn-load-more")?.addEventListener("click", () => {
    state.catalogLimit += PAGE_SIZE;
    renderCatalog();
  });

  // 單張模式控制
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

  // Toast 復原
  document.getElementById("toast-undo")?.addEventListener("click", () => {
    if (!lastSnapshot) return;
    const { animeId, prevStatus } = lastSnapshot;
    lastSnapshot = null;
    setStatus(animeId, prevStatus, true);
  });

  // 我的清單控制項
  document.getElementById("mylist-search")?.addEventListener("input", (e) => {
    state.mylistSearch = e.target.value;
    renderMyList();
  });
  document.getElementById("mylist-year")?.addEventListener("change", (e) => {
    state.mylistYear = e.target.value;
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

  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    const header = ["ID", "年份", "季度", "繁體中文名稱", "日文原名", "開播星期", "動畫類型", "觀看狀態", "更新時間"];
    const rows = animeList
      .filter((a) => getStatus(a.id) !== "unwatched")
      .map((a) => [
        a.id,
        a.year,
        SEASON_META[a.season]?.label || a.season,
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
    downloadFile("anime-log-2025-2026.csv", csvContent, "text/csv;charset=utf-8;");
    showToast(`已匯出 ${rows.length} 筆 CSV 紀錄`, false);
  });

  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    downloadFile(
      "anime-log-backup.json",
      JSON.stringify(store, null, 2),
      "application/json;charset=utf-8;"
    );
    showToast("已下載 JSON 備份檔", false);
  });

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

  // AI 推薦與分享控制項
  document.getElementById("ai-season-scope")?.addEventListener("change", (e) => {
    state.aiSeasonScope = e.target.value;
    renderAiView();
  });
  document.getElementById("ai-exclude-shorts")?.addEventListener("change", (e) => {
    state.aiExcludeShorts = e.target.checked;
    renderAiView();
  });
  document.getElementById("ai-hide-r18")?.addEventListener("change", (e) => {
    state.aiHideR18 = e.target.checked;
    renderAiView();
  });
  document.getElementById("btn-copy-ai-prompt")?.addEventListener("click", () => {
    const { promptText } = buildAiAndShareData();
    copyText(promptText, "已複製 AI 推薦提示詞到剪貼簿！");
  });
  document.getElementById("btn-copy-share-list")?.addEventListener("click", () => {
    const { shareText } = buildAiAndShareData();
    copyText(shareText, "已複製純文字分享清單到剪貼簿！");
  });
  document.getElementById("btn-download-ai-txt")?.addEventListener("click", () => {
    const { promptText } = buildAiAndShareData();
    downloadFile("anime-log-ai-prompt.txt", promptText, "text/plain;charset=utf-8;");
    showToast("已下載 AI 推薦提示詞 .txt", false);
  });

  // 啟動初始化
  ThemeManager.init();
  CoverArtManager.init();
  loadAllYearDatasets().then(() => {
    switchView("home");
  });
})();
