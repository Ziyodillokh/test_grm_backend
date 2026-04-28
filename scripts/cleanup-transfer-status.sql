-- Transfer.progres column'idagi dead status qiymatlarni 'Processing'ga (Kutilmoqda) yangilash.
-- TransferStatus enum 4 ta qiymatga qisqartirildi: Processing, Accepted, Rejected, Returned.
--
-- Audit (changelar oldin va keyin):
--   SELECT progres, COUNT(*) FROM transfer GROUP BY progres ORDER BY 2 DESC;
--
-- Deploy oldidan bir marta ishga tushiriladi.

BEGIN;

-- Accepted_F → Processing (user qarori: pending kategoriyasiga tushadi)
UPDATE transfer SET progres = 'Processing' WHERE progres = 'Accepted_F';

-- Qolgan dead statuslar (kutilmaydi, ammo himoya uchun)
UPDATE transfer SET progres = 'Processing' WHERE progres IN ('Booked', 'New', 'InProgres', 'other');

-- Verification: keyin faqat 4 ta qiymat qolishi kerak
-- SELECT progres, COUNT(*) FROM transfer GROUP BY progres;

COMMIT;
