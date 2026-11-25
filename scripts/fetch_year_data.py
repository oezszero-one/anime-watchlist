#!/usr/bin/env python3
"""
ANIME LOG. 歷史年份新番自動抓取腳本 (支援 2008–2024 任意年份)
從 AniList 季度 API 抓取指定年份的四季 TV/TV_SHORT/ONA 動畫（含日文名、英文名、封面、類型與 R18 標註），
再透過 Bangumi.tv 補齊繁體中文譯名，輸出 data-YYYY.json 並自動更新 years-manifest.json。
"""

import argparse
import datetime
import glob
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ANILIST_URL = "https://graphql.anilist.co"
BGM_SEARCH_URL = "https://api.bgm.tv/search/subject/"
USER_AGENT = "AnimeLogYearFetcher/1.2 (+https://oezszero-one.github.io/)"

SEASONS = [
    ("winter", "WINTER"),
    ("spring", "SPRING"),
    ("summer", "SUMMER"),
    ("fall", "FALL"),
]

GENRE_MAP = {
    "Action": "戰鬥",
    "Adventure": "冒險",
    "Comedy": "喜劇",
    "Drama": "劇情",
    "Ecchi": "喜劇",
    "Fantasy": "奇幻",
    "Hentai": "R18",
    "Horror": "恐怖",
    "Mahou Shoujo": "魔法少女",
    "Mecha": "機甲",
    "Music": "音樂",
    "Mystery": "懸疑",
    "Psychological": "心理",
    "Romance": "戀愛",
    "Sci-Fi": "科幻",
    "Slice of Life": "日常",
    "Sports": "運動",
    "Supernatural": "超自然",
    "Thriller": "懸疑",
}

WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def http_json(url: str, data=None, headers=None, timeout=20):
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


def fetch_zh_name_from_bangumi(title_jp: str) -> str:
    if not title_jp:
        return ""
    encoded = urllib.parse.quote(title_jp, safe="")
    url = f"{BGM_SEARCH_URL}{encoded}?type=2&responseGroup=small&max_results=3"
    try:
        res = http_json(url, timeout=12)
        items = res.get("list") or []
        for item in items:
            cn = (item.get("name_cn") or "").strip()
            if cn:
                return cn
    except Exception:
        pass
    return ""


def get_weekday_from_start_date(sd: dict, fmt: str) -> tuple:
    if fmt == "ONA":
        return "一次上架", "串流"
    y, m, d = sd.get("year"), sd.get("month"), sd.get("day")
    if y and m and d:
        try:
            dt = datetime.date(int(y), int(m), int(d))
            return WEEKDAY_NAMES[dt.weekday()], f"{m}/{d}"
        except Exception:
            pass
    return "星期一", ""


