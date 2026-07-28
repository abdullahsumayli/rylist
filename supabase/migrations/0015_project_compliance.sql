-- بيانات الإعلان العقاري الإلزامية لكل مشروع (لائحة التسويق والإعلانات العقارية،
-- الهيئة العامة للعقار — معتمدة 1 مايو 2026). كل عمود nullable بلا قيمة افتراضية:
-- NULL يعني «ما وصلنا الرقم بعد» ويُخفي سطره في صندوق الترخيص، ولا يُطبع بديلًا.
--
-- اسم المطوّر ليس هنا — يحتاج ثلاث لغات فيسكن projects.i18n.developer
-- على نمط i18n.title و i18n.district.

alter table public.projects add column if not exists ad_license text;        -- رقم ترخيص الإعلان (منصة الهيئة)
alter table public.projects add column if not exists sale_type text;         -- ready | offplan
alter table public.projects add column if not exists wafi_number text;       -- رقم تسجيل المشروع (وافي) — للبيع على الخارطة
alter table public.projects add column if not exists plan_number text;       -- رقم المخطط
alter table public.projects add column if not exists property_status text;   -- clear | mortgaged | disputed
alter table public.projects add column if not exists developer_license text; -- رقم ترخيص المطوّر

-- القيم المسموحة تُحرس في القاعدة لا في الواجهة فقط: تصنيف بيع خاطئ يغيّر
-- مسار الترخيص المنطبق على المشروع كله.
alter table public.projects drop constraint if exists projects_sale_type_check;
alter table public.projects add constraint projects_sale_type_check
  check (sale_type is null or sale_type in ('ready','offplan'));

alter table public.projects drop constraint if exists projects_property_status_check;
alter table public.projects add constraint projects_property_status_check
  check (property_status is null or property_status in ('clear','mortgaged','disputed'));
