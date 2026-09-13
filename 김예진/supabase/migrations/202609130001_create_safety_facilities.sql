create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.facility_datasets (
  id text primary key,
  facility_type text not null check (facility_type in ('cctv', 'security_light')),
  name text not null,
  provider text not null,
  source_url text not null,
  coordinate_system text not null check (coordinate_system = 'EPSG:4326'),
  source_record_count integer not null check (source_record_count >= 0),
  selected_record_count integer not null check (selected_record_count >= 0),
  source_updated_at timestamptz,
  collected_at timestamptz not null,
  source_sha256 text check (
    source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create table if not exists public.safety_facilities (
  id text primary key,
  facility_type text not null check (facility_type in ('cctv', 'security_light')),
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text,
  purpose text,
  managing_agency text,
  source_dataset_id text not null references public.facility_datasets(id),
  source_record_id text,
  source_updated_at timestamptz,
  collected_at timestamptz not null,
  location extensions.geography(POINT, 4326) generated always as (
    extensions.st_setsrid(
      extensions.st_makepoint(longitude, latitude),
      4326
    )::extensions.geography
  ) stored
);

create index if not exists safety_facilities_location_gix
  on public.safety_facilities using gist (location);
create index if not exists safety_facilities_type_idx
  on public.safety_facilities (facility_type);

alter table public.facility_datasets enable row level security;
alter table public.safety_facilities enable row level security;

drop policy if exists "public read facility datasets" on public.facility_datasets;
create policy "public read facility datasets"
  on public.facility_datasets for select
  to anon, authenticated
  using (true);

drop policy if exists "public read safety facilities" on public.safety_facilities;
create policy "public read safety facilities"
  on public.safety_facilities for select
  to anon, authenticated
  using (true);

grant select on table public.facility_datasets, public.safety_facilities
  to anon, authenticated;

create or replace function public.nearby_safety_facilities(
  query_latitude double precision,
  query_longitude double precision,
  radius_meters double precision default 100,
  facility_types text[] default array['cctv', 'security_light']::text[]
)
returns table (
  id text,
  facility_type text,
  name text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision
)
set search_path = ''
language sql
stable
as $$
  select
    facility.id,
    facility.facility_type,
    facility.name,
    facility.latitude,
    facility.longitude,
    extensions.st_distance(
      facility.location,
      extensions.st_setsrid(
        extensions.st_makepoint(query_longitude, query_latitude),
        4326
      )::extensions.geography
    ) as distance_meters
  from public.safety_facilities as facility
  where facility.facility_type = any(facility_types)
    and extensions.st_dwithin(
      facility.location,
      extensions.st_setsrid(
        extensions.st_makepoint(query_longitude, query_latitude),
        4326
      )::extensions.geography,
      greatest(0, radius_meters)
    )
  order by distance_meters asc;
$$;

grant execute on function public.nearby_safety_facilities(
  double precision,
  double precision,
  double precision,
  text[]
) to anon, authenticated;
