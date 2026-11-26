#!/usr/bin/env python3
"""
ANIME LOG. v2.0.1 社群統計靜態快取產生器
支援新版 Supabase Secret Key (sb_secret_...) 與舊版 Legacy JWT (eyJ...)。
"""

import datetime
import json
import os
import sys
import urllib.error
import urllib.request


def fetch_table(base_url: str, service_key: str, table: str, select_cols: str) -> list:
    url = f"{base_url.rstrip('/')}/rest/v1/{table}?select={select_cols}"
    headers = {
        "apikey": service_key,
        "Accept": "application/json",
        "User-Agent": "AnimeLogStatsBuilder/2.0",
    }
    # 舊版 JWT (eyJ...) 需要 Authorization Bearer；新版 sb_secret_ 僅需 apikey 標頭
    if service_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {service_key}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[HTTP {e.code}] 讀取資料表 {table} 失敗：{body}", file=sys.stderr)
        raise


def main():
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        print("尚未設定 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，略過統計更新。")
        return

    if not base_url.startswith("http"):
        print(f"[設定錯誤] SUPABASE_URL 格式不正確（應為 https://xxxx.supabase.co）：{base_url}", file=sys.stderr)
        sys.exit(1)

    watchlist_rows = fetch_table(base_url, service_key, "user_watchlist", "anime_id,status")
    rec_rows = fetch_table(base_url, service_key, "anime_recommendations", "anime_id")

    stats = {}
    for row in watchlist_rows:
        aid = row.get("anime_id")
        st = row.get("status")
        if not aid or not st:
            continue
        bucket = stats.setdefault(aid, {"watched": 0, "liked": 0, "disliked": 0, "push": 0})
        if st in ("watched", "liked", "disliked"):
            bucket[st] += 1

    for row in rec_rows:
        aid = row.get("anime_id")
        if not aid:
            continue
        bucket = stats.setdefault(aid, {"watched": 0, "liked": 0, "disliked": 0, "push": 0})
        bucket["push"] += 1

    output = {
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": stats,
    }
    with open("stats.json", "w", encoding="utf-8") as fp:
        json.dump(output, fp, ensure_ascii=False)
    print(f"已成功更新 stats.json（涵蓋 {len(stats)} 部作品）")


if __name__ == "__main__":
    main()
