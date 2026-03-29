import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { In } from 'typeorm';
import { TransferQueryDto } from '../shared/dto';

@Injectable()
class   TransferQueryParserMiddleware implements NestMiddleware {
  use(req, res: Response, next: NextFunction) {
    let where: any = {};
    let relations: any = {};
    const {
      startDate,
      endDate,
      size,
      collectionId,
      type,
      progress,
      filial,
      model,
      to,
      from,
      courier,
      search,
      package_transfer,
    }: TransferQueryDto = req.query;

    if (startDate && endDate) {
      where.date = {
        type: 'between',
        value: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      where.date = {
        type: 'gte',
        value: new Date(startDate),
      };
    } else if (endDate) {
      where.date = {
        type: 'lte',
        value: new Date(endDate),
      };
    }

    if (collectionId || model || size) {
      where.product = {
        ...(size && JSON.parse(size).length && { size: In(JSON.parse(size)) }),
        ...(where?.product && where.product),
        model: {
          ...(model?.length && JSON.parse(model).length && { id: In(JSON.parse(model)) }),
          ...(collectionId?.length && JSON.parse(collectionId).length && {
            collection: {
              id: In(JSON.parse(collectionId)),
            },
          }),
        },
      };
    }

    // if(filial){
    //   where.filial = filial;
    // }

    if (progress) {
      try {
        where.progress = In(progress);
      } catch (e) {
        throw new BadRequestException(e.message);
      }
    }

    // if(type){
    //   where.type = type;
    // }

    if (to) {
      where.to = { id: to };
    }

    if (from) {
      where.from = { id: from };
    }

    if (courier) {
      where.courier = {
        id: courier,
      };
    }

    if (package_transfer) {
      where.package = { id: package_transfer };
    }


    req.where = where;
    req.relations = relations;
    next();
  }
}

export default TransferQueryParserMiddleware;
