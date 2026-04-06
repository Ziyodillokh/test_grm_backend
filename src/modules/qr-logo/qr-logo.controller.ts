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
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { QrLogoService } from './qr-logo.service';
import { CreateQrLogoDto, UpdateQrLogoDto, QueryQrLogoDto } from './dto';
import { QrLogo } from './qr-logo.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import UserRoleEnum from '../../infra/shared/enum/user-role.enum';

@ApiTags('QR Logo')
@Controller('qr-logo')
export class QrLogoController {
  constructor(private readonly service: QrLogoService) {}

  @Post()
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.I_MANAGER)
  @ApiOperation({ summary: 'Create a new QR logo' })
  @ApiCreatedResponse({ description: 'QR logo created' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateQrLogoDto): Promise<QrLogo> {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.I_MANAGER)
  @ApiOperation({ summary: 'Get all QR logos with pagination' })
  @ApiOkResponse({ description: 'QR logos returned' })
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryQrLogoDto) {
    return this.service.findAll(
      { page: query.page || 1, limit: query.limit || 20 },
      query,
    );
  }

  @Public()
  @Get('random')
  @ApiOperation({ summary: 'Get a random active QR logo (public)' })
  @ApiOkResponse({ description: 'Random QR logo returned' })
  @HttpCode(HttpStatus.OK)
  async getRandomActive(): Promise<QrLogo | null> {
    return this.service.getRandomActive();
  }

  @Get(':id')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.I_MANAGER)
  @ApiOperation({ summary: 'Get a QR logo by ID' })
  @ApiOkResponse({ description: 'QR logo returned' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<QrLogo> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.I_MANAGER)
  @ApiOperation({ summary: 'Update a QR logo' })
  @ApiOkResponse({ description: 'QR logo updated' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQrLogoDto,
  ): Promise<QrLogo> {
    return this.service.update(id, dto);
  }

  @Patch(':id/toggle')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.I_MANAGER)
  @ApiOperation({ summary: 'Toggle QR logo active status' })
  @ApiOkResponse({ description: 'Status toggled' })
  @HttpCode(HttpStatus.OK)
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string): Promise<QrLogo> {
    return this.service.toggleStatus(id);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.BOSS, UserRoleEnum.M_MANAGER, UserRoleEnum.I_MANAGER)
  @ApiOperation({ summary: 'Delete a QR logo (soft delete)' })
  @ApiOkResponse({ description: 'QR logo deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
