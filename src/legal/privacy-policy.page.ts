/**
 * The privacy policy, served as a public page.
 *
 * Google Play requires a publicly reachable privacy policy URL for any app that
 * collects personal data, and this one collects a great deal of it — including
 * optional national ID numbers and people's own written accounts of their
 * circumstances. Before this, the app had a menu entry pointing at a CMS page
 * that did not exist in the CMS document: a link to a policy, and no policy.
 *
 * It lives in a TypeScript module rather than an .html file on purpose: `nest
 * build` does not copy stray assets into `dist/` unless told to, and a policy
 * that 404s in production because of a build-config detail is worse than none.
 *
 * ⚠️ Every fact about WHAT IS COLLECTED was taken from `schema.prisma` and the
 * form definitions, so it is accurate. Every POLICY CHOICE — retention periods,
 * the contact address, the registered name of the controller — is the
 * foundation's to make, and is marked `[[…]]` until they do. A policy that
 * promises something the foundation does not actually do is worse than no policy
 * at all, so those markers are deliberately visible rather than filled with
 * plausible defaults.
 */
export const PRIVACY_POLICY_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>سياسة الخصوصية — جمعية خواطر أحلى شباب</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
<style>
  :root{--ground:#FAF9F6;--surface:#fff;--ink:#14213A;--soft:#4A5468;--faint:#7A8497;
        --rule:#E4E1D9;--gold:#8A5B10;--goldlite:#F3E7CC;--crit:#93321F}
  @media (prefers-color-scheme:dark){:root{--ground:#12151C;--surface:#191D26;--ink:#ECEAE4;
        --soft:#AEB4C0;--faint:#7C8494;--rule:#2A303C;--gold:#D8A64A;--goldlite:#33291A;--crit:#E08B76}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);
       font-family:"Cairo","Segoe UI",sans-serif;font-size:16.5px;line-height:1.95}
  .wrap{max-width:44rem;margin:0 auto;padding:3rem 1.4rem 5rem}
  h1{font-size:1.9rem;font-weight:800;margin:0 0 .3rem;line-height:1.3}
  .sub{color:var(--soft);margin:0 0 2rem}
  h2{font-size:1.15rem;font-weight:700;margin:2.5rem 0 .3rem;
     padding-bottom:.45rem;border-bottom:1px solid var(--rule)}
  p,li{color:var(--soft)}
  p{margin:.8rem 0}
  strong,b{color:var(--ink);font-weight:700}
  ul{padding-inline-start:1.3rem;margin:.6rem 0}
  li{margin:.35rem 0}
  .box{background:var(--surface);border:1px solid var(--rule);padding:1rem 1.2rem;margin:1rem 0}
  .todo{background:var(--goldlite);color:var(--gold);border-inline-start:3px solid currentColor;
        padding:.85rem 1rem;margin:1rem 0;font-size:.93rem}
  .grave{border-inline-start:3px solid var(--crit);background:var(--surface);
         padding:.9rem 1.1rem;margin:1rem 0}
  .grave b{color:var(--crit)}
  a{color:var(--gold)}
  .lang{margin:1.5rem 0 0}
  .lang button{font:600 .8rem "Cairo",sans-serif;padding:.45rem .8rem;cursor:pointer;
    background:transparent;color:var(--soft);border:1px solid var(--rule);border-radius:2px}
  .lang button[aria-pressed="true"]{background:var(--ink);color:var(--ground);border-color:var(--ink)}
  footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid var(--rule);
         color:var(--faint);font-size:.85rem}
  [hidden]{display:none!important}
</style>
</head>
<body>
<div class="wrap">

<!-- ══════════════ ARABIC ══════════════ -->
<section data-ar>
  <h1>سياسة الخصوصية</h1>
  <p class="sub">تطبيق ولوحة «جمعية خواطر أحلى شباب» · آخر تحديث: أغسطس 2026</p>

  <div class="todo">
    <b>قبل النشر:</b> البنود المُعلَّمة بـ <code>[[…]]</code> قرارات تخصّ الجمعية — الاسم القانوني
    المسجَّل، بريد التواصل، ومُدد الاحتفاظ بالبيانات. سياسة تَعِد بما لا تفعله الجمعية أسوأ من عدم
    وجود سياسة أصلًا.
  </div>

  <h2>من نحن</h2>
  <p>
    <strong>[[الاسم القانوني المسجَّل للجمعية]]</strong>، ومقرها <strong>[[العنوان]]</strong>،
    هي الجهة المسؤولة عن البيانات الشخصية الموضّحة أدناه. للتواصل بشأن خصوصيتك:
    <strong>[[بريد التواصل]]</strong>.
  </p>

  <h2>ما الذي نجمعه، ومتى</h2>
  <p>لا نجمع أي بيانات لمجرد تصفّح التطبيق. تُجمع البيانات فقط عند قيامك بأحد الإجراءات التالية:</p>

  <div class="box">
    <p><b>عند إنشاء حساب أو تسجيل الدخول</b><br>
      البريد الإلكتروني (وهو وسيلة الدخول)، والاسم، ورقم الهاتف، والمحافظة.</p>

    <p><b>عند حجز موعد لخدمة</b><br>
      الاسم، ورقم الهاتف، والعمر، والنوع، والمحافظة، وملاحظاتك، و<b>الرقم القومي — وهو حقل اختياري
      تمامًا، وليس مطلوبًا لإتمام الحجز</b>.</p>

    <p><b>عند طلب استشارة</b><br>
      الاسم، والهاتف، ورقم واتساب، والبريد، والعمر، والمحافظة، ووسيلة التواصل والوقت المفضّلان،
      <b>ووصفك المكتوب بنفسك لحالتك أو ظروفك</b>.</p>

    <p><b>عند التبرع</b><br>
      اسم المتبرع، والمبلغ، ووسيلة التحويل.
      <b>لا نجمع أي بيانات بطاقات بنكية إطلاقًا</b> — لا توجد بوابة دفع داخل التطبيق، والتحويل يتم
      خارجه عبر البنك أو فوري أو فودافون كاش.</p>

    <p><b>عند التقدّم للتطوع أو مراسلتنا</b><br>
      الاسم، والهاتف، والعمر، والمحافظة، ومجالات الاهتمام والتوفّر، أو نص رسالتك.</p>

    <p><b>عند تفعيل الإشعارات</b><br>
      رمز الجهاز الخاص بخدمة الإشعارات، ونوع نظام التشغيل. هذا الرمز لا يحدّد هويتك.</p>

    <p><b>تلقائيًا — لأعمال الإدارة فقط</b><br>
      عند قيام أحد مسؤولي الجمعية بتعديل داخل لوحة التحكم، يُسجَّل عنوان الشبكة (IP) ونوع المتصفح
      مع هوية المسؤول. هذا السجل يخص <b>موظفي الجمعية</b>، لا المستخدمين.</p>
  </div>

  <div class="grave">
    <p><b>البيانات الحسّاسة.</b> الرقم القومي ووصف حالتك في طلب الاستشارة هما أكثر ما نحمله حساسية.
      الرقم القومي اختياري ويمكنك ترك الحقل فارغًا. ولا يُعرض الرقم القومي في أي واجهة عامة، ولا
      يُعاد عند الاستعلام عن الحجز برقمه المرجعي.</p>
  </div>

  <h2>لماذا نجمعها</h2>
  <ul>
    <li>تنفيذ ما طلبته: حجز موعد، أو ترتيب استشارة، أو تسجيل تبرع، أو الردّ على رسالتك.</li>
    <li>التواصل معك بخصوص طلبك تحديدًا.</li>
    <li>إصدار إيصال للتبرع وإتاحة الاطّلاع عليه.</li>
    <li>إرسال إشعارات عن حالة طلباتك — ويمكنك إيقافها من إعدادات التطبيق.</li>
    <li>الإحصاءات الداخلية للجمعية، ودائمًا بصورة مجمّعة لا تحدّد هوية أحد.</li>
  </ul>

  <h2>ما لا نفعله</h2>
  <ul>
    <li><b>لا نبيع بياناتك، ولا نشاركها لأغراض تسويقية أو إعلانية.</b></li>
    <li>لا نستخدم إعلانات داخل التطبيق، ولا أدوات تتبّع إعلانية.</li>
    <li>لا نجمع موقعك الجغرافي، ولا جهات اتصالك، ولا صورك، ولا محتوى جهازك.</li>
    <li>لا نحتفظ بأي بيانات بطاقات بنكية، لعدم وجود بوابة دفع أصلًا.</li>
  </ul>

  <h2>من يطّلع عليها</h2>
  <p>الاطّلاع مقصور على مسؤولي الجمعية المخوّلين، كلٌّ بحسب صلاحياته، ومع تسجيل كل <b>تعديل</b> باسم من
    أجراه. وتفاصيل طلب الاستشارة — بما فيها وصفك لحالتك — يطّلع عليها حاليًا الفريق المخوّل بمتابعة
    الطلبات، وليست مقصورة على مستشار بعينه. وتُعالَج البيانات لدى مزوّدي الخدمات التاليين فقط:</p>
  <ul>
    <li><b>مزوّد الاستضافة</b> — تخزين قاعدة البيانات والخوادم.</li>
    <li><b>Google (Firebase)</b> — إرسال الإشعارات إلى جهازك فقط.</li>
    <li><b>Cloudflare</b> — حماية الموقع وتسريعه.</li>
    <li><b>[[مزوّد البريد الإلكتروني]]</b> — إرسال رموز الدخول.</li>
  </ul>
  <p>ولا نُفصح عن بياناتك لأي جهة أخرى إلا إذا فرض ذلك التزام قانوني.</p>

  <h2>مدة الاحتفاظ</h2>
  <p>[[تحدّد الجمعية المدة — مقترح: الحجوزات وطلبات الاستشارة لمدة سنتين من آخر تحديث، وسجلات
    التبرعات للمدة التي تفرضها المتطلبات المحاسبية، وحسابات المستخدمين حتى طلب الحذف]].</p>

  <h2>حقوقك</h2>
  <p>يحقّ لك في أي وقت أن تطلب: <b>الاطّلاع</b> على بياناتك، أو <b>تصحيحها</b>، أو
    <b>حذف حسابك وبياناته</b>، أو <b>الاعتراض</b> على معالجة معيّنة.</p>
  <p>لطلب الحذف، راسلنا على <strong>[[بريد التواصل]]</strong> من البريد المسجَّل في حسابك، وسنستجيب
    خلال <strong>مدة لا تتجاوز 30 يومًا</strong>. قد نحتفظ بالحدّ الأدنى من سجلات التبرع إذا كان القانون يلزمنا بذلك،
    ونوضّح لك ذلك عند الرد.</p>

  <h2>الأطفال</h2>
  <p>قد تُقدَّم طلبات نيابةً عن أشخاص دون الثامنة عشرة. في هذه الحالة يجب أن يقدّم الطلب وليّ الأمر أو
    من يقوم مقامه. [[تؤكّد الجمعية آلية التحقّق المتّبعة]].</p>

  <h2>كيف نحمي البيانات</h2>
  <ul>
    <li>الاتصال بالخادم مشفّر بالكامل (HTTPS).</li>
    <li>كلمات مرور المسؤولين مخزَّنة مُجزّأة (argon2)، ولا تُحفظ نصًّا أبدًا.</li>
    <li>الصلاحيات محدودة لكل مسؤول بحسب دوره، وكل تعديل مسجَّل.</li>
    <li>الأرقام المرجعية للحجوزات والتبرعات غير قابلة للتخمين.</li>
  </ul>

  <h2>تعديلات هذه السياسة</h2>
  <p>عند تغييرها سنحدّث تاريخ آخر تعديل أعلى الصفحة، ونُخطر المستخدمين داخل التطبيق إذا كان التغيير
    جوهريًا.</p>

  <h2>للتواصل</h2>
  <p><strong>[[بريد التواصل]]</strong> · <strong>[[رقم الهاتف]]</strong> · <strong>[[العنوان]]</strong></p>

  <div class="lang">
    <button type="button" id="b-ar" aria-pressed="true">العربية</button>
    <button type="button" id="b-en" aria-pressed="false">English</button>
  </div>
</section>

<!-- ══════════════ ENGLISH ══════════════ -->
<section data-en hidden>
  <h1>Privacy Policy</h1>
  <p class="sub">Ahla Shabab Foundation app and dashboard · Last updated: August 2026</p>

  <div class="todo">
    <b>Before publishing:</b> items marked <code>[[…]]</code> are the foundation's decisions — the
    registered legal name, a contact address, and retention periods. A policy that promises something
    the foundation does not actually do is worse than no policy.
  </div>

  <h2>Who we are</h2>
  <p><strong>[[Registered legal name]]</strong>, at <strong>[[address]]</strong>, is responsible for
    the personal data described below. For anything about your privacy:
    <strong>[[contact email]]</strong>.</p>

  <h2>What we collect, and when</h2>
  <p>Browsing the app collects nothing. Data is collected only when you do one of these things:</p>

  <div class="box">
    <p><b>Creating an account or signing in</b><br>
      Email address (it is how you sign in), name, phone number, governorate.</p>
    <p><b>Booking an appointment</b><br>
      Name, phone, age, gender, governorate, your notes, and a <b>national ID number — an entirely
      optional field, not required to complete a booking</b>.</p>
    <p><b>Requesting a consultation</b><br>
      Name, phone, WhatsApp number, email, age, governorate, preferred channel and time, and
      <b>your own written description of your situation</b>.</p>
    <p><b>Donating</b><br>
      Donor name, amount, transfer method. <b>We never collect card details</b> — there is no payment
      gateway in the app; transfers happen outside it by bank, Fawry or Vodafone Cash.</p>
    <p><b>Volunteering or messaging us</b><br>
      Name, phone, age, governorate, areas of interest and availability, or the text of your message.</p>
    <p><b>Enabling notifications</b><br>
      A device notification token and your platform. The token does not identify you.</p>
    <p><b>Automatically — for administration only</b><br>
      When a member of foundation staff makes a change in the dashboard, their IP address and browser
      are recorded alongside their identity. This log concerns <b>staff</b>, not users.</p>
  </div>

  <div class="grave">
    <p><b>Sensitive data.</b> The national ID number and your written description in a consultation
      request are the most sensitive things we hold. The ID number is optional and may be left blank.
      It is never shown in any public view, and it is not returned when a booking is looked up by its
      reference.</p>
  </div>

  <h2>Why we collect it</h2>
  <ul>
    <li>To do what you asked: book an appointment, arrange a consultation, record a donation, answer a message.</li>
    <li>To contact you about that specific request.</li>
    <li>To issue a donation receipt and let you retrieve it.</li>
    <li>To notify you about your requests — you can turn these off in the app.</li>
    <li>For the foundation's own statistics, always aggregated so no one is identifiable.</li>
  </ul>

  <h2>What we do not do</h2>
  <ul>
    <li><b>We do not sell your data or share it for marketing or advertising.</b></li>
    <li>No advertising and no advertising trackers in the app.</li>
    <li>We do not collect your location, contacts, photos, or device contents.</li>
    <li>We hold no card details, because there is no payment gateway.</li>
  </ul>

  <h2>Who can see it</h2>
  <p>Access is limited to authorised foundation staff, each according to their role, with every
    <b>change</b> recorded against the person who made it. The details of a consultation request —
    including your description of your situation — are currently visible to the team handling
    requests, not restricted to one assigned consultant. Data is processed by these providers only:</p>
  <ul>
    <li><b>Hosting provider</b> — database and server storage.</li>
    <li><b>Google (Firebase)</b> — delivering notifications to your device only.</li>
    <li><b>Cloudflare</b> — protecting and speeding up the service.</li>
    <li><b>[[Email provider]]</b> — sending login codes.</li>
  </ul>
  <p>We disclose your data to no one else unless required by law.</p>

  <h2>How long we keep it</h2>
  <p>[[The foundation sets this — suggested: bookings and consultation requests for two years from
    last update, donation records for as long as accounting requirements demand, user accounts until
    deletion is requested]].</p>

  <h2>Your rights</h2>
  <p>At any time you may ask to <b>see</b> your data, <b>correct</b> it, <b>delete your account and
    its data</b>, or <b>object</b> to a particular use.</p>
  <p>To request deletion, write to <strong>[[contact email]]</strong> from the address registered on
    your account and we will respond <strong>within 30 days</strong>. We may retain minimal
    donation records where the law requires it, and will say so when we reply.</p>

  <h2>Children</h2>
  <p>Requests may be made on behalf of people under eighteen. In that case a parent or guardian must
    submit the request. [[The foundation confirms the verification method used]].</p>

  <h2>How we protect it</h2>
  <ul>
    <li>All traffic to the server is encrypted (HTTPS).</li>
    <li>Staff passwords are stored hashed (argon2) and never in plain text.</li>
    <li>Each administrator's access is limited by role, and every change is logged.</li>
    <li>Booking and donation reference numbers are not guessable.</li>
  </ul>

  <h2>Changes to this policy</h2>
  <p>We will update the date at the top and, for anything material, notify users in the app.</p>

  <h2>Contact</h2>
  <p><strong>[[contact email]]</strong> · <strong>[[phone]]</strong> · <strong>[[address]]</strong></p>

  <div class="lang">
    <button type="button" id="b-ar2" aria-pressed="false">العربية</button>
    <button type="button" id="b-en2" aria-pressed="true">English</button>
  </div>
</section>

<footer>
  <span data-ar>جمعية خواطر أحلى شباب</span>
  <span data-en hidden>Ahla Shabab Foundation</span>
</footer>
</div>

<script>
(function(){
  function show(lang){
    var ar = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ar]').forEach(function(n){ n.hidden = !ar; });
    document.querySelectorAll('[data-en]').forEach(function(n){ n.hidden = ar; });
    ['b-ar','b-ar2'].forEach(function(id){ var e=document.getElementById(id); if(e) e.setAttribute('aria-pressed', String(ar)); });
    ['b-en','b-en2'].forEach(function(id){ var e=document.getElementById(id); if(e) e.setAttribute('aria-pressed', String(!ar)); });
    window.scrollTo(0,0);
  }
  ['b-ar','b-ar2'].forEach(function(id){ var e=document.getElementById(id); if(e) e.addEventListener('click', function(){ show('ar'); }); });
  ['b-en','b-en2'].forEach(function(id){ var e=document.getElementById(id); if(e) e.addEventListener('click', function(){ show('en'); }); });
})();
</script>
</body>
</html>`;
