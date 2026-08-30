import { PRIVACY_POLICY_HTML } from './privacy-policy.page';

/**
 * The account-deletion page.
 *
 * Google Play requires a **web URL** where deletion can be requested, separate
 * from the in-app control — someone who has already uninstalled the app still
 * has data and no way back into it.
 *
 * Written out in full rather than derived from the privacy page by regex. The
 * first attempt did that, matched nothing, and produced a page that built
 * cleanly and was empty. Two pages that share a stylesheet are not worth a
 * transformation nobody can read.
 */
const STYLE = PRIVACY_POLICY_HTML.slice(
  PRIVACY_POLICY_HTML.indexOf('<style>'),
  PRIVACY_POLICY_HTML.indexOf('</style>') + '</style>'.length,
);

export const ACCOUNT_DELETION_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>حذف الحساب — جمعية خواطر أحلى شباب</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">
${STYLE}
</head>
<body>
<div class="wrap">
  <h1>حذف حسابك وبياناتك</h1>
  <p class="sub">تطبيق «جمعية خواطر أحلى شباب» · <code>tech.saasfarm.ahlashabab</code></p>

  <h2>من داخل التطبيق</h2>
  <p>افتح <b>حسابي</b> ← <b>حذف الحساب</b>، ثم أكّد. يُنفَّذ الحذف فورًا.</p>

  <h2>إذا لم يعد التطبيق مثبّتًا لديك</h2>
  <p>أرسل رسالة إلى <strong>[[بريد التواصل]]</strong> من <b>البريد الإلكتروني المسجَّل في حسابك</b> —
    نستخدمه للتحقق من هويتك — تذكر فيها أنك تطلب حذف حسابك. سننفّذ الطلب خلال مدة
    <b>لا تتجاوز 30 يومًا</b>.</p>

  <h2>ما الذي يُحذف</h2>
  <ul>
    <li>حسابك: بريدك واسمك ورقم هاتفك ومحافظتك.</li>
    <li>إشعاراتك وتفضيلاتها، ومفضّلاتك، والأجهزة المسجَّلة للإشعارات، وكل جلسات الدخول.</li>
    <li><b>رقمك القومي</b> وملاحظاتك في أي حجز.</li>
    <li><b>وصفك المكتوب لحالتك</b> في أي طلب استشارة، مع رقم واتساب وعمرك.</li>
  </ul>

  <h2>ما الذي يبقى، ولماذا</h2>
  <ul>
    <li><b>سجل التبرع</b> — المبلغ والوسيلة والرقم المرجعي فقط، دون اسمك، لأن الجمعية ملزَمة بحفظ
      سجلاتها المحاسبية.</li>
    <li><b>الحجز كموعد</b> — التاريخ والوقت والحالة فقط، دون أي بيانات تخصّك، لأنه جزء من جدول
      مقدّم الخدمة.</li>
  </ul>
  <p>لا يبقى في أيٍّ منهما ما يدلّ عليك.</p>

  <div class="grave">
    <p><b>حدٌّ ينبغي أن تعرفه.</b> طلبات التطوع ورسائل «تواصل معنا» غير مرتبطة بحسابك في النظام —
      تحمل اسمًا ورقم هاتف فقط، فلا يطالها الحذف التلقائي. إن كنت قد أرسلت أيًّا منها وتريد حذفها،
      اذكر ذلك صراحةً في رسالتك وسنحذفها يدويًا.</p>
  </div>

  <h2>لا يمكن التراجع</h2>
  <p>الحذف نهائي، ولا يمكن استرجاع الحساب أو بياناته بعد تنفيذه.</p>

  <h2>للتواصل</h2>
  <p><strong>[[بريد التواصل]]</strong> · <a href="/api/v1/privacy">سياسة الخصوصية الكاملة</a></p>
</div>
</body>
</html>`;
