create extension if not exists postgis;
create table reports (id uuid primary key default gen_random_uuid(), type text not null check(type in ('가로등 고장','공사 중','통행 불가','어두운 구간','시설물 파손','기타 보행 위험')), description text not null check(char_length(description)<=300), location geography(point,4326) not null, photo_path text, confidence smallint not null default 45 check(confidence between 0 and 100), verification_status text not null default '확인 필요', created_at timestamptz not null default now(), expires_at timestamptz not null, last_confirmed_at timestamptz);
create index reports_location_idx on reports using gist(location); create index reports_expires_idx on reports(expires_at);
alter table reports enable row level security;
-- MVP: authenticated users may create; client read is limited to unexpired, non-hidden reports through a view/RPC in production.
