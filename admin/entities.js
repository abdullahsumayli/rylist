export const ENTITIES = [
  { key:"projects", label:"العقارات", table:"projects", order:"sort_order", title:"i18n.title", fields:[
    {n:"code",t:"text",l:"الكود",req:true},
    {n:"city_key",t:"select",l:"المدينة",options:"taxonomy:city"},
    {n:"type_key",t:"select",l:"النوع",options:"taxonomy:property_type"},
    {n:"status",t:"select",l:"الحالة",options:["available","reserved","sold","soon"]},
    {n:"sold",t:"number",l:"نسبة البيع"},
    {n:"price_min",t:"number",l:"سعر من"},{n:"price_max",t:"number",l:"سعر إلى"},
    {n:"area",t:"text",l:"المساحة"},{n:"beds_min",t:"number",l:"غرف من"},{n:"beds_max",t:"number",l:"غرف إلى"},
    {n:"featured",t:"bool",l:"مميّز"},{n:"sort_order",t:"number",l:"الترتيب"},
    {n:"image_url",t:"image",l:"الصورة"},
    {n:"brochure_url",t:"file",l:"البروشور (PDF)"},
    {n:"i18n.title",t:"i18n-text",l:"العنوان"},{n:"i18n.district",t:"i18n-text",l:"الحي"},
    {n:"i18n.description",t:"i18n-rich",l:"الوصف"} ]},
  { key:"news", label:"الأخبار/المدونة", table:"news", order:"published_at", title:"i18n.title", fields:[
    {n:"slug",t:"text",l:"المعرّف slug",req:true},
    {n:"status",t:"select",l:"الحالة",options:["draft","published"]},
    {n:"published_at",t:"text",l:"تاريخ النشر (ISO)"},
    {n:"image_url",t:"image",l:"الصورة"},
    {n:"i18n.title",t:"i18n-text",l:"العنوان"},{n:"i18n.excerpt",t:"i18n-text",l:"المقتطف"},
    {n:"i18n.body",t:"i18n-rich",l:"النص"} ]},
  { key:"partners", label:"الشركاء", table:"partners", order:"sort_order", title:"i18n.name", fields:[
    {n:"logo_url",t:"image",l:"الشعار",hint:"SVG (مفضّل) أو PNG بخلفية شفافة · شعار عرضي ~240×120px · أقصى حجم 200KB",spec:{maxKB:200,maxW:600,maxH:400,recW:240,recH:120}},{n:"sort_order",t:"number",l:"الترتيب"},
    {n:"i18n.name",t:"i18n-text",l:"الاسم"} ]},
  { key:"stats", label:"الأرقام", table:"stats", order:"sort_order", title:"i18n.label", fields:[
    {n:"value",t:"number",l:"القيمة",req:true},{n:"suffix",t:"text",l:"اللاحقة"},
    {n:"sort_order",t:"number",l:"الترتيب"},{n:"i18n.label",t:"i18n-text",l:"العنوان"} ]},
  { key:"social_links", label:"السوشيال", table:"social_links", order:"sort_order", title:"platform", fields:[
    {n:"platform",t:"select",l:"المنصّة",options:["instagram","x","tiktok","snapchat","linkedin","youtube","facebook"]},
    {n:"url",t:"text",l:"الرابط",req:true},{n:"enabled",t:"bool",l:"مفعّل"},{n:"sort_order",t:"number",l:"الترتيب"} ]},
  { key:"contact", label:"التواصل", table:"contact", order:"id", single:true, title:"email", fields:[
    {n:"whatsapp",t:"text",l:"واتساب (دولي بلا +)"},{n:"email",t:"text",l:"البريد"},{n:"phone",t:"text",l:"الهاتف"},
    {n:"map_url",t:"text",l:"رابط الخريطة"},
    {n:"i18n.address",t:"i18n-text",l:"العنوان"},{n:"i18n.hours",t:"i18n-text",l:"ساعات العمل"} ]},
  { key:"pages", label:"الصفحات", table:"pages", order:"key", pk:"key", title:"key", fields:[
    {n:"i18n.title",t:"i18n-text",l:"العنوان"},{n:"i18n.body",t:"i18n-rich",l:"النص"} ]},
];
