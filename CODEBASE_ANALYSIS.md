# GRM UZ SERVER — TO'LIQ KOD ANALIZI

> **GitHub:** https://github.com/siddiqun03/new_grm_server
> **Framework:** NestJS 9
> **Database:** PostgreSQL + TypeORM 0.3.15
> **Sana:** 2026-03-12

---

## TEXNOLOGIYALAR

| Texnologiya | Maqsad |
|---|---|
| NestJS 9 | Asosiy backend framework |
| TypeORM 0.3.15 | Database ORM |
| PostgreSQL | Asosiy ma'lumotlar bazasi |
| Redis (ioredis) | OTP cache, session, performance |
| Socket.io | Real-time WebSocket |
| JWT (Passport) | Authentication |
| Bcrypt | Parol xashlash |
| ExcelJS / XLSX | Excel fayllari |
| Multer + Minio | Fayl yuklash va saqlash |
| Telegram | Xabarnomalar |

---

## LOYIHA STATISTIKASI

- **65+** database entity
- **73+** service class
- **70+** modul
- **616** TypeScript fayl

---

## BASE ENTITY

Barcha entitylar `BaseEntity` dan meros oladi:
```
dateOne    → CreateDateColumn (yaratilgan vaqt)
dateTwo    → UpdateDateColumn (yangilangan vaqt)
deletedDate → DeleteDateColumn (soft delete)
```

---

## FOYDALANUVCHI ROLLARI

