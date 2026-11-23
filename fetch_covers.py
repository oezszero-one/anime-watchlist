#!/usr/bin/env python3
"""
ANIME LOG. 封面網址自動補齊腳本 (v1.2 強化版)
採用四層策略補齊 data-2025.json 與 data-2026.json 中尚未填寫 coverUrl 的作品：
1. AniList 季度整批抓取 + 本地正規化／模糊比對（大幅減少單筆請求並避免漏抓）
2. 強化標題清理（處理 16期、十四期、続編、副標等）+ AniList 單筆搜尋
3. Jikan (MyAnimeList) 公開 API 搜尋（含 429 重試）
4. Bangumi.tv 公開 API 搜尋（同時支援日文原名與中文名，對短篇／R18／冷門作命中率極高）
"""

import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

DATA_FILES = ["data-2025.json", "data-2026.json"]
ANILIST_URL = "https://graphql.anilist.co"
JIKAN_URL = "https://api.jikan.moe/v4/anime"
BGM_SEARCH_URL = "https://api.bgm.tv/search/subject/"
USER_AGENT = "AnimeLogCoverFetcher/1.2 (+https://oezszero-one.github.io/)"

SEASON_MAP = {
    "winter": "WINTER",
    "spring": "SPRING",
    "summer": "SUMMER",
    "fall": "FALL",
}


def normalize_key(text: str) -> str:
    """移除空白與標點符號並轉小寫，用於比對日文／中文標題"""
    s = unicodedata.normalize("NFKC", text or "").lower()
    s = re.sub(r"[\s\-_~～〜!！?？。、,.・:：;；「」『』()（）\[\]【】\"'♥★☆♪#]+", "", s)
    return s


