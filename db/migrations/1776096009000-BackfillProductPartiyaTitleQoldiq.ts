import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillProductPartiyaTitleQoldiq1776096009000 implements MigrationInterface {
  name = 'BackfillProductPartiyaTitleQoldiq1776096009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // (1) Legacy bo'sh title'larni "{filial} qoldiq" bilan to'ldirish
    //     partiyaId IS NULL va partiya_title bo'sh bo'lgan har qanday Product (metric + non-metric)
    await queryRunner.query(`
      UPDATE product p
      SET partiya_title = COALESCE(NULLIF(f.name, ''), f.title) || ' qoldiq'
      FROM filial f
      WHERE p."filialId" = f.id
        AND p."partiyaId" IS NULL
        AND (p.partiya_title IS NULL OR p.partiya_title = '')
        AND p.is_deleted = false
    `);

    // (2) Eski "— ortiqcha" yozuvlarini "qoldiq" ga ko'chirish (atama unify)
    await queryRunner.query(`
      UPDATE product p
      SET partiya_title = COALESCE(NULLIF(f.name, ''), f.title) || ' qoldiq'
      FROM filial f
      WHERE p."filialId" = f.id
        AND p."partiyaId" IS NULL
        AND p.partiya_title LIKE '% — ortiqcha'
        AND p.is_deleted = false
    `);
  }

  public async down(): Promise<void> {
    // No-op: title rollback'i informatsion zarar bo'ladi
    // (qaysi yozuv backfill bo'lganini bilmaymiz)
  }
}
