/* ==========================================================================
   RYLIST — مصدر البيانات الوحيد (Single source of data)
   عدّل هنا: بيانات التواصل، المشاريع، الإحصائيات، الشركاء، الأخبار.
   ========================================================================== */

/* ----- بيانات التواصل (استبدل الـplaceholders قبل الإطلاق) --------------- */
const CONTACT = {
  whatsapp: "9665XXXXXXXX",              // رقم واتساب بصيغة دولية بلا + (مثال 966500000000)
  email: "hello@rylist.sa",
  phone: "+966 11 000 0000",
  addressAr: "الرياض، المملكة العربية السعودية",
  addressEn: "Riyadh, Saudi Arabia",
  hoursAr: "الأحد – الخميس · ٩ص – ٦م",
  hoursEn: "Sun – Thu · 9am – 6pm",
  // إحداثيات الخريطة (مؤقتة: وسط الرياض) — استبدلها بموقع مكتبك
  map: "https://www.google.com/maps?q=24.7136,46.6753&output=embed"
};

const IMG = "https://images.unsplash.com/photo-";
const q = "?auto=format&fit=crop&w=900&q=70";

/* ----- المشاريع --------------------------------------------------------- */
const PROJECTS = [
  {
    id: 1, code: "RY-1042", featured: true,
    titleAr: "قمم الملقا", titleEn: "Malqa Peaks",
    cityKey: "riyadh", cityAr: "الرياض", cityEn: "Riyadh",
    districtAr: "الملقا", districtEn: "Al Malqa",
    type: "villa", typeAr: "فلل", typeEn: "Villas",
    status: "available", sold: 62,
    priceMin: 2400000, priceMax: 3900000,
    area: "320–520", bedsMin: 4, bedsMax: 6,
    img: IMG + "1512917774080-9991f1c4c750" + q
  },
  {
    id: 2, code: "RY-1043", featured: true,
    titleAr: "واجهة النرجس", titleEn: "Narjis Front",
    cityKey: "riyadh", cityAr: "الرياض", cityEn: "Riyadh",
    districtAr: "النرجس", districtEn: "Al Narjis",
    type: "apartment", typeAr: "شقق", typeEn: "Apartments",
    status: "available", sold: 47,
    priceMin: 900000, priceMax: 1600000,
    area: "120–210", bedsMin: 2, bedsMax: 4,
    img: IMG + "1545324418-cc1a3fa10c00" + q
  },
  {
    id: 3, code: "RY-1044", featured: true,
    titleAr: "أروقة حطين", titleEn: "Hittin Arcades",
    cityKey: "riyadh", cityAr: "الرياض", cityEn: "Riyadh",
    districtAr: "حطين", districtEn: "Hittin",
    type: "townhouse", typeAr: "تاون هاوس", typeEn: "Townhouses",
    status: "available", sold: 78,
    priceMin: 1800000, priceMax: 2600000,
    area: "240–300", bedsMin: 3, bedsMax: 5,
    img: IMG + "1600585154340-be6161a56a0c" + q
  },
  {
    id: 4, code: "RY-1039",
    titleAr: "مروج العارض", titleEn: "Arid Meadows",
    cityKey: "riyadh", cityAr: "الرياض", cityEn: "Riyadh",
    districtAr: "العارض", districtEn: "Al Arid",
    type: "villa", typeAr: "فلل", typeEn: "Villas",
    status: "sold", sold: 100,
    priceMin: 2100000, priceMax: 3200000,
    area: "300–460", bedsMin: 4, bedsMax: 6,
    img: IMG + "1600596542815-ffad4c1539a9" + q
  },
  {
    id: 5, code: "RY-1051", featured: true,
    titleAr: "رصيف أبحر", titleEn: "Obhur Quay",
    cityKey: "jeddah", cityAr: "جدة", cityEn: "Jeddah",
    districtAr: "أبحر الشمالية", districtEn: "North Obhur",
    type: "apartment", typeAr: "شقق", typeEn: "Apartments",
    status: "available", sold: 35,
    priceMin: 1100000, priceMax: 2400000,
    area: "140–260", bedsMin: 2, bedsMax: 4,
    img: IMG + "1494526585095-c41746248156" + q
  },
  {
    id: 6, code: "RY-1055", featured: true,
    titleAr: "شاطئ الشراع", titleEn: "Shira Beach",
    cityKey: "eastern", cityAr: "المنطقة الشرقية", cityEn: "Eastern Province",
    districtAr: "الخبر — العقربية", districtEn: "Khobar — Aqrabiyah",
    type: "offplan", typeAr: "على الخارطة", typeEn: "Off-plan",
    status: "available", sold: 29,
    priceMin: 1300000, priceMax: 2800000,
    area: "160–300", bedsMin: 3, bedsMax: 5,
    img: IMG + "1600607687939-ce8a6c25118c" + q
  },
  {
    id: 7, code: "RY-1060",
    titleAr: "أراضي القيروان", titleEn: "Qairawan Lands",
    cityKey: "riyadh", cityAr: "الرياض", cityEn: "Riyadh",
    districtAr: "القيروان", districtEn: "Al Qairawan",
    type: "land", typeAr: "أراضٍ", typeEn: "Lands",
    status: "available", sold: 54,
    priceMin: 600000, priceMax: 1900000,
    area: "375–900", bedsMin: 0, bedsMax: 0,
    img: IMG + "1500382017468-9049fed747ef" + q
  },
  {
    id: 8, code: "RY-1063",
    titleAr: "نُزُل المدينة", titleEn: "Madinah Rise",
    cityKey: "madinah", cityAr: "المدينة المنورة", cityEn: "Madinah",
    districtAr: "الرانوناء", districtEn: "Ar Ranuna",
    type: "apartment", typeAr: "شقق", typeEn: "Apartments",
    status: "available", sold: 41,
    priceMin: 800000, priceMax: 1500000,
    area: "110–190", bedsMin: 2, bedsMax: 3,
    img: IMG + "1522708323590-d24dbb6b0267" + q
  },
  {
    id: 9, code: "RY-1066", featured: true,
    titleAr: "أفق مكة", titleEn: "Makkah Horizon",
    cityKey: "makkah", cityAr: "مكة المكرمة", cityEn: "Makkah",
    districtAr: "العزيزية", districtEn: "Al Aziziyah",
    type: "offplan", typeAr: "على الخارطة", typeEn: "Off-plan",
    status: "available", sold: 66,
    priceMin: 1500000, priceMax: 3000000,
    area: "150–280", bedsMin: 3, bedsMax: 5,
    img: IMG + "1449844908441-8829872d2607" + q
  }
];

