-- ANIME LOG. v2.0 Supabase 資料表與權限 (RLS) 初始化腳本
-- 請於 Supabase Dashboard -> SQL Editor 貼上並執行

-- 1. 使用者追番狀態表（僅存已標記：watched / liked / disliked）
create table if not exists public.user_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id text not null,
  status text not null check (status in ('watched', 'liked', 'disliked')),
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

alter table public.user_watchlist enable row level security;

create policy "使用者僅能讀寫自己的追番紀錄"
  on public.user_watchlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. 使用者公開分享設定表
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text default '動漫同好',
  is_public boolean not null default true,
  hide_r18_public boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "任何人可讀取公開分享設定"
  on public.user_profiles for select
  using (is_public = true or auth.uid() = user_id);

create policy "使用者僅能修改自己的分享設定"
  on public.user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 允許讀取公開分享者的觀看清單（若 hide_r18_public 為 true 由前端/視圖過濾）
create policy "允許讀取已開啟公開分享的追番清單"
  on public.user_watchlist for select
  using (
    exists (
      select 1 from public.user_profiles p
      where p.user_id = user_watchlist.user_id and p.is_public = true
    )
  );

-- 3. 推坑互動表 (+1 推坑)
create table if not exists public.anime_recommendations (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

alter table public.anime_recommendations enable row level security;

create policy "任何人可讀取推坑紀錄"
  on public.anime_recommendations for select
  using (true);

create policy "登入用戶可新增或取消自己的推坑"
  on public.anime_recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. 缺番／許願／異常回報區
create table if not exists public.issue_reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('missing_anime', 'broken_cover', 'data_error', 'wish')),
  anime_title text default '',
  description text not null check (char_length(description) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.issue_reports enable row level security;

create policy "登入用戶可提交回報"
  on public.issue_reports for insert
  with check (auth.uid() = user_id);

create policy "用戶可查看自己的回報"
  on public.issue_reports for select
  using (auth.uid() = user_id);

-- 5. 網站訪問人次計數器
create table if not exists public.site_metrics (
  key text primary key,
  value bigint not null default 0
);

insert into public.site_metrics (key, value) values ('total_visits', 0)
on conflict (key) do nothing;

alter table public.site_metrics enable row level security;

create policy "任何人可讀取網站統計數字"
  on public.site_metrics for select
  using (true);

create or replace function public.increment_visit_count()
returns bigint
language plpgsql
security definer
as $$
declare
  new_val bigint;
begin
  update public.site_metrics
  set value = value + 1
  where key = 'total_visits'
  returning value into new_val;
  return coalesce(new_val, 0);
end;
$$;
