-- 0007_seed.sql — بيانات أولية منقولة من assets/js/data.js

-- التصنيفات: المدن وأنواع العقار
insert into public.taxonomies (kind, key, i18n, sort_order) values
  ('city','riyadh',  '{"label":{"ar":"الرياض","en":"Riyadh","zh":""}}', 1),
  ('city','jeddah',  '{"label":{"ar":"جدة","en":"Jeddah","zh":""}}', 2),
  ('city','eastern', '{"label":{"ar":"المنطقة الشرقية","en":"Eastern Province","zh":""}}', 3),
  ('city','madinah', '{"label":{"ar":"المدينة المنورة","en":"Madinah","zh":""}}', 4),
  ('city','makkah',  '{"label":{"ar":"مكة المكرمة","en":"Makkah","zh":""}}', 5),
  ('property_type','villa',     '{"label":{"ar":"فلل","en":"Villas","zh":""}}', 1),
  ('property_type','apartment', '{"label":{"ar":"شقق","en":"Apartments","zh":""}}', 2),
  ('property_type','townhouse', '{"label":{"ar":"تاون هاوس","en":"Townhouses","zh":""}}', 3),
  ('property_type','offplan',   '{"label":{"ar":"على الخارطة","en":"Off-plan","zh":""}}', 4),
  ('property_type','land',      '{"label":{"ar":"أراضٍ","en":"Lands","zh":""}}', 5)
on conflict (kind, key) do nothing;

-- التواصل (من CONTACT في data.js) — استبدل الـplaceholders بالقيم الحقيقية قبل الإطلاق
insert into public.contact (id, whatsapp, email, phone, map_url, i18n) values (
  1,
  '9665XXXXXXXX',
  'hello@rylist.sa',
  '+966 11 000 0000',
  'https://www.google.com/maps?q=24.7136,46.6753&output=embed',
  '{"address":{"ar":"الرياض، المملكة العربية السعودية","en":"Riyadh, Saudi Arabia","zh":"沙特阿拉伯，利雅得"},"hours":{"ar":"الأحد – الخميس · ٩ص – ٦م","en":"Sun – Thu · 9am – 6pm","zh":"周日至周四 · 上午9点 - 下午6点"}}'
) on conflict (id) do nothing;

-- العقارات (من PROJECTS في data.js)
insert into public.projects
  (code, city_key, type_key, status, sold, price_min, price_max, area, beds_min, beds_max, featured, sort_order, image_url, i18n)
values
  ('RY-1042','riyadh','villa','available',62,2400000,3900000,'320–520',4,6,true,1,
   'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"قمم الملقا","en":"Malqa Peaks","zh":""},"district":{"ar":"الملقا","en":"Al Malqa","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1043','riyadh','apartment','available',47,900000,1600000,'120–210',2,4,true,2,
   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"واجهة النرجس","en":"Narjis Front","zh":""},"district":{"ar":"النرجس","en":"Al Narjis","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1044','riyadh','townhouse','available',78,1800000,2600000,'240–300',3,5,true,3,
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"أروقة حطين","en":"Hittin Arcades","zh":""},"district":{"ar":"حطين","en":"Hittin","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1039','riyadh','villa','sold',100,2100000,3200000,'300–460',4,6,false,4,
   'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"مروج العارض","en":"Arid Meadows","zh":""},"district":{"ar":"العارض","en":"Al Arid","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1051','jeddah','apartment','available',35,1100000,2400000,'140–260',2,4,true,5,
   'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"رصيف أبحر","en":"Obhur Quay","zh":""},"district":{"ar":"أبحر الشمالية","en":"North Obhur","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1055','eastern','offplan','available',29,1300000,2800000,'160–300',3,5,true,6,
   'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"شاطئ الشراع","en":"Shira Beach","zh":""},"district":{"ar":"الخبر — العقربية","en":"Khobar — Aqrabiyah","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1060','riyadh','land','available',54,600000,1900000,'375–900',0,0,false,7,
   'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"أراضي القيروان","en":"Qairawan Lands","zh":""},"district":{"ar":"القيروان","en":"Al Qairawan","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1063','madinah','apartment','available',41,800000,1500000,'110–190',2,3,false,8,
   'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"نُزُل المدينة","en":"Madinah Rise","zh":""},"district":{"ar":"الرانوناء","en":"Ar Ranuna","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1066','makkah','offplan','available',66,1500000,3000000,'150–280',3,5,true,9,
   'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"أفق مكة","en":"Makkah Horizon","zh":""},"district":{"ar":"العزيزية","en":"Al Aziziyah","zh":""},"description":{"ar":"","en":"","zh":""}}')
on conflict (code) do nothing;

-- الإحصائيات (من STATS في data.js)
insert into public.stats (value, suffix, sort_order, i18n) values
  (48,   '+', 1, '{"label":{"ar":"مشروعًا تحت التسويق","en":"Projects marketed","zh":""}}'),
  (3.2,  'B', 2, '{"label":{"ar":"قيمة المبيعات — بالريال","en":"Sales value — SAR","zh":""}}'),
  (6400, '+', 3, '{"label":{"ar":"وحدة مباعة","en":"Units sold","zh":""}}'),
  (96,   '%', 4, '{"label":{"ar":"رضا العملاء","en":"Client satisfaction","zh":""}}');

