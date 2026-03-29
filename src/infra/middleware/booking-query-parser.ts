import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction } from 'express';

@Injectable()
class BookingQueryParserMiddleware implements NestMiddleware {
  use(req, res, next: NextFunction) {
    let where: any = {};
    let relations: any = {};
    let { product, count, filial }: { product: string, count: string, filial: string } = req.query;

    if (count)
      where.count = +count;

    if (product) {
      where.product = { id: product };
    }

    if (filial) {
      where.user = { filial: { id: filial } };
    }


    req.where = where;
    req.relations = relations;
    next();
  }

}

export default BookingQueryParserMiddleware;