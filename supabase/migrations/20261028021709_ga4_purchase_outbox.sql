-- Service-only analytics state; no customer details or GA identifiers stored here.
create table public.ga4_purchase_outbox (
  order_id uuid primary key,
  intent_id text not null unique,
  paid_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending','processing','sending','submitted','skipped','rejected','uncertain')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token uuid,
  reason text,
  updated_at timestamptz not null default now()
);
alter table public.ga4_purchase_outbox enable row level security;
revoke all on public.ga4_purchase_outbox from public, anon, authenticated;
grant select, insert, update on public.ga4_purchase_outbox to service_role;
create index ga4_purchase_outbox_pending on public.ga4_purchase_outbox(available_at) where state in ('pending','processing','sending');

create function public.claim_ga4_purchase() returns setof public.ga4_purchase_outbox
language plpgsql security invoker set search_path = '' as $$
begin
  -- A crashed sender may have reached GA. Preserve uncertainty, never resend.
  update public.ga4_purchase_outbox set state = 'uncertain', reason = 'sender_lease_expired', updated_at = now()
    where state = 'sending' and lease_until < now();
  return query
  with candidate as (
    select order_id from public.ga4_purchase_outbox
    where (state = 'pending' and available_at <= now()) or (state = 'processing' and lease_until < now())
    order by available_at for update skip locked limit 1
  )
  update public.ga4_purchase_outbox q set state = 'processing', attempts = attempts + 1,
    claim_token = gen_random_uuid(), lease_until = now() + interval '2 minutes', updated_at = now()
  from candidate c where q.order_id = c.order_id returning q.*;
end;
$$;
revoke all on function public.claim_ga4_purchase() from public, anon, authenticated;
grant execute on function public.claim_ga4_purchase() to service_role;