-- الشركاء (من PARTNERS في data.js)
insert into public.partners (logo_url, sort_order, i18n) values
  (null, 1,  '{"name":{"ar":"مِعمار","en":"Miamar","zh":""}}'),
  (null, 2,  '{"name":{"ar":"بنيان","en":"Bunyan","zh":""}}'),
  (null, 3,  '{"name":{"ar":"رواسي","en":"Rawasi","zh":""}}'),
  (null, 4,  '{"name":{"ar":"تُراث","en":"Turath","zh":""}}'),
  (null, 5,  '{"name":{"ar":"أصالة","en":"Asala","zh":""}}'),
  (null, 6,  '{"name":{"ar":"مدى","en":"Mada","zh":""}}'),
  (null, 7,  '{"name":{"ar":"ركائز","en":"Rakaiz","zh":""}}'),
  (null, 8,  '{"name":{"ar":"منارة","en":"Manarah","zh":""}}'),
  (null, 9,  '{"name":{"ar":"واحة","en":"Waha","zh":""}}'),
  (null, 10, '{"name":{"ar":"صروح","en":"Sroh","zh":""}}'),
  (null, 11, '{"name":{"ar":"تكوين","en":"Takwin","zh":""}}'),
  (null, 12, '{"name":{"ar":"أوج","en":"Awj","zh":""}}');

-- الأخبار/الرؤى (من NEWS في data.js)
insert into public.news (slug, image_url, status, published_at, i18n) values
  ('reading-riyadh-apartment-prices-2026',
   'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=70',
   'published', '2026-06-12',
   '{"title":{"ar":"قراءة في أسعار شقق الرياض ٢٠٢٦","en":"Reading Riyadh apartment prices, 2026","zh":""},"excerpt":{"ar":"ثلاثة عوامل تفسّر حركة الأسعار هذا العام، وما يعنيه ذلك لمن ينوي الشراء.","en":"Three factors explain this year’s price movement, and what it means before you buy.","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('wafi-what-it-means-for-buyer-protection',
   'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=900&q=70',
   'published', '2026-05-28',
   '{"title":{"ar":"برنامج وافي: ماذا يعني لحماية المشتري؟","en":"Wafi: what it means for buyer protection","zh":""},"excerpt":{"ar":"كيف يحفظ حساب الضمان أموالك حتى تسليم الوحدة، وما الذي يجب أن تسأل عنه.","en":"How the escrow account holds your money until handover, and what to ask about.","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('north-riyadh-where-demand-is-heading',
   'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=70',
   'published', '2026-05-09',
   '{"title":{"ar":"أحياء شمال الرياض: أين يتّجه الطلب؟","en":"North Riyadh: where demand is heading","zh":""},"excerpt":{"ar":"مقارنة موجزة بين الملقا والنرجس والعارض من زاوية العائد ومعدّل الامتصاص.","en":"A brief comparison of Malqa, Narjis and Arid by yield and absorption.","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('development-funds-and-their-effect-on-prices',
   'https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=900&q=70',
   'published', '2026-04-20',
   '{"title":{"ar":"صناديق التطوير العقاري وأثرها على الأسعار","en":"Development funds and their effect on prices","zh":""},"excerpt":{"ar":"لماذا يغيّر التمويل المؤسسي طريقة تسعير المشاريع الكبيرة على الخارطة.","en":"Why institutional financing changes how large off-plan projects are priced.","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('what-absorption-tells-you-about-pricing',
   'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=70',
   'published', '2026-04-02',
   '{"title":{"ar":"ماذا يخبرك معدّل الامتصاص عن التسعير","en":"What absorption tells you about pricing","zh":""},"excerpt":{"ar":"المؤشّر الذي نعتمد عليه قبل إطلاق أي حملة — وكيف تقرأه بنفسك.","en":"The metric we lean on before any launch — and how to read it yourself.","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('townhouses-in-riyadh-who-they-suit',
   'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=900&q=70',
   'published', '2026-03-15',
   '{"title":{"ar":"التاون هاوس في الرياض: لمن يناسب؟","en":"Townhouses in Riyadh: who they suit","zh":""},"excerpt":{"ar":"خيار وسط بين الشقة والفيلا — نراجع التكلفة والمساحة ونمط الحياة.","en":"A middle ground between apartment and villa — cost, space and lifestyle.","zh":""},"body":{"ar":"","en":"","zh":""}}')
on conflict (slug) do nothing;

-- الصفحات الثابتة (فارغة الآن، يملؤها الأدمن لاحقًا)
insert into public.pages (key, i18n) values
  ('about',    '{"title":{"ar":"من نحن","en":"About","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('services', '{"title":{"ar":"الخدمات","en":"Services","zh":""},"body":{"ar":"","en":"","zh":""}}')
on conflict (key) do nothing;
