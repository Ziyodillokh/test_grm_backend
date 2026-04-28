-- Order.status column'idagi 'canceled' qiymatini 'returned'ga ko'chirish.
-- Naming refactor: returnOrder() metodi 'canceled' yozardi — endi 'returned' (semantik to'g'ri).
--
-- DIQQAT: bu skript faqat order jadvali uchun. package_transfer.status'ga tegmaydi
-- (u alohida domain, 'canceled' qiymati o'sha yerda real cancel'ni anglatadi).
--
-- Audit (oldin va keyin):
--   SELECT status, COUNT(*) FROM "order" GROUP BY status ORDER BY 2 DESC;
--
-- Yangi backend kodini deploy qilishdan OLDIN ishga tushirilishi shart,
-- aks holda eski 'canceled' rowlar yangi filterlarga tushmaydi.

BEGIN;

UPDATE "order" SET status = 'returned' WHERE status = 'canceled';

-- Verification: keyin faqat 4 ta qiymat qolishi kerak — progress, accepted, rejected, returned
-- SELECT status, COUNT(*) FROM "order" GROUP BY status;

COMMIT;