def clean_jp_title(title: str) -> str:
    """移除常見續季、期數、副標字樣，提高搜尋命中率"""
    s = unicodedata.normalize("NFKC", title or "")
    s = re.sub(r"[～〜~].*?[～〜~]", " ", s)
    s = re.sub(r"[（(].*?[）)]", " ", s)
    s = re.sub(
        r"(第\s*\d+\s*期|\d+\s*期|[一二三四五六七八九十]+期|第\s*\d+\s*クール|第\s*\d+\s*シリーズ|第\s*\d+\s*シーズン|"
        r"Season\s*\d+|\d+(?:st|nd|rd|th)\s*Season|FINAL\s*SEASON|Part\s*\d+|"
        r"続編|後編|前編|前半|後半|最終章|新シリーズ|新エピソード|Ⅱ|Ⅲ|II|III)",
        " ",
        s,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", s).strip()


def first_segment(title: str) -> str:
    """若標題含副標或空白分隔，擷取主標題前半段"""
    s = clean_jp_title(title)
    parts = re.split(r"[\s\-－—:：～〜~、,]", s)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2 and len(parts[0]) >= 3:
        return parts[0]
    return ""


def http_json(url: str, data=None, headers=None, timeout=18):
    req_headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        url,
        data=payload,
        headers=req_headers,
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ==================== 1. AniList 季度整批抓取 ====================
def fetch_anilist_season_index() -> list:
    """抓取 2025 與 2026 四季所有動畫，建立本地標題→封面索引"""
    gql = """
    query ($page: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(season: $season, seasonYear: $seasonYear, type: ANIME) {
          title { native romaji english }
          synonyms
          coverImage { large medium }
        }
      }
    }
    """
    records = []
    for year in (2025, 2026):
        for part, season_enum in SEASON_MAP.items():
            page = 1
            while page <= 4:
                try:
                    res = http_json(
                        ANILIST_URL,
                        data={"query": gql, "variables": {"page": page, "season": season_enum, "seasonYear": year}},
                        headers={"Content-Type": "application/json"},
                    )
                    page_data = (res.get("data") or {}).get("Page") or {}
                    media_list = page_data.get("media") or []
                    for m in media_list:
                        cover = (m.get("coverImage") or {}).get("large") or (m.get("coverImage") or {}).get("medium") or ""
                        if not cover:
                            continue
                        titles = []
                        t = m.get("title") or {}
                        for k in ("native", "romaji", "english"):
                            if t.get(k):
                                titles.append(t[k])
                        for syn in (m.get("synonyms") or []):
                            if syn:
                                titles.append(syn)
                        norm_titles = [normalize_key(x) for x in titles if normalize_key(x)]
                        records.append({"year": year, "season": f"{year}-{part}", "norms": norm_titles, "cover": cover})
                    if not (page_data.get("pageInfo") or {}).get("hasNextPage"):
                        break
                    page += 1
                    time.sleep(0.75)
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        wait_s = min(int(e.headers.get("Retry-After", "60")) + 2, 70)
                        print(f"[AniList Season 429] 等待 {wait_s} 秒...")
                        time.sleep(wait_s)
                        continue
                    break
                except Exception:
                    break
    print(f"已從 AniList 季度索引載入 {len(records)} 筆動畫封面資料。")
    return records


def match_from_season_index(anime: dict, index_records: list) -> str:
    raw_jp = anime.get("titleJp") or ""
    cleaned_jp = clean_jp_title(raw_jp)
    targets = [normalize_key(raw_jp), normalize_key(cleaned_jp)]
    targets = [t for t in dict.fromkeys(targets) if len(t) >= 3]
    if not targets:
        return ""

    # 先比對同季，再放寬至全部索引
    ordered = [r for r in index_records if r["season"] == anime.get("season")] + [
        r for r in index_records if r["season"] != anime.get("season")
    ]
    for r in ordered:
        for t in targets:
            for nt in r["norms"]:
                if t == nt or (len(t) >= 5 and (t in nt or nt in t)):
                    return r["cover"]
    return ""


# ==================== 2. AniList 單筆搜尋 ====================
def fetch_anilist(query_text: str) -> str:
    gql = """
    query ($search: String) {
      Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        coverImage { large medium }
      }
    }
    """
    try:
        res = http_json(
            ANILIST_URL,
            data={"query": gql, "variables": {"search": query_text}},
            headers={"Content-Type": "application/json"},
        )
        media = (res.get("data") or {}).get("Media") or {}
        cover = media.get("coverImage") or {}
        return cover.get("large") or cover.get("medium") or ""
    except urllib.error.HTTPError as e:
        if e.code == 429:
            wait_s = min(int(e.headers.get("Retry-After", "60")) + 2, 70)
            print(f"[AniList 429] 等待 {wait_s} 秒...")
            time.sleep(wait_s)
            return fetch_anilist(query_text)
        return ""
    except Exception:
        return ""


# ==================== 3. Jikan (MyAnimeList) 搜尋 ====================
def fetch_jikan(query_text: str) -> str:
    qs = urllib.parse.urlencode({"q": query_text, "limit": 3})
    try:
        res = http_json(f"{JIKAN_URL}?{qs}")
        items = res.get("data") or []
        for item in items:
            images = (item.get("images") or {}).get("jpg") or {}
            url = images.get("large_image_url") or images.get("image_url") or ""
            if url:
                return url
        return ""
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(3)
            return fetch_jikan(query_text)
        return ""
    except Exception:
        return ""


# ==================== 4. Bangumi.tv 搜尋（中／日文高命中備援） ====================
def fetch_bangumi(query_text: str) -> str:
    encoded = urllib.parse.quote(query_text, safe="")
    url = f"{BGM_SEARCH_URL}{encoded}?type=2&responseGroup=small&max_results=5"
    try:
        res = http_json(url)
        items = res.get("list") or []
        for item in items:
            images = item.get("images") or {}
            img = images.get("large") or images.get("common") or images.get("medium") or ""
            if img:
                if img.startswith("http://"):
                    img = "https://" + img[len("http://"):]
                return img
        return ""
    except Exception:
        return ""


def resolve_cover(anime: dict, season_index: list) -> str:
    # 1. 先從季度整批索引比對（0 API 請求）
    url = match_from_season_index(anime, season_index)
    if url:
        return url

    raw_jp = (anime.get("titleJp") or "").strip()
    cleaned_jp = clean_jp_title(raw_jp)
    seg_jp = first_segment(raw_jp)
    raw_zh = (anime.get("titleZh") or "").strip()
    cleaned_zh = clean_jp_title(raw_zh)

    jp_candidates = [c for c in dict.fromkeys([raw_jp, cleaned_jp, seg_jp]) if len(c) >= 2]
    all_candidates = [c for c in dict.fromkeys([raw_jp, cleaned_jp, raw_zh, cleaned_zh, seg_jp]) if len(c) >= 2]

    # 2. AniList 單筆搜尋
    for q in jp_candidates:
        url = fetch_anilist(q)
        time.sleep(0.85)
        if url:
            return url

    # 3. Jikan (MyAnimeList) 搜尋
    for q in jp_candidates:
        url = fetch_jikan(q)
        time.sleep(0.6)
        if url:
            return url

    # 4. Bangumi.tv 搜尋（支援日文與中文）
    for q in all_candidates:
        url = fetch_bangumi(q)
        time.sleep(0.45)
        if url:
            return url

    return ""


def process_file(filepath: str, season_index: list) -> tuple:
    if not os.path.exists(filepath):
        return 0, []
    with open(filepath, "r", encoding="utf-8") as f:
        items = json.load(f)

    updated = 0
    missed = []
    total = len(items)
    for idx, item in enumerate(items, 1):
        if item.get("coverUrl"):
            continue
        url = resolve_cover(item, season_index)
        if url:
            item["coverUrl"] = url
            updated += 1
            print(f"[{filepath} {idx}/{total}] OK: {item.get('titleZh')} -> {url}")
        else:
            missed.append(f"{item.get('id')} {item.get('titleZh')} ({item.get('titleJp')})")
            print(f"[{filepath} {idx}/{total}] MISS: {item.get('titleZh')}")
        if idx % 20 == 0 and updated > 0:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)

    if updated > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"完成 {filepath}：本次補齊 {updated} 張，仍缺 {len(missed)} 張")
    return updated, missed


if __name__ == "__main__":
    season_index = fetch_anilist_season_index()
    total_updated = 0
    all_missed = []
    for fn in DATA_FILES:
        u, m = process_file(fn, season_index)
        total_updated += u
        all_missed.extend(m)
    print(f"\n=== 全部完成：本次補齊 {total_updated} 張，剩餘未命中 {len(all_missed)} 張 ===")
    if all_missed:
        print("仍未命中的作品清單：")
        for line in all_missed:
            print(" -", line)