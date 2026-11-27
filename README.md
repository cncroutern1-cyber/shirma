# Revo — sayt
Statik sayt (`index.html`) + buyurtmalarni yuboruvchi `api/telegram.js` (email va/yoki Telegram).
Vercel'da Environment Variables:
- Email: `RESEND_API_KEY` (resend.com, ro‘yxatdan o‘tgan email bilan), ixtiyoriy `ORDER_EMAIL` (standart: cncroutern1@gmail.com)
- Telegram (ixtiyoriy): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
Build sozlamasi kerak emas.

## Admin (mahsulotlarni boshqarish)
1. Supabase: Authentication → Users → Add user `admin@revo-sayt.uz` (parol o'zingizniki, Auto Confirm yoqilgan).
2. SQL Editor'da `supabase-sayt-admin.sql` ni ishga tushiring.
3. Saytda Ctrl+7 (telefonda logotipni 5 marta bosing) → parolni kiriting → pastda admin paneli chiqadi.
4. Birinchi marta "Mahsulotlarni bazaga ko'chirish" tugmasini bosing. Keyin har bir mahsulotda ✎ va 🗑, pastda "＋ Mahsulot" bor.
