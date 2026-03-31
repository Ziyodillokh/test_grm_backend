import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { QrBaseService } from './qr-base.service';
import { CreateQrBaseDto, UpdateQrBaseDto, QueryQrBaseDto } from './dto';
import { QrBase } from './qr-base.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Route } from '../../infra/shared/decorators/route.decorator';

@ApiTags('QrBase')
@Controller('qr-base')
export class QrBaseController {
  constructor(private readonly qrBaseService: QrBaseService) {}

  @Get()
  @Roles(
    Role.BOSS,
    Role.M_MANAGER,
    Role.ACCOUNTANT,
    Role.W_MANAGER,
    Role.F_MANAGER,
    Role.SELLER,
    Role.I_MANAGER,
  )
  @ApiOperation({ summary: 'Get all QR bases with pagination' })
  @ApiOkResponse({ description: 'QR bases returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Route() route: string,
    @Query() query: QueryQrBaseDto,
  ) {
    return this.qrBaseService.findAll(
      { page: query.page, limit: query.limit, route },
      query,
    );
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.M_MANAGER, Role.W_MANAGER, Role.F_MANAGER, Role.SELLER)
  @ApiOperation({ summary: 'Get a QR base by ID' })
  @ApiOkResponse({ description: 'QR base returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<QrBase> {
    return this.qrBaseService.findOne(id);
  }

  @Get('code/:code')
  @Roles(Role.BOSS, Role.M_MANAGER, Role.W_MANAGER, Role.F_MANAGER, Role.SELLER)
  @ApiOperation({ summary: 'Get a QR base by code' })
  @ApiOkResponse({ description: 'QR base returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findByCode(@Param('code') code: string): Promise<QrBase> {
    const entity = await this.qrBaseService.findByCode(code);
    if (!entity) {
      throw new Error(`QrBase with code "${code}" not found`);
    }
    return entity;
  }

  @Post()
  @Roles(Role.BOSS, Role.M_MANAGER, Role.W_MANAGER)
  @ApiOperation({ summary: 'Create a QR base' })
  @ApiCreatedResponse({ description: 'QR base created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateQrBaseDto): Promise<QrBase> {
    return this.qrBaseService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.BOSS, Role.M_MANAGER, Role.W_MANAGER, Role.I_MANAGER)
  @ApiOperation({ summary: 'Update a QR base' })
  @ApiOkResponse({ description: 'QR base updated successfully' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQrBaseDto,
  ): Promise<QrBase> {
    return this.qrBaseService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.M_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a QR base' })
  @ApiOkResponse({ description: 'QR base deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.qrBaseService.remove(id);
  }

  @Patch('restore/:id')
  @Roles(Role.BOSS, Role.M_MANAGER)
  @ApiOperation({ summary: 'Restore a soft-deleted QR base' })
  @ApiOkResponse({ description: 'QR base restored successfully' })
  @HttpCode(HttpStatus.OK)
  async restore(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.qrBaseService.restore(id);
  }
}
