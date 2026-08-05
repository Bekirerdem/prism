-- Activity integrity guardrails (2026-08-05 audit, finding D1).
--
-- `activity` is anon INSERT-only with `with check (true)` and, since 0003, publicly
-- readable. It is also the evidence backbone this project cites for user traction.
-- Nothing verified that a row described anything real: any holder of the bundled
-- publishable key could POST straight to PostgREST with an invented wallet, an
-- invented hash and a backdated timestamp, and it would render on the public feed
-- and broadcast live to every open tab. (Checked at the time of writing: 100 rows,
-- 18 wallets, zero malformed addresses, zero malformed or repeated hashes - the
-- door was open, nobody had walked through it.)
--
-- ⚠️ This does NOT make the table trustworthy. Only a server-side write path that
-- checks tx_hash against the ledger can do that, and that remains the real fix; a
-- determined forger can still mint well-formed addresses and 64-hex strings. What
-- this removes is the cheap forgery and the kind that cannot be told apart after the
-- fact: the client can no longer choose when a row happened, one transaction can
-- appear once, and obvious garbage is refused at the door.

-- created_at is server time, always. A trigger rather than a default, because a
-- default only applies when the column is omitted - a crafted insert can still
-- supply its own value, which is what makes backdating possible.
create or replace function public.activity_force_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists activity_created_at on public.activity;
create trigger activity_created_at
  before insert on public.activity
  for each row execute function public.activity_force_created_at();

-- One on-chain transaction, one row. Partial index: policy-rejected actions
-- legitimately carry no hash, and several NULLs must stay allowed.
create unique index if not exists activity_tx_hash_unique
  on public.activity (tx_hash)
  where tx_hash is not null;

-- Shape. Stellar StrKey is 'G' (account) or 'C' (contract) plus 55 base32 chars;
-- Soroban transaction hashes are 64 lowercase hex. Added NOT VALID and validated
-- immediately below - the existing rows were confirmed clean first, so this is a
-- deliberate two-step rather than an unchecked assumption.
alter table public.activity
  add constraint activity_wallet_strkey
  check (wallet_address ~ '^[GC][A-Z2-7]{55}$') not valid;
alter table public.activity
  add constraint activity_treasury_strkey
  check (treasury_id is null or treasury_id ~ '^C[A-Z2-7]{55}$') not valid;
alter table public.activity
  add constraint activity_txhash_hex
  check (tx_hash is null or tx_hash ~ '^[0-9a-f]{64}$') not valid;

alter table public.activity validate constraint activity_wallet_strkey;
alter table public.activity validate constraint activity_treasury_strkey;
alter table public.activity validate constraint activity_txhash_hex;
