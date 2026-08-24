# 🎁 Telegram Konkurs Bot (Referral Contest Bot)

Ushbu loyiha Telegram'da professional, avtomatlashtirilgan referal konkurslarini o'tkazish uchun mo'ljallangan bot tizimi.

---

## 🌟 Asosiy Imkoniyatlar

### 👑 Admin Paneli (`/admin`)
1. **Statistika va Reyting**:
   * Jami ishtirokchilar va umumiy taklif qilingan referallar soni.
   * TOP-15 eng ko'p odam chaqirganlar ro'yxati (Leaderboard).
   * G'oliblar ro'yxati va ularning sovg'ani olganlik holati.
2. **Qadamma-qadam Konkurs Yaratish (Wizard)**:
   * Yangi konkurs ochilganda eski konkurs ma'lumotlari avtomatik yangilanadi/arxivlanadi.
   * Konkurs posti (rasm + matn / caption).
   * **Sovg'a turi**:
     * 🔗 **Kanalga 1 martalik link:** Bot g'olibga maxsus 1 kishilik bir martalik yopiq kanal havolasini avtomatik yaratib beradi (`createChatInviteLink` + `member_limit: 1`).
     * 📚 **Kitob / Fayl / Material:** Admin botga tayyor post/materialni forward qiladi, bot esa uni g'olibga ko'chirib yuboradi.
   * Sovg'aga erishish uchun kerakli odamlar soni (masalan, 5 ta).
   * Maksimal g'oliblar soni (masalan, 50 ta).
   * Konkurs tugash muddati (soat/kunlarda). Konkurs vaqtida boshqa konkurs ochish cheklanadi.
3. **Konkursni to'xtatish**:
   * Kerak bo'lganda faol konkursni muddatidan oldin yakunlash.

### 👥 Ishtirokchi (O'quvchi / Foydalanuvchi)
1. `/start` bosganda faol konkurs ma'lumotlari va shaxsiy referal havola beriladi: `https://t.me/BotUsername?start=ref_ID`
2. **"↗️ Do'stlarga ulashish"** tugmasi orqali havolani oson tarqatish.
3. Yangi do'st qo'shilganda har bir referal uchun xabarnoma (`➕ Yangi do'stingiz qo'shildi! Sizning balingiz: 3/5`).
4. Belgilangan songa yetishi bilan **avtomatik tarzda sovg'ani qabul qilish**.
5. Menyu orqali ballni, TOP yetakchilar ro'yxatini va konkurs qoidalarini kuzatib borish.

### 🛡 Xavfsizlik va Firibgarlikdan Himoya
* O'z-o'zini taklif qilish taqiqlangan.
* Bir foydalanuvchini qayta taklif qilish hisoblanmaydi.
* SQLite `WAL` rejimi va tranzaksiyalar orqali ma'lumotlar yaxlitligi ta'minlangan.

---

## 🚀 Ishga Tushirish Qo'llanmasi

### 1. Lokal Ishga Tushirish (Development / Long Polling)

1. Loyiha papkasiga kiring:
   ```bash
   cd bukonkursbot
   ```

2. `.env` faylini yarating:
   ```bash
   cp .env.example .env
   ```

3. `.env` fayliga ma'lumotlarni kiriting:
   ```env
   BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   ADMIN_IDS=123456789
   USE_WEBHOOK=false
   ```
   *(Telegram ID'ingizni bilish uchun @userinfobot dan foydalanishingiz mumkin)*

4. Ishga tushiring:
   ```bash
   npm run dev
   ```

---

### 2. Docker va Caddy orqali Ishga Tushirish (Production / Webhook)

Avtomatik bepul SSL sertifikatlari (HTTPS) va Caddy reverse-proxy bilan bitta buyruq orqali ishga tushirish:

1. `.env` faylini sozlang:
   ```env
   BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   ADMIN_IDS=123456789
   USE_WEBHOOK=true
   DOMAIN=konkurs.sizningdomeningiz.uz
   PORT=3000
   WEBHOOK_SECRET=maxfiy_xavfsizlik_kaliti_123
   ```

2. Docker Compose orqali ishga tushiring:
   ```bash
   docker compose up -d --build
   ```

3. Loglarni kuzatish:
   ```bash
   docker compose logs -f
   ```

---

## 🧪 Sinovlar (Unit Tests)

Botning ma'lumotlar bazasi, referal mantiqi va g'oliblarni hisoblash funksiyalarini tekshirish uchun:
```bash
npm test
```

---

## 📂 Loyiha Strukturasi

```
bukonkursbot/
├── src/
│   ├── config.ts             # Muhit sozlamalari (.env)
│   ├── types.ts              # TypeScript tiplari
│   ├── index.ts              # Asosiy kirish nuqtasi (Webhook & Polling)
│   ├── database/
│   │   ├── db.ts             # SQLite bazaga ulanish
│   │   └── queries.ts        # DB so'rovlari (referallar, g'oliblar, konkurs)
│   ├── handlers/
│   │   ├── admin.ts          # Admin paneli va statistika
│   │   ├── start.ts          # /start va referal hisoblash
│   │   └── wizard.ts         # Konkurs yaratish interaktiv muloqoti
│   ├── keyboards/
│   │   └── index.ts          # Foydalanuvchi va Admin tugmalari
│   ├── services/
│   │   └── contest.ts        # Sovg'ani yetkazish xizmati (Link/Material)
│   └── utils/
│       └── helpers.ts        # Sana formati, referal link yaratish
├── test/
│   └── contest.test.ts       # Avtomatlashtirilgan testlar
├── Caddyfile                 # Caddy reverse proxy va avtomatik SSL
├── Dockerfile                # Multi-stage Docker konteyner fayli
├── docker-compose.yml        # Docker Compose sozlamasi
├── .env.example              # Namuna konfiguratsiya
└── package.json
```
