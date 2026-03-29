import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface TransformedResponse<T> {
  data: T;
  meta?: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformedResponse<T>> {
    return next.handle().pipe(
      map((responseData) => {
        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData &&
          'meta' in responseData
        ) {
          return responseData;
        }

        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData &&
          'total' in responseData
        ) {
          const { data, total, page, limit, ...rest } = responseData;
          return {
            data,
            meta: {
              total,
              page,
              limit,
              totalPages: limit ? Math.ceil(total / limit) : 1,
              ...rest,
            },
          };
        }

        return { data: responseData };
      }),
    );
  }
}
