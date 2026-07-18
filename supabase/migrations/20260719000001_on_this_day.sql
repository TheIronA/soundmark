-- Soundmark: "on this day" lookup
--
-- The home screen resurfaces moments recorded on today's calendar day in a
-- previous year. Doing that in the client meant fetching every entry older
-- than the current year and filtering month/day in JS -- the result set grew
-- with the whole archive even though the answer is only ever a handful of
-- rows. This moves the filter into Postgres.
--
-- Timezone: "today" is the *viewer's* calendar day, not UTC's. recorded_at is
-- timestamptz, so it is converted into a caller-supplied IANA timezone before
-- month/day are extracted. The caller passes its own zone.

create or replace function public.entries_on_this_day(
  p_month int,
  p_day   int,
  p_tz    text default 'UTC'
)
returns setof public.entries
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.entries
  where recorded_at < date_trunc('year', (now() at time zone p_tz))
    and extract(month from (recorded_at at time zone p_tz)) = p_month
    and extract(day   from (recorded_at at time zone p_tz)) = p_day
  order by recorded_at asc;
$$;

-- security invoker + the entries RLS policies mean this only ever returns the
-- caller's own rows; no extra scoping is needed here.
revoke all on function public.entries_on_this_day(int, int, text) from public;
grant execute on function public.entries_on_this_day(int, int, text) to authenticated;

-- Supports the year-bound half of the predicate. The month/day extraction is
-- timezone-dependent (and therefore not immutable), so it can't be indexed
-- directly; this keeps the scan limited to the owner's pre-current-year rows,
-- which is the part that grows.
create index if not exists entries_user_recorded_asc_idx
  on public.entries (user_id, recorded_at asc);
