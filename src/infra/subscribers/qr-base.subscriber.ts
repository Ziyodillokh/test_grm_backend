import { EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { QrBase } from '../../modules/qr-base/qr-base.entity';


@EventSubscriber()
class QrBaseSubscriber implements EntitySubscriberInterface<QrBase> {
  listenTo() {
    return QrBase;
  }
}

export default QrBaseSubscriber;