#!/usr/bin/env python3
"""
ANIME LOG. 封面網址與英文片名自動補齊腳本 (v1.3)
自動掃描根目錄所有 data-YYYY.json，補齊缺少的 coverUrl 與 titleEn：
1. AniList 季度整批索引比對（同時取 coverImage 與 english/romaji 英文名）
2. 強化標題清理 + AniList 單筆搜尋
3. Jikan (MyAnimeList) 公開 API 搜尋
4. Bangumi.tv 公開 API 搜尋（中／日文高命中備援）
"""

import glob
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ANILIST_URL = "https://graphql.anilist.co"
JIKAN_URL = "https://api.jikan.moe/v4/anime"
BGM_SEARCH_URL = "https://api.bgm.tv/search/subject/"
USER_AGENT = "AnimeLogCoverFetcher/1.3 (+https://oezszero-one.github.io/)"

SEASON_MAP = {
    "winter": "WINTER",
    "spring": "SPRING",
    "summer": "SUMMER",
    "fall": "FALL",
}


def normalize_key(text: str) -> str:
    s = unicodedata.normalize("NFKC", text or "").lower()
    s = re.sub(r"[\s\-_~～〜!！?？。、,.・:：;；「」『』()（）\[\]【】\"'♥★☆♪#]+", "", s)
    return s


def clean_jp_title(title: str) -> str:
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


def fetch_anilist_season_index(years: list) -> list:
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
    for year in years:
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
                        t = m.get("title") or {}
                        title_en = t.get("english") or t.get("romaji") or ""
                        titles = [t.get(k) for k in ("native", "romaji", "english") if t.get(k)]
                        titles.extend([s for s in (m.get("synonyms") or []) if s])
                        norm_titles = [normalize_key(x) for x in titles if normalize_key(x)]
                        records.append({
                            "year": year,
                            "season": f"{year}-{part}",
                            "norms": norm_titles,
                            "cover": cover,
                            "titleEn": title_en,
                        })
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
    print(f"已從 AniList 季度索引載入 {len(records)} 筆資料。")
    return records


def match_from_season_index(anime: dict, index_records: list) -> tuple:
    raw_jp = anime.get("titleJp") or ""
    cleaned_jp = clean_jp_title(raw_jp)
    targets = [t for t in dict.fromkeys([normalize_key(raw_jp), normalize_key(cleaned_jp)]) if len(t) >= 3]
    if not targets:
        return "", ""

    ordered = [r for r in index_records if r["season"] == anime.get("season")] + [
        r for r in index_records if r["season"] != anime.get("season")
    ]
    for r in ordered:
        for t in targets:
            for nt in r["norms"]:
                if t == nt or (len(t) >= 5 and (t in nt or nt in t)):
                    return r["cover"], r["titleEn"]
    return "", ""


