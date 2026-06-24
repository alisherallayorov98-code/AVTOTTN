# AvtoETTN — 1Uz va Didox integratsiyasi (Desktop Versiya)

Ushbu ilova **1Uz buxgalteriya dasturi**dan yoki yuklangan **PDF formatidagi hisob-fakturalar**dan ETTN (Elektron Tovar-Transport Yukxati) yaratish va ularni transport vositalarining yuk sig'imiga qarab avtomatik ravishda Excel fayllarga bo'lib (split qilib) berish uchun mo'ljallangan.

Ilova to'liq huquqli **Windows Dasturi (Desktop app)** shaklida yig'ilgan va hech qanday internet yoki qo'shimcha o'rnatishlarni (Node.js kabi) talab qilmaydi.

---

## 🚀 O'rnatish va ishga tushirish

Hech qanday dasturlarni (Node.js kabi) internetdan yuklash shart emas.

### Boshqalarga yuborish
Dasturni boshqa kompyuterga o'rnatish uchun **`dist`** papkasi ichida joylashgan **`AvtoETTN Setup 1.0.0.exe`** nomli faylni yuborishingizning o'zi kifoya. Qolgan papkalarni yuborish shart emas!

### Yangi kompyuterda o'rnatish
1. Hamkasbingiz o'sha `Setup.exe` faylini ustiga ikki marta bosib ochadi.
2. Dastur bir zumda (xuddi Telegram yoki Google Chrome kabi) o'rnatiladi.
3. Ish stolida **"AvtoETTN"** nomli maxsus yorliq paydo bo'ladi.
4. Ilova avtomatik ravishda chiroyli alohida dastur oynasida ochiladi va ishlashga tayyor bo'ladi. Oynani yopsangiz, dastur to'liq yopiladi.

---

## ⚙️ Sozlamalar va Ma'lumotlar bazasi

* **Lokal Ma'lumotlar:** Har bir foydalanuvchi kiritgan mashinalar ro'yxati, sozlamalar va qo'lda yozilgan fakturalar kompyuterning o'z xotirasiga saqlanadi va boshqa birov ko'ra olmaydi.
* **1Uz ulanishi (Ixtiyoriy):** 
  * Ilovadagi **"Sozlamalar"** bo'limiga kirib, lokal kompyuterdagi 1Uz dasturining Firebird ma'lumotlar bazasi fayliga (`.fdb` fayl) yo'lni ko'rsating.
  * Agar ushbu kompyuterda 1Uz bazasi bo'lmasa, dastur avtomatik ravishda demo rejimida ishlaydi. Foydalanuvchilar Didox-dan olingan ZIP yoki PDF fakturalarni yuklab split qilish funksiyalaridan bemalol foydalana oladilar.
