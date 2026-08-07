/**
 * The canonical consultation types — the single source of truth for both the
 * seed and the CMS migration.
 *
 * These MUST match the app's bundled forms in the shared package
 * (`shared/src/cms/cmsDefaults.ts` → `defaultConsultations`). The app keys its
 * consultation routes by these Arabic keys, so they are route parameters, not
 * display strings.
 *
 * What was wrong before (T-07):
 *   - keys were English (`psychological`, `legal`, `family`, `social`,
 *     `educational`), three of which the app has no form for at all;
 *   - the consent box was typed `checkbox` instead of `consent`. A checkbox
 *     renders its choices from `options`, and the consent field has none, so an
 *     API-driven form would have shown a REQUIRED agreement with nothing to tick
 *     and no way to submit;
 *   - choice fields carried no `options` in several types.
 *
 * The app never actually broke, because `cmsMapper.isFullFidelity()` rejects a
 * type in that state and falls back to the bundled form. The cost was silent:
 * no consultation form edited in the dashboard could ever reach the app.
 *
 * Generated from the shared defaults rather than transcribed by hand, so the two
 * cannot drift by typo. See qa/FIX_LOG.md → T-07.
 */
export const DEFAULT_CONSULTATION_TYPES = [
  {
    "key": "نفسية",
    "label": "استشارة نفسية",
    "icon": "heart",
    "description": "جلسة سرية مع أخصائي نفسي معتمد.",
    "disclaimer": "هذه استشارة استرشادية ولا تُغني عن التشخيص أو العلاج المتخصص عند الحاجة.",
    "sortOrder": 0,
    "visible": true,
    "homeVisible": true,
    "availableTimes": [
      "صباحاً (9-12)",
      "ظهراً (12-3)",
      "مساءً (3-6)",
      "أي وقت"
    ],
    "fields": [
      {
        "key": "name",
        "label": "الاسم بالكامل",
        "type": "text",
        "required": true,
        "hidden": false,
        "sortOrder": 0,
        "placeholder": "اكتب اسمك",
        "validationMessage": "اكتب اسمك بالكامل (3 أحرف على الأقل)"
      },
      {
        "key": "phone",
        "label": "رقم الهاتف",
        "type": "phone",
        "required": true,
        "hidden": false,
        "sortOrder": 1,
        "placeholder": "01xxxxxxxxx",
        "validationMessage": "أدخل رقم هاتف مصري صحيح"
      },
      {
        "key": "whatsapp",
        "label": "واتساب",
        "type": "whatsapp",
        "required": false,
        "hidden": false,
        "sortOrder": 2,
        "placeholder": "إن وجد"
      },
      {
        "key": "email",
        "label": "البريد الإلكتروني",
        "type": "email",
        "required": true,
        "hidden": false,
        "sortOrder": 3,
        "placeholder": "example@mail.com",
        "validationMessage": "أدخل بريدك الإلكتروني لمتابعة طلبك لاحقاً"
      },
      {
        "key": "age",
        "label": "السن",
        "type": "age",
        "required": false,
        "hidden": false,
        "sortOrder": 4,
        "placeholder": "العمر"
      },
      {
        "key": "governorate",
        "label": "المحافظة",
        "type": "governorate",
        "required": true,
        "hidden": false,
        "sortOrder": 5,
        "validationMessage": "اختر المحافظة"
      },
      {
        "key": "comm",
        "label": "وسيلة التواصل المفضلة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 6,
        "options": [
          "واتساب",
          "مكالمة هاتفية",
          "مكالمة فيديو",
          "بريد إلكتروني"
        ],
        "validationMessage": "اختر وسيلة التواصل"
      },
      {
        "key": "time",
        "label": "الوقت المفضل للتواصل",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 7,
        "options": [
          "صباحاً (9-12)",
          "ظهراً (12-3)",
          "مساءً (3-6)",
          "أي وقت"
        ],
        "validationMessage": "اختر الوقت المفضل"
      },
      {
        "key": "topic",
        "label": "طبيعة الحالة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 10,
        "options": [
          "قلق وتوتر",
          "اكتئاب",
          "ضغوط حياتية",
          "علاقات",
          "أخرى"
        ],
        "validationMessage": "اختر: طبيعة الحالة"
      },
      {
        "key": "previous",
        "label": "هل سبق تلقي جلسات نفسية؟",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 11,
        "options": [
          "نعم",
          "لا"
        ],
        "validationMessage": "اختر: هل سبق تلقي جلسات نفسية؟"
      },
      {
        "key": "summary",
        "label": "ملخص المشكلة",
        "type": "textarea",
        "required": true,
        "hidden": false,
        "sortOrder": 20,
        "placeholder": "اشرح باختصار ما تريد الاستشارة بشأنه...",
        "validationMessage": "اكتب ملخصاً موجزاً (10 أحرف على الأقل)"
      },
      {
        "key": "consent",
        "label": "أوافق على أن تُعالَج بياناتي بسرية لغرض الاستشارة فقط",
        "type": "consent",
        "required": true,
        "hidden": false,
        "sortOrder": 21,
        "validationMessage": "يجب الموافقة للمتابعة"
      }
    ]
  },
  {
    "key": "دينية",
    "label": "استشارة دينية",
    "icon": "book-open",
    "description": "إجابة موثوقة من مختص شرعي.",
    "disclaimer": "هذه استشارة استرشادية ولا تُغني عن التشخيص أو العلاج المتخصص عند الحاجة.",
    "sortOrder": 1,
    "visible": true,
    "homeVisible": true,
    "availableTimes": [
      "صباحاً (9-12)",
      "ظهراً (12-3)",
      "مساءً (3-6)",
      "أي وقت"
    ],
    "fields": [
      {
        "key": "name",
        "label": "الاسم بالكامل",
        "type": "text",
        "required": true,
        "hidden": false,
        "sortOrder": 0,
        "placeholder": "اكتب اسمك",
        "validationMessage": "اكتب اسمك بالكامل (3 أحرف على الأقل)"
      },
      {
        "key": "phone",
        "label": "رقم الهاتف",
        "type": "phone",
        "required": true,
        "hidden": false,
        "sortOrder": 1,
        "placeholder": "01xxxxxxxxx",
        "validationMessage": "أدخل رقم هاتف مصري صحيح"
      },
      {
        "key": "whatsapp",
        "label": "واتساب",
        "type": "whatsapp",
        "required": false,
        "hidden": false,
        "sortOrder": 2,
        "placeholder": "إن وجد"
      },
      {
        "key": "email",
        "label": "البريد الإلكتروني",
        "type": "email",
        "required": true,
        "hidden": false,
        "sortOrder": 3,
        "placeholder": "example@mail.com",
        "validationMessage": "أدخل بريدك الإلكتروني لمتابعة طلبك لاحقاً"
      },
      {
        "key": "age",
        "label": "السن",
        "type": "age",
        "required": false,
        "hidden": false,
        "sortOrder": 4,
        "placeholder": "العمر"
      },
      {
        "key": "governorate",
        "label": "المحافظة",
        "type": "governorate",
        "required": true,
        "hidden": false,
        "sortOrder": 5,
        "validationMessage": "اختر المحافظة"
      },
      {
        "key": "comm",
        "label": "وسيلة التواصل المفضلة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 6,
        "options": [
          "واتساب",
          "مكالمة هاتفية",
          "مكالمة فيديو",
          "بريد إلكتروني"
        ],
        "validationMessage": "اختر وسيلة التواصل"
      },
      {
        "key": "time",
        "label": "الوقت المفضل للتواصل",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 7,
        "options": [
          "صباحاً (9-12)",
          "ظهراً (12-3)",
          "مساءً (3-6)",
          "أي وقت"
        ],
        "validationMessage": "اختر الوقت المفضل"
      },
      {
        "key": "topic",
        "label": "موضوع الاستشارة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 10,
        "options": [
          "عبادات",
          "معاملات مالية",
          "أسرة وزواج",
          "أخرى"
        ],
        "validationMessage": "اختر: موضوع الاستشارة"
      },
      {
        "key": "summary",
        "label": "ملخص المشكلة",
        "type": "textarea",
        "required": true,
        "hidden": false,
        "sortOrder": 20,
        "placeholder": "اشرح باختصار ما تريد الاستشارة بشأنه...",
        "validationMessage": "اكتب ملخصاً موجزاً (10 أحرف على الأقل)"
      },
      {
        "key": "consent",
        "label": "أوافق على أن تُعالَج بياناتي بسرية لغرض الاستشارة فقط",
        "type": "consent",
        "required": true,
        "hidden": false,
        "sortOrder": 21,
        "validationMessage": "يجب الموافقة للمتابعة"
      }
    ]
  },
  {
    "key": "طبية",
    "label": "استشارة طبية",
    "icon": "activity",
    "description": "رأي طبي مبدئي وتوجيه للتخصص المناسب.",
    "disclaimer": "هذه استشارة استرشادية ولا تُغني عن التشخيص أو العلاج المتخصص عند الحاجة.",
    "sortOrder": 2,
    "visible": true,
    "homeVisible": true,
    "availableTimes": [
      "صباحاً (9-12)",
      "ظهراً (12-3)",
      "مساءً (3-6)",
      "أي وقت"
    ],
    "fields": [
      {
        "key": "name",
        "label": "الاسم بالكامل",
        "type": "text",
        "required": true,
        "hidden": false,
        "sortOrder": 0,
        "placeholder": "اكتب اسمك",
        "validationMessage": "اكتب اسمك بالكامل (3 أحرف على الأقل)"
      },
      {
        "key": "phone",
        "label": "رقم الهاتف",
        "type": "phone",
        "required": true,
        "hidden": false,
        "sortOrder": 1,
        "placeholder": "01xxxxxxxxx",
        "validationMessage": "أدخل رقم هاتف مصري صحيح"
      },
      {
        "key": "whatsapp",
        "label": "واتساب",
        "type": "whatsapp",
        "required": false,
        "hidden": false,
        "sortOrder": 2,
        "placeholder": "إن وجد"
      },
      {
        "key": "email",
        "label": "البريد الإلكتروني",
        "type": "email",
        "required": true,
        "hidden": false,
        "sortOrder": 3,
        "placeholder": "example@mail.com",
        "validationMessage": "أدخل بريدك الإلكتروني لمتابعة طلبك لاحقاً"
      },
      {
        "key": "age",
        "label": "السن",
        "type": "age",
        "required": false,
        "hidden": false,
        "sortOrder": 4,
        "placeholder": "العمر"
      },
      {
        "key": "governorate",
        "label": "المحافظة",
        "type": "governorate",
        "required": true,
        "hidden": false,
        "sortOrder": 5,
        "validationMessage": "اختر المحافظة"
      },
      {
        "key": "comm",
        "label": "وسيلة التواصل المفضلة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 6,
        "options": [
          "واتساب",
          "مكالمة هاتفية",
          "مكالمة فيديو",
          "بريد إلكتروني"
        ],
        "validationMessage": "اختر وسيلة التواصل"
      },
      {
        "key": "time",
        "label": "الوقت المفضل للتواصل",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 7,
        "options": [
          "صباحاً (9-12)",
          "ظهراً (12-3)",
          "مساءً (3-6)",
          "أي وقت"
        ],
        "validationMessage": "اختر الوقت المفضل"
      },
      {
        "key": "specialty",
        "label": "التخصص المطلوب",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 10,
        "options": [
          "طب عام",
          "أطفال",
          "أسنان",
          "رمد وعيون",
          "غير متأكد"
        ],
        "validationMessage": "اختر: التخصص المطلوب"
      },
      {
        "key": "chronic",
        "label": "هل توجد أمراض مزمنة؟",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 11,
        "options": [
          "نعم",
          "لا"
        ],
        "validationMessage": "اختر: هل توجد أمراض مزمنة؟"
      },
      {
        "key": "summary",
        "label": "ملخص المشكلة",
        "type": "textarea",
        "required": true,
        "hidden": false,
        "sortOrder": 20,
        "placeholder": "اشرح باختصار ما تريد الاستشارة بشأنه...",
        "validationMessage": "اكتب ملخصاً موجزاً (10 أحرف على الأقل)"
      },
      {
        "key": "consent",
        "label": "أوافق على أن تُعالَج بياناتي بسرية لغرض الاستشارة فقط",
        "type": "consent",
        "required": true,
        "hidden": false,
        "sortOrder": 21,
        "validationMessage": "يجب الموافقة للمتابعة"
      }
    ]
  },
  {
    "key": "أسرية",
    "label": "استشارة أسرية",
    "icon": "users",
    "description": "إرشاد أسري لحل الخلافات وتحسين العلاقات.",
    "disclaimer": "هذه استشارة استرشادية ولا تُغني عن التشخيص أو العلاج المتخصص عند الحاجة.",
    "sortOrder": 3,
    "visible": true,
    "homeVisible": true,
    "availableTimes": [
      "صباحاً (9-12)",
      "ظهراً (12-3)",
      "مساءً (3-6)",
      "أي وقت"
    ],
    "fields": [
      {
        "key": "name",
        "label": "الاسم بالكامل",
        "type": "text",
        "required": true,
        "hidden": false,
        "sortOrder": 0,
        "placeholder": "اكتب اسمك",
        "validationMessage": "اكتب اسمك بالكامل (3 أحرف على الأقل)"
      },
      {
        "key": "phone",
        "label": "رقم الهاتف",
        "type": "phone",
        "required": true,
        "hidden": false,
        "sortOrder": 1,
        "placeholder": "01xxxxxxxxx",
        "validationMessage": "أدخل رقم هاتف مصري صحيح"
      },
      {
        "key": "whatsapp",
        "label": "واتساب",
        "type": "whatsapp",
        "required": false,
        "hidden": false,
        "sortOrder": 2,
        "placeholder": "إن وجد"
      },
      {
        "key": "email",
        "label": "البريد الإلكتروني",
        "type": "email",
        "required": true,
        "hidden": false,
        "sortOrder": 3,
        "placeholder": "example@mail.com",
        "validationMessage": "أدخل بريدك الإلكتروني لمتابعة طلبك لاحقاً"
      },
      {
        "key": "age",
        "label": "السن",
        "type": "age",
        "required": false,
        "hidden": false,
        "sortOrder": 4,
        "placeholder": "العمر"
      },
      {
        "key": "governorate",
        "label": "المحافظة",
        "type": "governorate",
        "required": true,
        "hidden": false,
        "sortOrder": 5,
        "validationMessage": "اختر المحافظة"
      },
      {
        "key": "comm",
        "label": "وسيلة التواصل المفضلة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 6,
        "options": [
          "واتساب",
          "مكالمة هاتفية",
          "مكالمة فيديو",
          "بريد إلكتروني"
        ],
        "validationMessage": "اختر وسيلة التواصل"
      },
      {
        "key": "time",
        "label": "الوقت المفضل للتواصل",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 7,
        "options": [
          "صباحاً (9-12)",
          "ظهراً (12-3)",
          "مساءً (3-6)",
          "أي وقت"
        ],
        "validationMessage": "اختر الوقت المفضل"
      },
      {
        "key": "topic",
        "label": "أطراف المشكلة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 10,
        "options": [
          "علاقة زوجية",
          "الأبناء",
          "الوالدين",
          "أخرى"
        ],
        "validationMessage": "اختر: أطراف المشكلة"
      },
      {
        "key": "familySize",
        "label": "عدد أفراد الأسرة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 11,
        "options": [
          "2-3",
          "4-6",
          "أكثر من 6"
        ],
        "validationMessage": "اختر: عدد أفراد الأسرة"
      },
      {
        "key": "summary",
        "label": "ملخص المشكلة",
        "type": "textarea",
        "required": true,
        "hidden": false,
        "sortOrder": 20,
        "placeholder": "اشرح باختصار ما تريد الاستشارة بشأنه...",
        "validationMessage": "اكتب ملخصاً موجزاً (10 أحرف على الأقل)"
      },
      {
        "key": "consent",
        "label": "أوافق على أن تُعالَج بياناتي بسرية لغرض الاستشارة فقط",
        "type": "consent",
        "required": true,
        "hidden": false,
        "sortOrder": 21,
        "validationMessage": "يجب الموافقة للمتابعة"
      }
    ]
  },
  {
    "key": "أعمال",
    "label": "استشارة أعمال",
    "icon": "briefcase",
    "description": "توجيه مهني لمشروعك أو مسارك الوظيفي.",
    "disclaimer": "هذه استشارة استرشادية ولا تُغني عن التشخيص أو العلاج المتخصص عند الحاجة.",
    "sortOrder": 4,
    "visible": true,
    "homeVisible": true,
    "availableTimes": [
      "صباحاً (9-12)",
      "ظهراً (12-3)",
      "مساءً (3-6)",
      "أي وقت"
    ],
    "fields": [
      {
        "key": "name",
        "label": "الاسم بالكامل",
        "type": "text",
        "required": true,
        "hidden": false,
        "sortOrder": 0,
        "placeholder": "اكتب اسمك",
        "validationMessage": "اكتب اسمك بالكامل (3 أحرف على الأقل)"
      },
      {
        "key": "phone",
        "label": "رقم الهاتف",
        "type": "phone",
        "required": true,
        "hidden": false,
        "sortOrder": 1,
        "placeholder": "01xxxxxxxxx",
        "validationMessage": "أدخل رقم هاتف مصري صحيح"
      },
      {
        "key": "whatsapp",
        "label": "واتساب",
        "type": "whatsapp",
        "required": false,
        "hidden": false,
        "sortOrder": 2,
        "placeholder": "إن وجد"
      },
      {
        "key": "email",
        "label": "البريد الإلكتروني",
        "type": "email",
        "required": true,
        "hidden": false,
        "sortOrder": 3,
        "placeholder": "example@mail.com",
        "validationMessage": "أدخل بريدك الإلكتروني لمتابعة طلبك لاحقاً"
      },
      {
        "key": "age",
        "label": "السن",
        "type": "age",
        "required": false,
        "hidden": false,
        "sortOrder": 4,
        "placeholder": "العمر"
      },
      {
        "key": "governorate",
        "label": "المحافظة",
        "type": "governorate",
        "required": true,
        "hidden": false,
        "sortOrder": 5,
        "validationMessage": "اختر المحافظة"
      },
      {
        "key": "comm",
        "label": "وسيلة التواصل المفضلة",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 6,
        "options": [
          "واتساب",
          "مكالمة هاتفية",
          "مكالمة فيديو",
          "بريد إلكتروني"
        ],
        "validationMessage": "اختر وسيلة التواصل"
      },
      {
        "key": "time",
        "label": "الوقت المفضل للتواصل",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 7,
        "options": [
          "صباحاً (9-12)",
          "ظهراً (12-3)",
          "مساءً (3-6)",
          "أي وقت"
        ],
        "validationMessage": "اختر الوقت المفضل"
      },
      {
        "key": "field",
        "label": "مجال العمل",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 10,
        "options": [
          "تجارة",
          "حرف ومهن",
          "خدمات",
          "زراعة",
          "أخرى"
        ],
        "validationMessage": "اختر: مجال العمل"
      },
      {
        "key": "stage",
        "label": "مرحلة المشروع",
        "type": "radio",
        "required": true,
        "hidden": false,
        "sortOrder": 11,
        "options": [
          "فكرة",
          "بدء التشغيل",
          "قائم بالفعل",
          "توسع"
        ],
        "validationMessage": "اختر: مرحلة المشروع"
      },
      {
        "key": "summary",
        "label": "ملخص المشكلة",
        "type": "textarea",
        "required": true,
        "hidden": false,
        "sortOrder": 20,
        "placeholder": "اشرح باختصار ما تريد الاستشارة بشأنه...",
        "validationMessage": "اكتب ملخصاً موجزاً (10 أحرف على الأقل)"
      },
      {
        "key": "consent",
        "label": "أوافق على أن تُعالَج بياناتي بسرية لغرض الاستشارة فقط",
        "type": "consent",
        "required": true,
        "hidden": false,
        "sortOrder": 21,
        "validationMessage": "يجب الموافقة للمتابعة"
      }
    ]
  }
];
