-- ============================================
-- BudgetApp V2 — Schéma Supabase complet
-- À exécuter dans Supabase > SQL Editor
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

-- Profils (extension de auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

-- Workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Membres des workspaces
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (workspace_id, user_id)
);

-- Mois budgétaires
create table public.months (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  month_key text not null,
  label text not null,
  income numeric(12,2) not null default 0,
  courses_budget numeric(12,2) not null default 0,
  courses_weekly_budget numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, month_key)
);

-- Enveloppes
create table public.envelopes (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months(id) on delete cascade,
  slug text not null,
  name text not null,
  budget numeric(12,2) not null default 0,
  icon text not null default '📌',
  color text,
  is_system boolean not null default false,
  position integer not null default 0,
  due_day integer check (due_day between 1 and 31),
  is_paid boolean not null default false
);

-- Catégories (par workspace)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  unique (workspace_id, name)
);

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  envelope_slug text not null,
  category_id uuid references public.categories(id) on delete set null,
  label text not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null default current_date,
  notes text,
  is_private boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Dépenses prédictives
create table public.planned_expenses (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months(id) on delete cascade,
  label text not null,
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  is_recurring boolean not null default false,
  recurrence_rule text,
  position integer not null default 0
);

-- Objectifs d'épargne
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0,
  target_date date,
  icon text not null default '🎯',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- INDEX
-- ─────────────────────────────────────────────

create index idx_months_workspace on public.months(workspace_id);
create index idx_months_key on public.months(workspace_id, month_key);
create index idx_envelopes_month on public.envelopes(month_id);
create index idx_transactions_month on public.transactions(month_id);
create index idx_transactions_workspace on public.transactions(workspace_id);
create index idx_transactions_date on public.transactions(date);
create index idx_planned_month on public.planned_expenses(month_id);
create index idx_notifications_user on public.notifications(user_id, is_read);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.months enable row level security;
alter table public.envelopes enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.planned_expenses enable row level security;
alter table public.goals enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Helper : est-ce que l'utilisateur est membre du workspace ?
create or replace function public.is_workspace_member(p_workspace_id uuid, p_role text default null)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and (p_role is null or role = p_role or role = 'owner')
  )
$$;

-- Profiles
create policy "Lecture profil personnel" on public.profiles
  for select using (id = auth.uid());
create policy "Modification profil personnel" on public.profiles
  for update using (id = auth.uid());

-- Workspaces
create policy "Lecture workspace membre" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "Création workspace" on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy "Modification workspace owner" on public.workspaces
  for update using (owner_id = auth.uid());
create policy "Suppression workspace owner" on public.workspaces
  for delete using (owner_id = auth.uid());

-- Workspace members
create policy "Lecture membres" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "Ajout membres par owner" on public.workspace_members
  for insert with check (public.is_workspace_member(workspace_id, 'owner'));
create policy "Suppression membres par owner" on public.workspace_members
  for delete using (public.is_workspace_member(workspace_id, 'owner'));

-- Months
create policy "Lecture mois membre" on public.months
  for select using (public.is_workspace_member(workspace_id));
create policy "Création mois éditeur" on public.months
  for insert with check (public.is_workspace_member(workspace_id, 'editor'));
create policy "Modification mois éditeur" on public.months
  for update using (public.is_workspace_member(workspace_id, 'editor'));

-- Envelopes (via month → workspace)
create policy "Lecture enveloppes" on public.envelopes
  for select using (
    exists (select 1 from public.months m where m.id = month_id and public.is_workspace_member(m.workspace_id))
  );
create policy "CRUD enveloppes éditeur" on public.envelopes
  for all using (
    exists (select 1 from public.months m where m.id = month_id and public.is_workspace_member(m.workspace_id, 'editor'))
  );

-- Categories
create policy "Lecture catégories" on public.categories
  for select using (public.is_workspace_member(workspace_id));
create policy "CRUD catégories éditeur" on public.categories
  for all using (public.is_workspace_member(workspace_id, 'editor'));

-- Transactions
create policy "Lecture transactions" on public.transactions
  for select using (
    public.is_workspace_member(workspace_id)
    and (not is_private or created_by = auth.uid())
  );
create policy "Création transactions éditeur" on public.transactions
  for insert with check (
    public.is_workspace_member(workspace_id, 'editor')
    and created_by = auth.uid()
  );
create policy "Modification transactions auteur" on public.transactions
  for update using (created_by = auth.uid());
create policy "Suppression transactions auteur" on public.transactions
  for delete using (created_by = auth.uid());

-- Planned expenses (via month)
create policy "Lecture prédictif" on public.planned_expenses
  for select using (
    exists (select 1 from public.months m where m.id = month_id and public.is_workspace_member(m.workspace_id))
  );
create policy "CRUD prédictif éditeur" on public.planned_expenses
  for all using (
    exists (select 1 from public.months m where m.id = month_id and public.is_workspace_member(m.workspace_id, 'editor'))
  );

-- Goals
create policy "Lecture objectifs" on public.goals
  for select using (public.is_workspace_member(workspace_id));
create policy "CRUD objectifs éditeur" on public.goals
  for all using (public.is_workspace_member(workspace_id, 'editor'));

-- Notifications
create policy "Lecture notifs personnelles" on public.notifications
  for select using (user_id = auth.uid());
create policy "Modification notifs personnelles" on public.notifications
  for update using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  -- Créer le workspace personnel par défaut
  with new_ws as (
    insert into public.workspaces (name, owner_id)
    values ('Mon budget', new.id)
    returning id
  )
  insert into public.workspace_members (workspace_id, user_id, role)
  select id, new.id, 'owner' from new_ws;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- CATÉGORIES PAR DÉFAUT (après création workspace)
-- ─────────────────────────────────────────────

create or replace function public.seed_default_categories(p_workspace_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.categories (workspace_id, name, icon) values
    (p_workspace_id, 'Courses',  '🛒'),
    (p_workspace_id, 'Sortie',   '🎉'),
    (p_workspace_id, 'Resto',    '🍽️'),
    (p_workspace_id, 'Essence',  '⛽'),
    (p_workspace_id, 'Achat',    '🛍️'),
    (p_workspace_id, 'Santé',    '💊'),
    (p_workspace_id, 'Cadeau',   '🎁'),
    (p_workspace_id, 'Plaisir',  '✨'),
    (p_workspace_id, 'Autre',    '📦')
  on conflict (workspace_id, name) do nothing;
end;
$$;
