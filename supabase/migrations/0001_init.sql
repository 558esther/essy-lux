-- ============================================================
-- ESSY-LUX Admin Dashboard — Database Schema
-- Run this once in Supabase → SQL Editor → New Query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (admin users, linked to Supabase Auth)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- COLLECTIONS
-- ============================================================
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  category_id uuid references public.categories(id) on delete set null,
  sku text unique,
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  colors jsonb not null default '[]'::jsonb,
  sizes text[] not null default '{}',
  material text,
  status text not null default 'draft' check (status in ('draft','published','out_of_stock','archived')),
  featured boolean not null default false,
  new_arrival boolean not null default false,
  best_seller boolean not null default false,
  available_for_sale boolean not null default true,
  low_stock_threshold int not null default 3,
  seo_title text,
  seo_description text,
  seo_keywords text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  is_main boolean not null default false,
  color_tag text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images(product_id);

-- ============================================================
-- PRODUCT <-> COLLECTIONS (many-to-many)
-- ============================================================
create table if not exists public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

-- ============================================================
-- HOMEPAGE CONTENT (key/value store, one row per editable section)
-- ============================================================
create table if not exists public.homepage_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- MEDIA LIBRARY
-- ============================================================
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  file_name text not null,
  file_type text not null,
  usage_context text,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- SETTINGS (singleton row)
-- ============================================================
create table if not exists public.settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'ESSY-LUX',
  tagline text not null default 'LUXURY BAGS',
  phone text not null default '0113835508',
  whatsapp_number text not null default '254113835508',
  location text not null default 'Mombasa – Bamburi, Kenya',
  currency text not null default 'KES',
  whatsapp_greeting text not null default 'Hello Essy-Lux,',
  whatsapp_closing text not null default 'Thank you for choosing ESSY-LUX.',
  order_message_template text not null default E'*ESSY-LUX — ORDER REQUEST*
━━━━━━━━━━━━━━━━━━━━

Hello Essy-Lux,
I would like to place an order:

*Product:* {{productName}}
*Color:* {{color}}
*Quantity:* {{quantity}}
*Price:* {{price}}

*TOTAL: {{total}}*
━━━━━━━━━━━━━━━━━━━━

*Customer details*
Name: {{customerName}}
Phone: {{customerPhone}}
Location: {{location}}
Note: {{note}}

Please confirm availability, delivery and payment details.

Thank you for choosing ESSY-LUX.
*ESSY-LUX* | LUXURY BAGS',
  low_stock_threshold int not null default 3,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  location text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORDER REQUESTS (created when a customer taps "Order via WhatsApp")
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  location text,
  note text,
  total numeric(12,2) not null default 0,
  status text not null default 'new' check (status in ('new','confirmed','processing','ready_for_delivery','delivered','cancelled')),
  whatsapp_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  color text,
  quantity int not null default 1 check (quantity > 0),
  price numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

create index if not exists order_items_order_idx on public.order_items(order_id);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.categories;
create trigger set_updated_at before update on public.categories for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.collections;
create trigger set_updated_at before update on public.collections for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.settings;
create trigger set_updated_at before update on public.settings for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at before update on public.orders for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_collections enable row level security;
alter table public.homepage_content enable row level security;
alter table public.media enable row level security;
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.activity_log enable row level security;

-- Profiles: an admin can read/update only their own profile
create policy "profiles_self_select" on public.profiles for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles for update using (id = auth.uid());

-- Categories: public can read active ones; admin has full access
create policy "categories_public_select" on public.categories for select using (active = true or public.is_admin());
create policy "categories_admin_insert" on public.categories for insert with check (public.is_admin());
create policy "categories_admin_update" on public.categories for update using (public.is_admin());
create policy "categories_admin_delete" on public.categories for delete using (public.is_admin());

