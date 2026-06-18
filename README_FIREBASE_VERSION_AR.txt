# نسخة Firebase النهائية

## الخطوات المطلوبة قبل رفع الموقع

1. Firebase Console > Authentication > Sign-in method
   فعّل Email/Password.

2. Firebase Console > Authentication > Users
   أضف أول حساب يدويًا. أول حساب يدخل إلى البرنامج سيكون المدير Admin تلقائياً.

3. Firebase Console > Firestore Database
   أنشئ قاعدة البيانات.

4. Firestore Database > Rules
   انسخ محتوى firestore.rules.txt وضعه في Rules ثم اضغط Publish.

5. GitHub
   ارفع هذين الملفين إلى المستودع:
   - index.html
   - app.js

## ملاحظات
- تسجيل الدخول صار بالبريد الإلكتروني وكلمة المرور.
- حسابات الموظفين تضيفها من تبويب الحسابات داخل البرنامج.
- حذف الحساب من البرنامج يحذف صلاحية التطبيق فقط، أما حذف حساب Firebase Authentication فيتم من Firebase Console.
