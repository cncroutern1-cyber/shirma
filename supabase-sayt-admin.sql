-- Supabase -> SQL Editor -> New query: butun matnni qo'yib "Run" bosing. (Bir marta)
-- Sayt mahsulotlarini admin (Ctrl+7) boshqarishi uchun jadval, rasmlar ombori va ruxsatlar.
--
-- OLDIN: Authentication -> Users -> Add user: email  admin@revo-sayt.uz , parolni o'zingiz belgilang,
-- "Auto Confirm User" ni yoqing. Parol sayt admin paroli bo'ladi. Telefon raqamingiz saytda yozilgan,
-- shuning uchun uni parol qilmang: undan boshqa, uzun parol qo'ying.

create table if not exists public.site_products (
  id uuid primary key default gen_random_uuid(),
  sort bigint not null default (extract(epoch from now()) * 1000)::bigint,
  name_uz text not null,
  name_ru text default '',
  name_en text default '',
  desc_uz text default '',
  desc_ru text default '',
  desc_en text default '',
  price numeric default 0,
  image_url text default '',
  created_at timestamptz default now()
);

create table if not exists public.site_admins (email text primary key);
insert into public.site_admins (email) values ('admin@revo-sayt.uz') on conflict do nothing;

create or replace function public.is_site_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where email = (auth.jwt() ->> 'email'))
$$;

alter table public.site_products enable row level security;
alter table public.site_admins enable row level security;

drop policy if exists "sp_read" on public.site_products;
drop policy if exists "sp_insert" on public.site_products;
drop policy if exists "sp_update" on public.site_products;
drop policy if exists "sp_delete" on public.site_products;
create policy "sp_read" on public.site_products for select to anon, authenticated using (true);
create policy "sp_insert" on public.site_products for insert to authenticated with check (public.is_site_admin());
create policy "sp_update" on public.site_products for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "sp_delete" on public.site_products for delete to authenticated using (public.is_site_admin());

-- Rasmlar ombori (hamma ko'ra oladi, faqat admin yuklaydi)
insert into storage.buckets (id, name, public, file_size_limit)
values ('site-products', 'site-products', true, 10485760)
on conflict (id) do update set public = true;

drop policy if exists "sp_obj_read" on storage.objects;
drop policy if exists "sp_obj_insert" on storage.objects;
drop policy if exists "sp_obj_update" on storage.objects;
drop policy if exists "sp_obj_delete" on storage.objects;
create policy "sp_obj_read" on storage.objects for select to anon, authenticated using (bucket_id = 'site-products');
create policy "sp_obj_insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-products' and public.is_site_admin());
create policy "sp_obj_update" on storage.objects for update to authenticated using (bucket_id = 'site-products' and public.is_site_admin());
create policy "sp_obj_delete" on storage.objects for delete to authenticated using (bucket_id = 'site-products' and public.is_site_admin());