-- Collections
create policy "collections_public_select" on public.collections for select using (active = true or public.is_admin());
create policy "collections_admin_insert" on public.collections for insert with check (public.is_admin());
create policy "collections_admin_update" on public.collections for update using (public.is_admin());
create policy "collections_admin_delete" on public.collections for delete using (public.is_admin());

-- Products: public can read published; admin has full access
create policy "products_public_select" on public.products for select using (status = 'published' or public.is_admin());
create policy "products_admin_insert" on public.products for insert with check (public.is_admin());
create policy "products_admin_update" on public.products for update using (public.is_admin());
create policy "products_admin_delete" on public.products for delete using (public.is_admin());

-- Product images: readable whenever the parent product is readable
create policy "product_images_select" on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or public.is_admin()))
);
create policy "product_images_admin_insert" on public.product_images for insert with check (public.is_admin());
create policy "product_images_admin_update" on public.product_images for update using (public.is_admin());
create policy "product_images_admin_delete" on public.product_images for delete using (public.is_admin());

-- Product <-> collections
create policy "product_collections_select" on public.product_collections for select using (true);
create policy "product_collections_admin_insert" on public.product_collections for insert with check (public.is_admin());
create policy "product_collections_admin_delete" on public.product_collections for delete using (public.is_admin());

-- Homepage content: public read (storefront renders it), admin write
create policy "homepage_public_select" on public.homepage_content for select using (true);
create policy "homepage_admin_insert" on public.homepage_content for insert with check (public.is_admin());
create policy "homepage_admin_update" on public.homepage_content for update using (public.is_admin());
create policy "homepage_admin_delete" on public.homepage_content for delete using (public.is_admin());

-- Media library: admin only
create policy "media_admin_select" on public.media for select using (public.is_admin());
create policy "media_admin_insert" on public.media for insert with check (public.is_admin());
create policy "media_admin_delete" on public.media for delete using (public.is_admin());

-- Settings: public read (storefront needs the WhatsApp number/currency), admin write
create policy "settings_public_select" on public.settings for select using (true);
create policy "settings_admin_update" on public.settings for update using (public.is_admin());

-- Customers: admin can read/manage; order flow may create a record
create policy "customers_admin_select" on public.customers for select using (public.is_admin());
create policy "customers_public_insert" on public.customers for insert with check (true);
create policy "customers_admin_update" on public.customers for update using (public.is_admin());
create policy "customers_admin_delete" on public.customers for delete using (public.is_admin());

-- Orders: public can create an order REQUEST; only admin can view/manage
create policy "orders_admin_select" on public.orders for select using (public.is_admin());
create policy "orders_public_insert" on public.orders for insert with check (true);
create policy "orders_admin_update" on public.orders for update using (public.is_admin());
create policy "orders_admin_delete" on public.orders for delete using (public.is_admin());

create policy "order_items_admin_select" on public.order_items for select using (public.is_admin());
create policy "order_items_public_insert" on public.order_items for insert with check (true);
create policy "order_items_admin_delete" on public.order_items for delete using (public.is_admin());

-- Activity log: admin only
create policy "activity_admin_select" on public.activity_log for select using (public.is_admin());
create policy "activity_admin_insert" on public.activity_log for insert with check (public.is_admin());

-- ============================================================
-- STORAGE BUCKET for product photos, homepage images, media library
-- ============================================================
insert into storage.buckets (id, name, public)
values ('essy-lux-media', 'essy-lux-media', true)
on conflict (id) do nothing;

create policy "essy_lux_media_public_read"
on storage.objects for select
using (bucket_id = 'essy-lux-media');

create policy "essy_lux_media_admin_insert"
on storage.objects for insert
with check (bucket_id = 'essy-lux-media' and public.is_admin());

create policy "essy_lux_media_admin_update"
on storage.objects for update
using (bucket_id = 'essy-lux-media' and public.is_admin());

create policy "essy_lux_media_admin_delete"
on storage.objects for delete
using (bucket_id = 'essy-lux-media' and public.is_admin());