| Kod | Rol | Vazifa |
|---|---|---|
| 0 | OTHER | Oddiy xodim |
| 1 | CLIENT | iMarket mijozi |
| 2 | SELLER | Sotuvchi |
| 3 | CASHIER | Kassir |
| 4 | F_MANAGER | Filial menejeri |
| 5 | DEALER | Diler |
| 6 | D_MANAGER | Diler menejeri |
| 7 | W_MANAGER | Ombor menejeri |
| 8 | I_MANAGER | Internet do'kon menejeri |
| 9 | M_MANAGER | O'rta menejer |
| 10 | ACCOUNTANT | Buxgalter |
| 11 | HR | Kadrlar bo'limi |
| 12 | BOSS | Administrator (hammasini ko'ra oladi) |

### Rollar ko'rish huquqi:
- **BOSS (12):** Barcha foydalanuvchilarni ko'radi
- **ACCOUNTANT (10):** Barcha menejer va xodimlarni ko'radi
- **HR (11):** Barcha ichki xodimlarni ko'radi
- **M_MANAGER (9):** Filialdagi xodimlarni ko'radi
- **F_MANAGER (4):** Filialdagi SELLER, CASHIER, OTHER ni ko'radi
- **D_MANAGER (6):** Diler xodimlarini ko'radi
- **SELLER (2):** Faqat boshqa sotuvchi va kassirlarni ko'radi

---

## MODULLAR VA ULARNING VAZIFALARI

---

### 1. AUTH MODULI (`src/modules/auth/`)

**Asosiy vazifa:** Login, logout, JWT token yaratish, iMarket OTP autentifikatsiya

**Asosiy metodlar:**
- `validateUserByEmailPassword()` — login/password tekshirish (bcrypt)
- `getJWT()` — access + refresh token yaratish
- `getMeIMarket()` — telefon raqam orqali CLIENT login
- `iMarketLogin()` — 6 raqamli OTP yuborish (Redis'da 180 soniya saqlanadi)
- `registerConfirmIMarket()` — OTP tasdiqlash va user yaratish/kirish

**Passport strategiyalar:**
- `AccessTokenUserStrategy` — JWT validation
- `LocalStrategy` — login/password autentifikatsiya
- `RefreshTokenUserStrategy` — token yangilash

**⚠️ O'ZGARTIRMASLIK:**
- OTP Redis'da 180 soniya saqlanishi
- CLIENT uchun login = telefon raqam, parol = telefon raqam
- Token expiration konfiguratsiyasi

---

### 2. USER MODULI (`src/modules/user/`)

**Asosiy vazifa:** Foydalanuvchi CRUD, rol boshqaruvi, plan yaratish

**Entity asosiy fieldlar:**
- `filial` — ishlash joyi (Many-to-One)
- `position` — lavozim (Many-to-One)
- `avatar` — profil rasmi
- `favoriteProducts` — sevimli mahsulotlar (Many-to-Many)

**Asosiy metodlar:**
- `create()` — yangi user yaratish; SELLER roli uchun avtomatik PlanYear yaratadi
- `createClient()` — iMarket CLIENT user yaratish
- `deleteOne()` — soft delete; bog'liq yozuvlar bo'lsa o'chirmaydi
- `change()` — SELLER → boshqa rol o'zgarganda planlarni qayta taqsimlaydi
- `createBackup()` — PostgreSQL pg_dump orqali zaxira nusxa yaratish

**⚠️ O'ZGARTIRMASLIK:**
- `deleteOne()` — bog'liq yozuvlar tekshiruvi (orphan prevention)
- SELLER yaratilganda avtomatik PlanYear yaratish logikasi
- Rol o'zgarganda plan qayta taqsimlash

---

### 3. PRODUCT MODULI (`src/modules/product/`)

**Asosiy vazifa:** Inventar boshqaruvi, narx belgilash

**Entity asosiy fieldlar:**
- `bar_code` — QrBase ga havola (SKU)
- `count` — joriy zaxira miqdori
- `booking_count` — band qilingan miqdor
- `price, secondPrice, priceMeter, comingPrice` — turli narx darajalari
- `isInternetShop` — iMarket da ko'rsatish
- `partiya_title` — partiya identifikatori
- `filial` — joylashgan filial

**Mavjud miqdor hisoblash:**
```
mavjud = count - booking_count
```

**Asosiy metodlar:**
- `getAll()` — kengaytirilgan qidiruv, rolga asoslangan filterlash
- `prodSearch()` — murakkab SQL query
- `productSecondPriceBulkUpdate()` — ikkilamchi narxlarni ommaviy yangilash
- `internetInfoBulkUpdate()` — iMarket ma'lumotlarini ommaviy yangilash

**⚠️ O'ZGARTIRMASLIK:**
- `count - booking_count` — mavjud miqdor formulasi
- Narx kaskadi (collection → product)

---

### 4. CASHFLOW MODULI (`src/modules/cashflow/`)

**Asosiy vazifa:** Barcha pul harakatlarini kuzatish

**Entity asosiy fieldlar:**
- `price` — tranzaksiya summasi
- `type` — CashFlowEnum (INCOME / EXPENDITURE)
- `tip` — CashflowTipEnum (to'lov turi)
- `is_online` — onlayn to'lov
- `is_cancelled` — bekor qilingan
- `is_static` — statik tranzaksiya
- `parent/child` — bekor qilish/qaytarish uchun ierarxik struktura

**⚠️ O'ZGARTIRMASLIK:**
- Parent-child cashflow ierarxiyasi (bekor qilishda child cashflow yaratiladi)
- `opening_balance < 0` bo'lsa `in_hand` ga qo'shish logikasi (commit: c2ca0da)

---

### 5. KASSA MODULI (`src/modules/kassa/`)

**Asosiy vazifa:** Kassa sessiyalarini boshqarish

**Entity asosiy fieldlar:**
- `startDate, endDate` — sessiya vaqtlari
- `status` — KassaProgresEnum (OPEN / CLOSED / AWAITING_VERIFICATION)
- `totalSellCount` — tranzaksiyalar soni
- `totalSum` — umumiy daromad
- `totalSize` — sotilgan kv.m.
- `plasticSum` — plastik karta to'lovlari
- `internetShopSum` — onlayn savdo
- `sale, return_sale` — oldinga va qaytarma savdo
- `cash_collection` — yig'ilgan naqd pul
- `discount` — chegirmalar
- `income, expense` — kirim/chiqim
- `in_hand` — yopilish naqd qoldig'i
- `debt_count, debt_kv, debt_sum` — qarz kuzatuvi

**⚠️ O'ZGARTIRMASLIK — ASOSIY FORMULA:**
```
in_hand = totalSum + return_sale - discount - expense + income
```

---

### 6. ORDER MODULI (`src/modules/order/`)

**Asosiy vazifa:** Savdo buyurtmalarini qayta ishlash

**Entity asosiy fieldlar:**
- `status` — OrderEnum (progress / accepted / rejected / canceled)
- `price` — sotish vaqtidagi birlik narxi
- `x` — eni o'lchami
- `kv` — kv.m.
- `additionalProfitSum` — ustama foyda
- `netProfitSum` — sof foyda
- `discountSum` — chegirma summasi
- `managerDiscountSum` — menejer tasdiqlagan chegirma
- `discountPercentage` — chegirma foizi
- `isDebt` — qarz belgisi
- `plasticSum` — plastik karta summasi

**⚠️ O'ZGARTIRMASLIK — FOYDA HISOBLASH:**
```
additionalProfitSum = (sotishNarxi - tanNarxi) * kv
netProfitSum = additionalProfitSum - discountSum - managerDiscountSum
```

**Order holati o'zgarishi:**
```
progress → accepted / rejected / canceled
```
Holat o'zgarganda cashflow avtomatik yangilanadi.

---

### 7. COLLECTION MODULI (`src/modules/collection/`)

**Asosiy vazifa:** Mahsulot liniyalarini guruhlash (Yozgi kollekciya, Qishki kollekciya va h.k.)

**Entity asosiy fieldlar:**
- `title` — kollekciya nomi (unique)
- `secondPrice, priceMeter, comingPrice` — kollekciya darajasidagi narxlar
- `country, factory` — ishlab chiqarish ma'lumotlari

---

### 8. QRBASE MODULI (`src/modules/qr-base/`)

**Asosiy vazifa:** Mahsulot variantlari / SKU / shtrix-kod boshqaruvi

**Entity asosiy fieldlar:**
- `code` — unique shtrix-kod/SKU
- `status` — ProductStatusEnum (NOT_READY / READY)
- `i_price` — iMarket narxi
- `sizeType` — IMarketSizeTypeEnum (kiyim o'lchami turi)
- `is_active, is_accepted` — holat bayroqlari
- `internetInfo` — iMarket ma'lumotlari (JSON)

---

### 9. FILIAL MODULI (`src/modules/filial/`)

**Asosiy vazifa:** Filiallar, omborlar, dilerlarni boshqarish

**Entity asosiy fieldlar:**
- `title` — filial nomi
- `type` — FilialTypeEnum (FILIAL / WAREHOUSE / DEALER)
- `given, owed` — moliyaviy majburiyatlar
- `isActive` — faol holati
- `manager` — filial menejeri (OneToOne)

**⚠️ O'ZGARTIRMASLIK:**
- WAREHOUSE turi faqat Partiyalar uchun
- W_MANAGER faqat WAREHOUSE filiallariga biriktirilishi mumkin
- Menejer biriktirishdagi rol tekshiruvi

---

### 10. PARTIYA MODULI (`src/modules/partiya/`)

**Asosiy vazifa:** Import partiyalarini kuzatish

**Entity asosiy fieldlar:**
- `country, factory` — kelib chiqish ma'lumotlari
- `partiya_no` — partiya raqami
- `expense` — import xarajati
- `volume` — partiyada jami birliklar soni
- `expensePerKv` — kv.m. boshiga xarajat
- `partiya_status` — PartiyaStatusEnum (NEW / IN_PROCESS / COMPLETED)

**⚠️ O'ZGARTIRMASLIK:**
- Faqat WAREHOUSE filiallar bilan bog'lash mumkin
- Holat ketma-ketligi: NEW → IN_PROCESS → COMPLETED
- Partiya mahsulotlari batch_title va partiya referansini meros oladi

---

### 11. REPORT MODULI (`src/modules/report/`)

**Asosiy vazifa:** Oylik moliyaviy xulosalar

**Entity asosiy fieldlar:**
- `year, month` — davr
- `totalSellCount` — tranzaksiyalar soni
- `additionalProfitTotalSum` — ustama foyda jami
- `totalSale, totalSaleReturn` — savdo va qaytarma
- `totalCashCollection` — yig'ilgan naqd pul
- `totalDiscount` — jami chegirmalar
- `in_hand` — yopilish naqd qoldig'i
- `status` — ReportProgresEnum (OPEN / PENDING / APPROVED / REJECTED)

---

### 12. KASSAREPORT MODULI (`src/modules/kassa-report/`)

**Asosiy vazifa:** Filial darajasidagi oylik hisobot

**Qo'shimcha fieldlar:**
- `opening_balance` — boshlang'ich qoldiq
- `isAccountantConfirmed` — buxgalter tasdiqlash
- `isMManagerConfirmed` — menejer tasdiqlash
- `filialType` — FILIAL yoki DEALER turi

---

### 13. TRANSFER MODULI (`src/modules/transfer/`)

**Asosiy vazifa:** Filiallar o'rtasida mahsulot harakatini kuzatish

**Entity asosiy fieldlar:**
- `count` — o'tkazilgan miqdor
- `progres` — TransferProgresEnum (progress / accept_f / accept_t)
- `comingPrice, oldComingPrice` — o'tkazishdagi narxlar
- `kv` — kv.m.
- `for_dealer` — diler o'tkazmasi bayrog'i

**O'tkazma oqimi:**
```
Manba filial (count--) → Transfer (tranzitda) → Manzil filial (count++)
```

---

### 14. REINVENTORY MODULI (`src/modules/re-inventory/`)

**Asosiy vazifa:** Inventar sanash tuzatishlari

**Entity asosiy fieldlar:**
- `count` — tuzatilgan miqdor
- `y` — tuzatish miqdori
- `check_count` — tekshirilgan mahsulotlar
- `comingPrice` — tannarx asosi

FilialReport bilan bog'liq (audit izi uchun).

---

### 15. PACKAGETRANSFER MODULI (`src/modules/package-transfer/`)

**Asosiy vazifa:** Diler buyurtmalari uchun paket o'tkazmalar

**Entity asosiy fieldlar:**
- `status` — PackageTransferEnum (Progress / InTransit / Delivered)
- `total_kv, total_profit_sum, total_sum` — jami ko'rsatkichlar
- `total_count` — mahsulotlar soni

---

### 16. CLIENTORDER MODULI (`src/modules/client-order/`)

**Asosiy vazifa:** iMarket orqali onlayn buyurtmalar

**Entity asosiy fieldlar:**
- `payment_type` — IN_HAND yoki PAYME
- `pre_payment` — oldindan to'lov
- `payment_status` — ClientOrderStatusEnum (UN_PAYED / PAYED / PARTIAL)
- `order_status` — OrderStatusEnum (NEW / IN_PROCESS / CANCELLED / DONE)
- `delivery` — yetkazib berish kerakmi
- `city, district, full_address` — yetkazib berish manzili

---

### 17. PLANYEAR MODULI (`src/modules/plan-year/`)

**Asosiy vazifa:** Yillik savdo maqsadlari ierarxiyasi

**Entity asosiy fieldlar:**
- `year` — maqsad yili
- `yearlyGoal` — yillik maqsad summasi
- `collectedAmount` — erishilgan summa

**⚠️ O'ZGARTIRMASLIK:**
- Ierarxik tuzilma: Kompaniya → Filiallar → Sotuvchilar
- Maqsad o'zgarishlari pastga kaskadlanadi
- SELLER user yaratilganda avtomatik plan yaratiladi
- `createPlanForSingleSeller()` — individual sotuvchi maqsadlari

---

### 18. DEBT MODULI (`src/modules/debt/`)

**Asosiy vazifa:** Kredit sotuvlarda qarz kuzatuvi

**Entity asosiy fieldlar:**
- `fullName` — mijoz ismi
- `phone` — telefon raqami
- `given` — berilgan kredit miqdori
- `owed` — to'lanmagan summa
- `totalDebt` — umumiy qarz
- `number_debt` — avto-oshuvchi qarz raqami

---

### 19. BOOKING MODULI (`src/modules/booking/`)

**Asosiy vazifa:** Mahsulot band qilish

**⚠️ O'ZGARTIRMASLIK:**
- `Product.booking_count` — band qilingan mahsulotlarni kuzatadi
- Mavjud miqdor = `count - booking_count`

---

### 20. EXCEL MODULI (`src/modules/excel/`)

**Asosiy vazifa:** Excel import/eksport

---

## ASOSIY MA'LUMOTLAR OQIMI

### Savdo oqimi:
```
Sotuvchi → Order (mahsulot, narx, sotuvchi, kassir)
              ↓
           Kassa (savdo jami yig'adi)
              ↓
           Cashflow (to'lov qayd etish)
              ↓
           Product (inventar yangilash: count--)
              ↓
           Report (oylik agregatsiya)
```

### Inventar o'tkazmasi:
```
Manba Filial (Product.count--)
              ↓
           Transfer (tranzitda)
              ↓
Manzil Filial (Product.count++)
              ↓
           Report (tuzatish)
```

### Moliyaviy hisobot:
```
Order → Cashflow → KassaReport → Report → BossReport
           ↓
        Debt (kredit kuzatuvi)
```

---

## DATABASE IERARXIYASI

```
Filial
├── Kassa (kassa sessiyalari)
│   └── Order (savdolar)
│       └── Cashflow (to'lovlar)
├── User (xodimlar)
│   ├── Order (sotuvchi/kassir sifatida)
│   ├── Cashflow (ishlovchi sifatida)
│   ├── Report (egasi sifatida)
│   └── PlanYear (maqsadlar)
├── Product (inventar)
│   ├── Transfer
│   ├── Order
│   ├── Booking
│   └── ReInventory
└── Report (oylik xulosa)
    ├── KassaReport (filial bo'yicha)
    │   └── Cashflow
    └── Debt (kredit savdolari)

QrBase (SKU/shtrix-kod)
├── Model
├── Collection
├── Product
└── Orders
```

---

## ⚠️ HECH QACHON O'ZGARTIRMASLIK KERAK BO'LGAN JOYLAR

### 1. Autentifikatsiya logikasi
| Fayl | Sabab |
|---|---|
| `src/modules/auth/auth.service.ts` | Token yaratish, OTP logikasi |
| `src/modules/auth/passport-strategies/` | JWT strategiyalar |

### 2. Moliyaviy hisob-kitoblar
| Fayl | Sabab |
|---|---|
| `src/modules/order/order.service.ts` | Foyda hisoblash |
| `src/modules/kassa/kassa.service.ts` | Balans hisoblash |
| `src/modules/cashflow/cashflow.service.ts` | Cashflow agregatsiya |

### 3. Hisobot va agregatsiya
| Fayl | Sabab |
|---|---|
| `src/modules/report/report.service.ts` | Oylik agregatsiya |
| `src/modules/kassa-report/kassa-report.service.ts` | Filial hisobotlari |
| `src/modules/plan-year/plan-year.service.ts` | Maqsad kaskadlanishi |

### 4. Ma'lumotlar yaxlitligi
| Fayl | Sabab |
|---|---|
| `src/modules/user/user.service.ts` | Rolga asoslangan kirishni boshqarish |
| `src/modules/product/product.service.ts` | Inventar holati |

---

## KRITIK FORMULALAR (QAYTA TEKSHIRISH ZARUR)

```typescript
// 1. Kassa yopilish qoldig'i
in_hand = totalSum + return_sale - discount - expense + income

// 2. Agar boshlang'ich qoldiq manfiy bo'lsa (commit: c2ca0da)
if (opening_balance < 0) {
  in_hand += Math.abs(opening_balance)
}

// 3. Foyda hisoblash
additionalProfitSum = (sotishNarxi - tanNarxi) * kv
netProfitSum = additionalProfitSum - discountSum - managerDiscountSum

// 4. Mavjud mahsulot miqdori
mavjud_miqdor = product.count - product.booking_count
```

---

## INFRA HELPERS (`src/infra/helpers/`)

| Helper | Vazifa |
|---|---|
| `idGenerator()` | UUID-like ID yaratish |
| `hashPassword()` | Bcrypt parol xashlash |
| `generate6DigitCodeString()` | OTP yaratish |
| `sizeParser()` | Kiyim o'lchamlarini tahlil qilish |
| `partiyaDateSort()` | Partiya sanalarini saralash |
| `paginateArray()` | Array paginatsiya |
| `ColumnNumericTransformer` | Decimal aniqlik transformer |
| `multerStorage` | Fayl yuklash konfiguratsiyasi |

---

## MIDDLEWARE

| Fayl | Vazifa |
|---|---|
| `product-query-parser` | Mahsulot filterlarini tahlil qilish |
| `order-query-parser` | Buyurtma filterlarini tahlil qilish |
| `kassa-query-parser` | Kassa filterlarini tahlil qilish |
| `booking-query-parser` | Band qilish filterlarini tahlil qilish |
| `transfer-query-parser` | O'tkazma filterlarini tahlil qilish |

---

## TASHQI INTEGRATSIYALAR

| Xizmat | Maqsad |
|---|---|
| **Redis** | OTP (180 soniya), sessiya keshlash, performance |
| **Minio (S3)** | Fayl saqlash |
| **Telegram** | Xabarnomalar |
| **Socket.io** | Real-time yangilanishlar (GRMGateway) |
| **pg_dump** | Database zaxira nusxa |

---

## MUHIT O'ZGARUVCHILARI

Loyiha `.env` fayl talab qiladi:
- Database (PostgreSQL ulanish)
- JWT sirlari (access + refresh token)
- Redis ulanishi
- Minio konfiguratsiyasi
- Telegram bot token

---

## SWAGGER

API hujjatlari: `/docs` manzilida mavjud

---

## XULOSA

Bu tizim kiyim-kechak chakana savdosini boshqarish uchun yaratilgan (GRM UZ). Asosiy komponentlar:

1. **Inventar** — mahsulot zaxiralarini kuzatish, o'tkazmalar, partiyalar
2. **Savdo** — buyurtmalar, kassalar, to'lovlar, qarzlar
3. **Hisobot** — oylik moliyaviy va inventar hisobotlari
4. **iMarket** — onlayn do'kon integratsiyasi (OTP login, buyurtmalar)
5. **Rejalashtirish** — yillik savdo maqsadlari ierarxiyasi
6. **Foydalanuvchilar** — 12 roldan iborat rol tizimi