def fetch_anilist(query_text: str) -> tuple:
    gql = """
    query ($search: String) {
      Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        title { english romaji }
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
        cover = (media.get("coverImage") or {}).get("large") or (media.get("coverImage") or {}).get("medium") or ""
        t = media.get("title") or {}
        title_en = t.get("english") or t.get("romaji") or ""
        return cover, title_en
    except urllib.error.HTTPError as e:
        if e.code == 429:
            wait_s = min(int(e.headers.get("Retry-After", "60")) + 2, 70)
            print(f"[AniList 429] 等待 {wait_s} 秒...")
            time.sleep(wait_s)
            return fetch_anilist(query_text)
        return "", ""
    except Exception:
        return "", ""


def fetch_jikan(query_text: str) -> tuple:
    qs = urllib.parse.urlencode({"q": query_text, "limit": 3})
    try:
        res = http_json(f"{JIKAN_URL}?{qs}")
        items = res.get("data") or []
        for item in items:
            images = (item.get("images") or {}).get("jpg") or {}
            url = images.get("large_image_url") or images.get("image_url") or ""
            title_en = item.get("title_english") or item.get("title") or ""
            if url or title_en:
                return url, title_en
        return "", ""
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(3)
            return fetch_jikan(query_text)
        return "", ""
    except Exception:
        return "", ""


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
                return "https://" + img[len("http://"):] if img.startswith("http://") else img
        return ""
    except Exception:
        return ""


def resolve_meta(anime: dict, season_index: list) -> tuple:
    need_cover = not anime.get("coverUrl")
    need_en = not anime.get("titleEn")

    found_cover = anime.get("coverUrl") or ""
    found_en = anime.get("titleEn") or ""

    c, en = match_from_season_index(anime, season_index)
    if need_cover and c:
        found_cover = c
    if need_en and en:
        found_en = en
    if found_cover and found_en:
        return found_cover, found_en

    raw_jp = (anime.get("titleJp") or "").strip()
    cleaned_jp = clean_jp_title(raw_jp)
    seg_jp = first_segment(raw_jp)
    raw_zh = (anime.get("titleZh") or "").strip()
    cleaned_zh = clean_jp_title(raw_zh)

    jp_candidates = [x for x in dict.fromkeys([raw_jp, cleaned_jp, seg_jp]) if len(x) >= 2]
    all_candidates = [x for x in dict.fromkeys([raw_jp, cleaned_jp, raw_zh, cleaned_zh, seg_jp]) if len(x) >= 2]

    for q in jp_candidates:
        c, en = fetch_anilist(q)
        time.sleep(0.85)
        if not found_cover and c:
            found_cover = c
        if not found_en and en:
            found_en = en
        if found_cover and found_en:
            return found_cover, found_en

    for q in jp_candidates:
        c, en = fetch_jikan(q)
        time.sleep(0.6)
        if not found_cover and c:
            found_cover = c
        if not found_en and en:
            found_en = en
        if found_cover and found_en:
            return found_cover, found_en

    if not found_cover:
        for q in all_candidates:
            c = fetch_bangumi(q)
            time.sleep(0.45)
            if c:
                found_cover = c
                break

    return found_cover, found_en


def process_file(filepath: str, season_index: list) -> tuple:
    with open(filepath, "r", encoding="utf-8") as f:
        items = json.load(f)

    updated = 0
    missed = []
    total = len(items)
    for idx, item in enumerate(items, 1):
        if item.get("coverUrl") and item.get("titleEn"):
            continue
        prev_c, prev_en = item.get("coverUrl") or "", item.get("titleEn") or ""
        new_c, new_en = resolve_meta(item, season_index)
        changed = False
        if new_c and new_c != prev_c:
            item["coverUrl"] = new_c
            changed = True
        if new_en and new_en != prev_en:
            item["titleEn"] = new_en
            changed = True
        if changed:
            updated += 1
            print(f"[{filepath} {idx}/{total}] OK: {item.get('titleZh')}")
        if not item.get("coverUrl"):
            missed.append(f"{item.get('id')} {item.get('titleZh')} ({item.get('titleJp')})")
        if idx % 20 == 0 and updated > 0:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)

    if updated > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"完成 {filepath}：更新 {updated} 筆，仍缺封面 {len(missed)} 筆")
    return updated, missed


if __name__ == "__main__":
    files = sorted(glob.glob("data-*.json"), reverse=True)
    years = []
    for f in files:
        m = re.match(r"data-(\d{4})\.json$", os.path.basename(f))
        if m:
            years.append(int(m.group(1)))
    season_index = fetch_anilist_season_index(years)
    total_updated = 0
    all_missed = []
    for fn in files:
        u, m = process_file(fn, season_index)
        total_updated += u
        all_missed.extend(m)
    print(f"\n=== 全部完成：更新 {total_updated} 筆，仍缺封面 {len(all_missed)} 筆 ===")
    if all_missed:
        for line in all_missed:
            print(" -", line)
