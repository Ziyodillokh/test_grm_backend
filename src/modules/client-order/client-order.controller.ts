import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Pagination } from 'nestjs-typeorm-paginate';

import { ClientOrderService } from './client-order.service';
import { ClientOrder } from './client-order.entity';
import {
  CreateClientOrderDto,
  QueryClientOrderDto,
  UpdateClientOrderDto,
} from './dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Client Order')
@Controller('client-orders')
export class ClientOrderController {
  constructor(private readonly service: ClientOrderService) {}

  @Public()
  @Post('/')
  @ApiOperation({ summary: 'Create client order' })
  @ApiResponse({ status: 201, description: 'Client order created' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateClientOrderDto) {
    return this.service.create(dto);
  }

  @Get('/')
  @ApiOperation({ summary: 'Get all client orders (paginated)' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryClientOrderDto,
  ): Promise<Pagination<ClientOrder>> {
    return this.service.findAll({
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('/for-client')
  @ApiOperation({ summary: 'Get client orders by user' })
  @HttpCode(HttpStatus.OK)
  async findByUser(
    @Query() query: QueryClientOrderDto,
    @CurrentUser('id') userId: string,
  ): Promise<Pagination<ClientOrder>> {
    return this.service.findAllByUser(userId, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get client order by ID' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put('/:id')
  @ApiOperation({ summary: 'Update client order' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientOrderDto,
    @Req() req,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete client order' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
