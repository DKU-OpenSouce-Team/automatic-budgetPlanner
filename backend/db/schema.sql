-- Bill-Gets Supabase(Postgres) 스키마
-- 적용: Supabase 대시보드 > SQL Editor 에 붙여넣어 실행.
-- 백엔드 코드(app/api/routes/*, app/models/schemas.py)가 기대하는 테이블 정의.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- 사용자
create table if not exists users (
    id              uuid primary key default gen_random_uuid(),
    email           text not null unique,
    hashed_password text not null,
    created_at      timestamptz not null default now()
);

-- 지출 내역
create table if not exists transactions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users (id) on delete cascade,
    store      text not null,
    amount     integer not null,
    spent_at   date not null,
    category   text,
    note       text,
    items      jsonb not null default '[]'::jsonb,
    cid        text,
    bid        text,
    created_at timestamptz not null default now()
);

-- 목록/통계 조회는 user_id + 날짜 기준 → 복합 인덱스
create index if not exists idx_transactions_user_spent
    on transactions (user_id, spent_at desc);

-- 나만의 파일 (선택한 지출 내역 묶음)
create table if not exists user_files (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references users (id) on delete cascade,
    name            text not null,
    description     text,
    transaction_ids uuid[] not null default '{}',
    created_at      timestamptz not null default now()
);

create index if not exists idx_user_files_user_created
    on user_files (user_id, created_at desc);
