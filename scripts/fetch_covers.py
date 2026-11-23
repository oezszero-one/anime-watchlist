#!/usr/bin/env python3
"""
ANIME LOG. 封面網址自動補齊腳本
從 AniList GraphQL API（主來源）與 Jikan / MyAnimeList API（備援來源）
批量抓取 data-2025.json 與 data-2026.json 中尚未填寫 coverUrl 的作品封面網址並寫回檔案。
"""

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

DATA_FILES = ["data-2025.json", "data-2026.json"]
ANILIST_URL = "https://graphql.anilist.co"
JIKAN_URL = "https://api.jikan.moe/v4/anime"
USER_AGENT = "AnimeLogCoverFetcher/1.1 (+https://oezszero-one.github.io/)"


def clean_jp_title(title: str) -> str:
    """移除常見續季與副標字樣，提高 API 搜尋命中率"""
    s = title or ""
    s = re.sub(r"[～〜~].*?[～〜~]", " ", s)
    s = re.sub(r"[（(].*?[）)]", " ", s)
    s = re.sub(
        r"(第\d+期|第\d+クール|Season\s*\d+|2nd\s*Season|3rd\s*Season|4th\s*Season|FINAL\s*SEASON|Part\s*\d+|後編|前編|前半|後半|最終章)",
        " ",
        s,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", s).strip()


def fetch_anilist(query_text: str) -> str:
    gql = """
    query ($search: String) {
      Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        coverImage {
          large
          medium
        }
      }
    }
    """
    payload = json.dumps({"query": gql, "variables": {"search": query_text}}).encode("utf-8")
    req = urllib.request.Request(
        ANILIST_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            media = (data.get("data") or {}).get("Media") or {}
            cover = media.get("coverImage") or {}
            return cover.get("large") or cover.get("medium") or ""
    except urllib.error.HTTPError as e:
        if e.code == 429:
            retry_after = int(e.headers.get("Retry-After", "60"))
            print(f"[AniList 429] 觸發限流，等待 {retry_after} 秒...")
            time.sleep(min(retry_after + 2, 70))
            return fetch_anilist(query_text)
        return ""
    except Exception:
        return ""


def fetch_jikan(query_text: str) -> str:
    qs = urllib.parse.urlencode({"q": query_text, "limit": 1})
    req = urllib.request.Request(
        f"{JIKAN_URL}?{qs}",
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data.get("data") or []
            if not items:
                return ""
            images = items[0].get("images") or {}
            jpg = images.get("jpg") or {}
            return jpg.get("large_image_url") or jpg.get("image_url") or ""
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(3)
        return ""
    except Exception:
        return ""


def resolve_cover(anime: dict) -> str:
    raw_jp = (anime.get("titleJp") or "").strip()
    cleaned_jp = clean_jp_title(raw_jp)
    candidates = []
    for c in (raw_jp, cleaned_jp):
        if c and c not in candidates:
            candidates.append(c)

    for q in candidates:
        url = fetch_anilist(q)
        time.sleep(0.85)
        if url:
            return url

    for q in candidates:
        url = fetch_jikan(q)
        time.sleep(0.55)
        if url:
            return url

    return ""


def process_file(filepath: str) -> int:
    if not os.path.exists(filepath):
        return 0
    with open(filepath, "r", encoding="utf-8") as f:
        items = json.load(f)

    updated = 0
    total = len(items)
    for idx, item in enumerate(items, 1):
        if item.get("coverUrl"):
            continue
        url = resolve_cover(item)
        if url:
            item["coverUrl"] = url
            updated += 1
            print(f"[{filepath} {idx}/{total}] OK: {item.get('titleZh')} -> {url}")
        else:
            print(f"[{filepath} {idx}/{total}] MISS: {item.get('titleZh')}")
        # 每 25 筆存檔一次，避免中途失敗白跑
        if idx % 25 == 0 and updated > 0:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)

    if updated > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"完成 {filepath}：本次共補齊 {updated} 張封面")
    return updated


if __name__ == "__main__":
    total_updated = 0
    for fn in DATA_FILES:
        total_updated += process_file(fn)
    print(f"全部完成，總計寫入 {total_updated} 張封面網址。")
