import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { TransferService } from './transfer.service';
import { Transfer } from './transfer.entity';
import {
  AcceptTransferDto,
  ChangePriceDto,
  CreateTransferBasketDto,
  CreateTransferDto,
  QueryTransferDto,
  UpdateTransferDto,
} from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums';
import { PackageTransferService } from '../package-transfer/package-transfer.service';

@ApiTags('Transfer')
@Controller('transfer')
export class TransferController {
  constructor(
    private readonly transferService: TransferService,
    private readonly packageTransferService: PackageTransferService,
  ) {}

  @Public()
  @Get('/')
  @ApiOperation({ summary: 'Get all transfers (paginated)' })
  @ApiOkResponse({ description: 'Transfers returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryTransferDto,
    @Req() req: any,
  ) {
    return this.transferService.getAll(
      { limit: query.limit, page: query.page },
      req.where || {},
      query.search,
    );
  }

  @Get('/dealer')
  @ApiOperation({ summary: 'Get transfers for a dealer package' })
  @ApiOkResponse({ description: 'Dealer transfers returned successfully' })
  @HttpCode(HttpStatus.OK)
  async getDealerTransfers(@Query() query: any) {
    return this.transferService.getDealerTransfers(query);
  }

  @Post('/give-price')
  @ApiOperation({ summary: 'Set dealer price for collection in package' })
  @ApiOkResponse({ description: 'Price updated' })
  @HttpCode(HttpStatus.OK)
  async givePrice(@Body() dto: ChangePriceDto) {
    return this.transferService.givePrice(dto);
  }

  @Patch('/accept-package/accepted/:id')
  @ApiOperation({ summary: 'Accept a package transfer' })
  @ApiOkResponse({ description: 'Package accepted' })
  @HttpCode(HttpStatus.OK)
  async acceptPackage(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.packageTransferService.changeStatus(id, 'accepted' as any);
  }

  @Patch('/accept-package/rejected/:id')
  @ApiOperation({ summary: 'Reject a package transfer' })
  @ApiOkResponse({ description: 'Package rejected' })
  @HttpCode(HttpStatus.OK)
  async rejectPackage(@Param('id') id: string) {
    return this.packageTransferService.changeStatus(id, 'rejected' as any);
  }

  @Patch('/reject/dealer-transfer/:id')
  @ApiOperation({ summary: 'Reject a single dealer transfer from package' })
  @ApiOkResponse({ description: 'Dealer transfer rejected' })
  @HttpCode(HttpStatus.OK)
  async rejectDealerTransfer(@Param('id') id: string) {
    return this.transferService.rejectDealerTransfer(id);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get transfer by ID' })
  @ApiOkResponse({ description: 'Transfer returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<Transfer> {
    return this.transferService.getById(id);
  }

  @Post('/')
  @ApiOperation({ summary: 'Create new transfers' })
  @ApiCreatedResponse({ description: 'Transfers created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() data: CreateTransferDto[],
    @CurrentUser('id') userId: string,
  ) {
    return this.transferService.create(data, userId);
  }

  @Post('/basket')
  @ApiOperation({ summary: 'Create transfers from basket' })
  @ApiCreatedResponse({ description: 'Transfers created from basket successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createFromBasket(
    @Body() data: CreateTransferBasketDto,
    @CurrentUser() user: any,
  ) {
    return this.transferService.createFromBasket(data, user);
  }

  @Roles(Role.M_MANAGER, Role.BOSS, Role.F_MANAGER, Role.W_MANAGER, Role.I_MANAGER)
  @Put('/accept')
  @ApiOperation({ summary: 'Accept transfers' })
  @ApiOkResponse({ description: 'Transfers accepted' })
  @HttpCode(HttpStatus.OK)
  async acceptTransfer(
    @Body() data: AcceptTransferDto,
    @CurrentUser() user: any,
  ) {
    return this.transferService.acceptTransfer(data, user);
  }

  @Patch('/progress/:from/:to')
  @ApiOperation({ summary: 'Change transfer progress status' })
  @ApiOkResponse({ description: 'Progress changed' })
  @HttpCode(HttpStatus.OK)
  async changeProgress(
    @Param('from') from: string,
    @Param('to') to: string,
  ): Promise<UpdateResult> {
    return this.transferService.changeProgress(from, to);
  }

  @Roles(Role.M_MANAGER, Role.BOSS, Role.F_MANAGER, Role.W_MANAGER)
  @Patch('/reject/:id')
  @ApiOperation({ summary: 'Reject transfer' })
  @ApiOkResponse({ description: 'Transfer rejected' })
  @HttpCode(HttpStatus.OK)
  async rejectTransfer(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transferService.rejectTransfer(id, userId);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Update transfer' })
  @ApiOkResponse({ description: 'Transfer updated' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Body() data: UpdateTransferDto,
    @Param('id') id: string,
  ): Promise<UpdateResult> {
    return this.transferService.update(id, data);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Delete transfer' })
  @ApiOkResponse({ description: 'Transfer deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.transferService.rejectTransfer(id, userId);
    return this.transferService.remove(id);
  }
}
