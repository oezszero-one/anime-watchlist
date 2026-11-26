#!/usr/bin/env python3
"""
ANIME LOG. v2.0 社群統計靜態快取產生器
每天由 GitHub Actions 定期從 Supabase 彙整每部作品的看過／喜歡／不喜歡／推坑數，
輸出為靜態 stats.json 放在 GitHub Pages，大幅節省 Supabase 出站流量。
"""

import datetime
import json
import os
import urllib.request


def fetch_table(base_url: str, service_key: str, table: str, select_cols: str) -> list:
    url = f"{base_url.rstrip('/')}/rest/v1/{table}?select={select_cols}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    base_url = os.environ.get("SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        print("尚未設定 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，略過統計更新。")
        return

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
    print(f"已更新 stats.json（涵蓋 {len(stats)} 部作品）")


if __name__ == "__main__":
    main()
