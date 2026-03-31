const WORKFLOW_TEMPLATES = {
    "PET_CT": [
        { step: 1, name: "استلام التحويلة الطبية المقրرة", blocking: true },
        { step: 2, name: "إرسال التحويلة لقسم الأشعة الذرية", blocking: true, triggerReminderHours: 24 },
        { step: 3, name: "استلام موعد التصوير", blocking: true },
        { step: 4, name: "إرفاق صورة هوية المريض", blocking: true },
        { step: 5, name: "إرفاق صورة هوية المرافق", blocking: true },
        { step: 6, name: "إرسال الهويات لقسم التصاريح", blocking: true },
        { step: 7, name: "مطابقة تاريخ التصريح مع تاريخ الموعد", blocking: true },
        { step: 8, name: "إبلاغ المريض وتأكيد الموعد معه", blocking: true }
    ],
    "MRI": [
        { step: 1, name: "طلب صورة الرنين عبر نظام المستشفى", blocking: true },
        { step: 2, name: "تجهيز التحويلة الطبية الموقعة", blocking: true },
        { step: 3, name: "تجهيز التعهد المالي للموافقة", blocking: true },
        { step: 4, name: "تجهيز تقرير المريض الطبي والإشعاعي", blocking: true },
        { step: 5, name: "إرسال إيميل لمنسق قسم الأشعة", blocking: true, triggerReminderHours: 48 },
        { step: 6, name: "استلام الرد والموافقة المبدئية", blocking: true },
        { step: 7, name: "تأكيد واستلام الموعد على النظام", blocking: true },
        { step: 8, name: "التواصل مع المريض وتجهيزه للموعد", blocking: true }
    ],
    "ENDOSCOPY": [
        { step: 1, name: "تجهيز التحويلة لقسم المناظير", blocking: true },
        { step: 2, name: "تجهيز وتلخيص التقرير الطبي", blocking: true },
        { step: 3, name: "إرسال بيانات المريض لمنسقة القسم", blocking: true },
        { step: 4, name: "استلام تأكيد وتاريخ موعد الإجراء", blocking: true },
        { step: 5, name: "إبلاغ المريض بالموعد والتعليمات الخاصة للتنظير", blocking: true }
    ],
    "SPECIAL_DRUG": [
        { step: 1, name: "مراجعة إيميل استشاري الأدوية للتأكيد", blocking: true },
        { step: 2, name: "تخصيص سرير وجلسة في قسم العلاج الكيماوي", blocking: true },
        { step: 3, name: "استصدار تصريح دخول رسمي ليوم العلاج", blocking: true },
        { step: 4, name: "توفير وثيقة طبية مسجلة باسم الدواء المعتمد", blocking: true },
        { step: 5, name: "استدعاء المريض لموعد الجرعة المقررة", blocking: true }
    ]
};
