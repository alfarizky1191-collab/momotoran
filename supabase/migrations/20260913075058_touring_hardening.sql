-- Longer invitations; existing invitations expire with this rollout.
alter table public.touring_groups alter column invite_code set default upper(encode(gen_random_bytes(8), 'hex'));
alter table public.touring_groups add column invite_expires_at timestamptz not null default now() + interval '7 days';
update public.touring_groups set invite_code=upper(encode(gen_random_bytes(8), 'hex'));
create table private.join_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table private.join_attempts enable row level security;
revoke all on private.join_attempts from public, anon, authenticated;
drop function public.join_touring_group(text);
create function public.join_touring_group(code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.touring_groups; tries integer;
begin
  if auth.uid() is null then return jsonb_build_object('error','Login diperlukan.'); end if;
  insert into private.join_attempts(user_id,attempts) values(auth.uid(),1)
  on conflict(user_id) do update set
    attempts=case when join_attempts.window_start < now()-interval '15 minutes' then 1 else join_attempts.attempts+1 end,
    window_start=case when join_attempts.window_start < now()-interval '15 minutes' then now() else join_attempts.window_start end
  returning attempts into tries;
  -- Return errors rather than raise: failed guesses must commit their counters.
  if tries > 5 then return jsonb_build_object('error','Terlalu banyak percobaan. Tunggu 15 menit.'); end if;
  select * into g from public.touring_groups where invite_code=upper(trim(code))
    and invite_expires_at>now() and status<>'finished';
  if g.id is null then return jsonb_build_object('error','Kode tidak valid atau kedaluwarsa.'); end if;
  insert into public.group_members(group_id,user_id) values(g.id,auth.uid()) on conflict do nothing;
  return jsonb_build_object('group',to_jsonb(g));
end $$;
revoke all on function public.join_touring_group(text) from public,anon;
grant execute on function public.join_touring_group(text) to authenticated;

alter table public.live_locations add column expires_at timestamptz not null default now()+interval '2 minutes';
create function private.stamp_location() returns trigger language plpgsql set search_path='' as $$
begin
  new.expires_at := now()+interval '2 minutes';
  if new.updated_at < now()-interval '2 minutes' or new.updated_at > now()+interval '30 seconds' then
    raise exception 'Location timestamp is stale or invalid';
  end if;
  return new;
end $$;
revoke all on function private.stamp_location() from public,anon,authenticated;
create trigger stamp_location before insert or update on public.live_locations
for each row execute function private.stamp_location();
alter policy "members read group locations" on public.live_locations using (
  private.is_group_member(group_id) and (user_id=(select auth.uid()) or expires_at>now())
);
-- Own expired rows remain selectable so an UPSERT can renew them.
create extension if not exists pg_cron;
select cron.schedule('momotoran-expired-locations','* * * * *',
  'delete from public.live_locations where expires_at < now()');

create function public.manage_touring_group(target_group uuid, action text, member_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select owner_id into owner from public.touring_groups where id=target_group for update;
  if action='leave' and member_id=auth.uid() and owner<>auth.uid() then
    delete from public.group_members where group_id=target_group and user_id=auth.uid();
  elsif owner=auth.uid() and action='remove' and member_id<>owner then
    delete from public.group_members where group_id=target_group and user_id=member_id;
    update public.touring_groups set invite_code=upper(encode(extensions.gen_random_bytes(8),'hex')) where id=target_group;
  elsif owner=auth.uid() and action='finish' then
    update public.touring_groups set status='finished',invite_expires_at=now() where id=target_group;
    delete from public.live_locations where group_id=target_group;
  elsif owner=auth.uid() and action='invite' then
    update public.touring_groups set invite_code=upper(encode(extensions.gen_random_bytes(8),'hex')),
      invite_expires_at=now()+interval '7 days' where id=target_group and status<>'finished';
  else raise exception 'Action not permitted'; end if;
end $$;
revoke all on function public.manage_touring_group(uuid,text,uuid) from public,anon;
grant execute on function public.manage_touring_group(uuid,text,uuid) to authenticated;
-- No new positions once the leader ends the tour.
create policy "only open tours accept positions" on public.live_locations as restrictive
for all to authenticated using (true) with check (
  exists(select 1 from public.touring_groups g where g.id=group_id and g.status<>'finished')
);