/* ----- الإحصائيات (أرقام تجريبية — استبدلها) ---------------------------- */
const STATS = [
  { value: 48,   decimals: 0, sym: "+", labelAr: "مشروعًا تحت التسويق", labelEn: "Projects marketed" },
  { value: 3.2,  decimals: 1, sym: "B", labelAr: "قيمة المبيعات — بالريال", labelEn: "Sales value — SAR" },
  { value: 6400, decimals: 0, sym: "+", labelAr: "وحدة مباعة", labelEn: "Units sold" },
  { value: 96,   decimals: 0, sym: "%", labelAr: "رضا العملاء", labelEn: "Client satisfaction" }
];

/* ----- شركاء النجاح (أسماء تجريبية) ------------------------------------- */
const PARTNERS = [
  { ar: "مِعمار", en: "Miamar" }, { ar: "بنيان", en: "Bunyan" },
  { ar: "رواسي", en: "Rawasi" }, { ar: "تُراث", en: "Turath" },
  { ar: "أصالة", en: "Asala" }, { ar: "مدى", en: "Mada" },
  { ar: "ركائز", en: "Rakaiz" }, { ar: "منارة", en: "Manarah" },
  { ar: "واحة", en: "Waha" }, { ar: "صروح", en: "Sroh" },
  { ar: "تكوين", en: "Takwin" }, { ar: "أوج", en: "Awj" }
];

/* ----- الأخبار / الرؤى --------------------------------------------------- */
const NEWS = [
  {
    catAr: "السوق", catEn: "Market", date: "2026-06-12",
    titleAr: "قراءة في أسعار شقق الرياض ٢٠٢٦", titleEn: "Reading Riyadh apartment prices, 2026",
    excerptAr: "ثلاثة عوامل تفسّر حركة الأسعار هذا العام، وما يعنيه ذلك لمن ينوي الشراء.",
    excerptEn: "Three factors explain this year’s price movement, and what it means before you buy.",
    img: IMG + "1486406146926-c627a92ad1ab" + q
  },
  {
    catAr: "البيع على الخارطة", catEn: "Off-plan", date: "2026-05-28",
    titleAr: "برنامج وافي: ماذا يعني لحماية المشتري؟", titleEn: "Wafi: what it means for buyer protection",
    excerptAr: "كيف يحفظ حساب الضمان أموالك حتى تسليم الوحدة، وما الذي يجب أن تسأل عنه.",
    excerptEn: "How the escrow account holds your money until handover, and what to ask about.",
    img: IMG + "1487958449943-2429e8be8625" + q
  },
  {
    catAr: "أحياء", catEn: "Neighborhoods", date: "2026-05-09",
    titleAr: "أحياء شمال الرياض: أين يتّجه الطلب؟", titleEn: "North Riyadh: where demand is heading",
    excerptAr: "مقارنة موجزة بين الملقا والنرجس والعارض من زاوية العائد ومعدّل الامتصاص.",
    excerptEn: "A brief comparison of Malqa, Narjis and Arid by yield and absorption.",
    img: IMG + "1512453979798-5ea266f8880c" + q
  },
  {
    catAr: "تمويل", catEn: "Financing", date: "2026-04-20",
    titleAr: "صناديق التطوير العقاري وأثرها على الأسعار", titleEn: "Development funds and their effect on prices",
    excerptAr: "لماذا يغيّر التمويل المؤسسي طريقة تسعير المشاريع الكبيرة على الخارطة.",
    excerptEn: "Why institutional financing changes how large off-plan projects are priced.",
    img: IMG + "1554469384-e58fac16e23a" + q
  },
  {
    catAr: "تحليل", catEn: "Analysis", date: "2026-04-02",
    titleAr: "ماذا يخبرك معدّل الامتصاص عن التسعير", titleEn: "What absorption tells you about pricing",
    excerptAr: "المؤشّر الذي نعتمد عليه قبل إطلاق أي حملة — وكيف تقرأه بنفسك.",
    excerptEn: "The metric we lean on before any launch — and how to read it yourself.",
    img: IMG + "1460317442991-0ec209397118" + q
  },
  {
    catAr: "دليل", catEn: "Guide", date: "2026-03-15",
    titleAr: "التاون هاوس في الرياض: لمن يناسب؟", titleEn: "Townhouses in Riyadh: who they suit",
    excerptAr: "خيار وسط بين الشقة والفيلا — نراجع التكلفة والمساحة ونمط الحياة.",
    excerptEn: "A middle ground between apartment and villa — cost, space and lifestyle.",
    img: IMG + "1580587771525-78b9dba3b914" + q
  }
];
