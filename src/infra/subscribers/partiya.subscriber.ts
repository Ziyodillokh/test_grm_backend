import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { Partiya } from '../../modules/partiya/partiya.entity';
import { PartiyaStatusService } from '../../modules/partiya-status/partiya-status.service';


@EventSubscriber()
class PartiyaSubscriber implements EntitySubscriberInterface<Partiya> {
  constructor(
    private readonly partiyaStatusService: PartiyaStatusService
  ) {
  }

  listenTo() {
    return Partiya;
  }

  async beforeInsert(event: InsertEvent<Partiya>) {
    // console.log('await this.partiyaStatusService', await this.partiyaStatusService);
    // console.log('event', event);
    // event.entity.partiya_status = await this.partiyaStatusService.getOneBySlug(PartiyaStatusEnum.NEW);
  }
}

export default PartiyaSubscriber;