def fetch_season_from_anilist(year: int, part: str, season_enum: str, with_zh: bool) -> list:
    gql = """
    query ($page: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        media(season: $season, seasonYear: $seasonYear, type: ANIME, format_in: [TV, TV_SHORT, ONA], sort: POPULARITY_DESC) {
          id
          format
          isAdult
          title { native romaji english }
          startDate { year month day }
          genres
          tags { name }
          coverImage { large medium }
          siteUrl
        }
      }
    }
    """
    collected = []
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
                t = m.get("title") or {}
                title_jp = (t.get("native") or t.get("romaji") or "").strip()
                title_en = (t.get("english") or t.get("romaji") or title_jp).strip()
                if not title_jp:
                    continue

                genres = []
                for g in (m.get("genres") or []):
                    mapped = GENRE_MAP.get(g)
                    if mapped and mapped not in genres:
                        genres.append(mapped)
                tag_names = {tg.get("name") for tg in (m.get("tags") or []) if tg.get("name")}
                if "Isekai" in tag_names and "異世界" not in genres:
                    genres.append("異世界")
                if "School" in tag_names and "校園" not in genres:
                    genres.append("校園")
                if "Historical" in tag_names and "歷史" not in genres:
                    genres.append("歷史")
                if "Work" in tag_names and "職場" not in genres:
                    genres.append("職場")
                if m.get("format") == "TV_SHORT" and "短篇" not in genres:
                    genres.append("短篇")
                if m.get("isAdult") and "R18" not in genres:
                    genres.append("R18")
                if not genres:
                    genres = ["劇情"]

                wd, wd_note = get_weekday_from_start_date(m.get("startDate") or {}, m.get("format") or "TV")
                cover = (m.get("coverImage") or {}).get("large") or (m.get("coverImage") or {}).get("medium") or ""

                title_zh = title_jp
                if with_zh:
                    cn = fetch_zh_name_from_bangumi(title_jp)
                    if cn:
                        title_zh = cn
                    time.sleep(0.25)

                collected.append({
                    "id": f"{year}-{part}-{len(collected)+1:03d}",
                    "year": year,
                    "season": f"{year}-{part}",
                    "titleZh": title_zh,
                    "titleJp": title_jp,
                    "titleEn": title_en,
                    "weekday": wd,
                    "weekdayNote": wd_note,
                    "genres": genres,
                    "coverUrl": cover,
                    "sourceUrl": m.get("siteUrl") or "https://anilist.co/",
                })

            if not (page_data.get("pageInfo") or {}).get("hasNextPage"):
                break
            page += 1
            time.sleep(0.8)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait_s = min(int(e.headers.get("Retry-After", "60")) + 2, 70)
                print(f"[AniList 429] 等待 {wait_s} 秒...")
                time.sleep(wait_s)
                continue
            print(f"HTTP error on {year} {part}: {e}")
            break
        except Exception as e:
            print(f"Error on {year} {part}: {e}")
            break
    return collected


def rebuild_manifest():
    files = sorted(glob.glob("data-*.json"), reverse=True)
    years_info = []
    for f in files:
        m = re.match(r"data-(\d{4})\.json$", os.path.basename(f))
        if not m:
            continue
        yr = int(m.group(1))
        with open(f, "r", encoding="utf-8") as fp:
            arr = json.load(fp)
        years_info.append({"year": yr, "file": os.path.basename(f), "count": len(arr)})
    manifest = {
        "schemaVersion": 2,
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "years": years_info,
    }
    with open("years-manifest.json", "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)
    print(f"已更新 years-manifest.json（共 {len(years_info)} 個年份）")


def main():
    parser = argparse.ArgumentParser(description="抓取指定年份範圍的日本新番清單")
    parser.add_argument("--start-year", type=int, required=True)
    parser.add_argument("--end-year", type=int, required=True)
    parser.add_argument("--overwrite", action="store_true", help="是否覆蓋已存在的年份檔")
    parser.add_argument("--no-zh", action="store_true", help="跳過 Bangumi 中文譯名查詢以加快速度")
    args = parser.parse_args()

    lo = min(args.start_year, args.end_year)
    hi = max(args.start_year, args.end_year)
    for year in range(hi, lo - 1, -1):
        out_file = f"data-{year}.json"
        if os.path.exists(out_file) and not args.overwrite:
            print(f"略過已存在的 {out_file}（若需重抓請勾選覆蓋）")
            continue
        year_items = []
        for part, season_enum in SEASONS:
            print(f"正在抓取 {year} {part}...")
            season_items = fetch_season_from_anilist(year, part, season_enum, with_zh=not args.no_zh)
            print(f"  -> {year} {part} 取得 {len(season_items)} 部")
            year_items.extend(season_items)
        with open(out_file, "w", encoding="utf-8") as fp:
            json.dump(year_items, fp, ensure_ascii=False, indent=2)
        print(f"已儲存 {out_file}（共 {len(year_items)} 部）")

    rebuild_manifest()


if __name__ == "__main__":
    main()
