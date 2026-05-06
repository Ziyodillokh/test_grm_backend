import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ShareService } from './share.service';
import { CreateShareDto } from './dto/create-share.dto';
import { UpdateShareDto } from './dto/update-share.dto';
import { ShareReportQueryDto } from './dto/share-report-query.dto';
import { ShareDetailQueryDto } from './dto/share-detail-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Share')
@Controller('share')
export class ShareController {
  constructor(private readonly service: ShareService) {}

  @Get()
  @ApiOperation({ summary: 'Sheriklarni paginated list' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 100) {
    return this.service.findAll({ page: Number(page), limit: Number(limit) });
  }

  @Get('report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Sherikchilik hisoboti — top-level' })
  async getReport(@Query() dto: ShareReportQueryDto) {
    return this.service.getShareReport(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/report')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.ACCOUNTANT, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Sherik detail — cashflow tarixi' })
  async getDetail(@Param('id') id: string, @Query() dto: ShareDetailQueryDto) {
    return this.service.getShareDetailReport(id, dto);
  }

  @Post()
  async create(@Body() dto: CreateShareDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateShareDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
