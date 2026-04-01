import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import configuration from '../config';
import { IsUniqueConstraint } from './infra/shared/decorators/is-unique.constrain';
import { RedisProvider } from './redis/redis.provider';

// ─── Modules ────────────────────────────────────────────────────────
import { AccountingModule } from './modules/accounting/accounting.module';
import { AuthModule } from './modules/auth/auth.module';
import { AwardModule } from './modules/award/award.module';
import { BannerModule } from './modules/banner/banner.module';
import { BonusModule } from './modules/bonus/bonus.module';
import { BookingModule } from './modules/booking/booking.module';
import { BossReportModule } from './modules/boss-report/boss-report.module';
import { CashflowModule } from './modules/cashflow/cashflow.module';
import { CashflowTypeModule } from './modules/cashflow-type/cashflow-type.module';
import { ChatModule } from './modules/chatgpt/chatgpt.module';
import { ClientModule } from './modules/client/client.module';
import { ClientOrderModule } from './modules/client-order/client-order.module';
import { ClientOrderItemModule } from '@modules/client-order-item/client-order-item.module';
import { ClientRequestModule } from './modules/client-request/client-request.module';
import { CollectionModule } from './modules/collection/collection.module';
import { CollectionPriceModule } from './modules/collection-price/collection-price.module';
import { CollectionReportItemModule } from './modules/collection-report-item/collection-report-item.module';
import { ColorModule } from './modules/color/color.module';
import { ContactModule } from './modules/contact/contact.module';
import { CountryModule } from './modules/country/country.module';
import { CountryReportItemModule } from './modules/country-report-item/country-report-item.module';
import { CronTaskModule } from './modules/cron-task/cron-task.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { DataSenderModule } from './modules/data-sender/data-sender.module';
import { DealerTransactionModule } from './modules/dealer-transaction/dealer-transaction.module';
import { DealerTransactionItemModule } from './modules/dealer-transaction_item/dealer-transaction_item.module';
import { DebtModule } from './modules/debt/debt.module';
import { DiscountModule } from './modules/discount/discount.module';
import { ExcelModule } from './modules/excel/excel.module';
import { FactoryModule } from './modules/factory/factory.module';
import { FactoryReportItemModule } from './modules/factory-report-item/factory-report-item.module';
import { FileModule } from './modules/file/file.module';
import { FilialModule } from './modules/filial/filial.module';
import { FilialPlanModule } from '@modules/filial-plan/filial-plan.module';
import { FilialReportModule } from './modules/filial-report/filial-report.module';
import { GrmSocketModule } from './modules/web-socket/web-socket.module';
import { IncrementModule } from './modules/increment/increment.module';
import { KassaModule } from './modules/kassa/kassa.module';
import { MagazinInfoModule } from './modules/magazin-info/magazin-info.module';
import { MediaModule } from './modules/media/media.module';
import { ModelModule } from './modules/model/model.module';
import { NoteModule } from './modules/note/note.module';
import { OrderModule } from './modules/order/order.module';
import { OrderBasketModule } from './modules/order-basket/order-basket.module';
import { PaperReportModule } from './modules/paper-report/paper-report.module';
import { PartiyaModule } from './modules/partiya/partiya.module';
import { PartiyaNumberModule } from './modules/partiya_number/partiya_number.module';
import { PartiyaStatusModule } from './modules/partiya-status/partiya-status.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PayrollItemsModule } from './modules/payroll-items/payroll-items.module';
import { PlanYearModule } from './modules/plan-year/plan-year.module';
import { PositionModule } from './modules/position/position.module';
import { ProductModule } from './modules/product/product.module';
import { ProductHistoryModule } from './modules/product-history/product-history.module';
import { QrBaseModule } from './modules/qr-base/qr-base.module';
import { QrCodeModule } from './modules/qr-code/qr-code.module';
import { ReInventoryModule } from '@modules/re-inventory/re-inventory.module';
import { ReportsModule } from './modules/report/report.module';
import { RestoreModule } from './modules/restore/restore.module';
import { SellerReportModule } from './modules/seller-report/seller-report.module';
import { SellerReportItemModule } from './modules/seller-report-item/seller-report-item.module';
import { ShapeModule } from './modules/shape/shape.module';
import { SizeModule } from './modules/size/size.module';
import { StorageModule } from './modules/backup/backup.module';
import { StyleModule } from './modules/style/style.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { TransferCacheModule } from './modules/transfer-cache/transfer-cache.module';
import { UserModule } from './modules/user/user.module';
import { UserTimeLogModule } from './modules/user-time-log/user-time-log.module';
import { VideoMessageModule } from './modules/video-message/video-message.module';

@Module({
  imports: [
    // ─── Infrastructure ───────────────────────────────────────────
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('database'),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
    }),

    // ─── Core ─────────────────────────────────────────────────────
    AuthModule,
    UserModule,
    FilialModule,
    PositionModule,
    ProductModule,
    QrBaseModule,
    QrCodeModule,

    // ─── Catalog / Data Library ───────────────────────────────────
    CollectionModule,
    CollectionPriceModule,
    ColorModule,
    CountryModule,
    FactoryModule,
    ModelModule,
    ShapeModule,
    SizeModule,
    StyleModule,
    BannerModule,
    MagazinInfoModule,
    CurrencyModule,
    DiscountModule,

    // ─── Supply Chain ─────────────────────────────────────────────
    PartiyaModule,
    PartiyaNumberModule,
    PartiyaStatusModule,
    TransferModule,
    TransferCacheModule,

    // ─── Sales & Orders ───────────────────────────────────────────
    OrderModule,
    OrderBasketModule,
    BookingModule,
    ClientOrderModule,
    ClientOrderItemModule,

    // ─── Payments & Finance ───────────────────────────────────────
    KassaModule,
    CashflowModule,
    CashflowTypeModule,
    AccountingModule,
    DebtModule,

    // ─── CRM ──────────────────────────────────────────────────────
    ClientModule,
    ClientRequestModule,

    // ─── Dealers ──────────────────────────────────────────────────
    DealerTransactionModule,
    DealerTransactionItemModule,

    // ─── HR & Payroll ─────────────────────────────────────────────
    PayrollModule,
    PayrollItemsModule,
    AwardModule,
    BonusModule,
    UserTimeLogModule,

    // ─── Reports ──────────────────────────────────────────────────
    ReportsModule,
    SellerReportModule,
    SellerReportItemModule,
    BossReportModule,
    FilialReportModule,
    CollectionReportItemModule,
    FactoryReportItemModule,
    CountryReportItemModule,
    PaperReportModule,

    // ─── Planning ─────────────────────────────────────────────────
    PlanYearModule,
    FilialPlanModule,

    // ─── Inventory ────────────────────────────────────────────────
    ProductHistoryModule,
    ReInventoryModule,

    // ─── Platform Services ────────────────────────────────────────
    MediaModule,
    FileModule,
    ExcelModule,
    NoteModule,
    ContactModule,
    GrmSocketModule,
    ChatModule,
    DataSenderModule,
    IncrementModule,
    CronTaskModule,
    RestoreModule,
    StorageModule,

    // ─── Messaging ────────────────────────────────────────────────
    VideoMessageModule,
  ],
  providers: [IsUniqueConstraint, RedisProvider],
  exports: [RedisProvider],
})
export class AppModule {}
