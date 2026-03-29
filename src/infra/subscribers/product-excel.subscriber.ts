import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { ProductExcel } from '../../modules/excel/excel-product.entity';
import { QrBase } from '../../modules/qr-base/qr-base.entity';

@EventSubscriber()
class ProductExcelSubscriber implements EntitySubscriberInterface<ProductExcel> {
  listenTo() {
    return ProductExcel; // Target entity
  }

  // async beforeInsert(event: InsertEvent<ProductExcel>) {
  //   const barcodeId = event.entity?.bar_code;
  //   if (!barcodeId) return;
  //
  //   console.log('insert');
  //   // Fetch related size record
  //   const barcodeRepo = event.manager.getRepository(QrBase);
  //   const barcode = await barcodeRepo.findOne({
  //     where: { id: barcodeId as unknown as string },
  //     relations: { size: true },
  //   });
  //
  //   if (barcode?.size?.title) {
  //     const size = barcode?.size;
  //     const match = size.title.match(/(\d+)x(\d+)/);
  //     if (match) {
  //       event.entity.y = parseInt(match[2]) / 100;
  //     }
  //   }
  // }

  // async beforeUpdate(event: UpdateEvent<ProductExcel>) {
  //   const barcodeId = event.entity?.bar_code;
  //   const y = event.entity?.y;
  //   if (!barcodeId) return;
  //
  //   console.log('updated');
  //   // Fetch related size record
  //   if (barcodeId) {
  //     const barcodeRepo = event.manager.getRepository(QrBase);
  //     const barcode = await barcodeRepo.findOne({
  //       where: { id: barcodeId as unknown as string },
  //       relations: { size: true },
  //     });
  //
  //     if (barcode?.size?.title && !y) {
  //       const size = barcode?.size;
  //       const match = size.title.match(/(\d+)x(\d+)/);
  //       if (match) {
  //         event.entity.y = parseInt(match[2]) / 100;
  //       }
  //     } else if (y) {
  //       event.entity.y = y / 100;
  //     }
  //   }
  // }
}

export default ProductExcelSubscriber;