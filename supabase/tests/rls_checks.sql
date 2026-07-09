-- rls_checks.sql — يتحقّق أن الزائر (anon) يضيف طلبًا فقط، ولا يقرأ المحتوى
do $$
declare cnt int;
begin
  -- محاكاة دور الزائر
  set local role anon;

  -- (١) الزائر يقدر يضيف طلبًا
  insert into public.leads (name, phone, source) values ('rls-test','000','form');

  -- (٢) الزائر لا يقرأ العقارات (RLS يرجّع صفر صفوف)
  select count(*) into cnt from public.projects;
  if cnt <> 0 then
    raise exception 'FAIL: anon can read projects (expected 0, got %)', cnt;
  end if;

  -- (٣) الزائر لا يقرأ الطلبات
  select count(*) into cnt from public.leads;
  if cnt <> 0 then
    raise exception 'FAIL: anon can read leads (expected 0, got %)', cnt;
  end if;

  reset role;
  raise notice 'PASS: anon insert-only behavior holds';
end $$;
