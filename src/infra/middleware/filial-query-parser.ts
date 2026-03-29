import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { ILike } from 'typeorm';
import FilialQueryDto from '../shared/dto/filial-query.dto';
import { IsBoolean } from 'class-validator';

function isBooleanString(value: any): boolean {
  return value === 'true' || value === 'false';
}

@Injectable()
class FilialQueryParserMiddleware implements NestMiddleware {
  use(req, res: Response, next: NextFunction) {
    let where: any = {};
    let {
      title,
      type,
      isActive,
    }: FilialQueryDto = req.query;


    if (title) {
      where.title = ILike(`%${title}%`);
    }

    if (type) {
      where.type = type;
    }

    if (isBooleanString(isActive)) {
      where.isActive = isActive;
    }

    req.where = where;
    next();
  }
}

export default FilialQueryParserMiddleware;
