import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InventoryReportService } from './inventory-report.service';
import { FilialSnapshotQueryDto, PartiyaSnapshotQueryDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Inventory Report')
@Controller('inventory-report')
export class InventoryReportController {
  constructor(private readonly service: InventoryReportService) {}

  /**
   * Filial inventory snapshot. F_MANAGER is auto-scoped to their own filial.
   * M_MANAGER / BOSS can pass any filialId (or omit for all filials).
   */
  @Get('filial-snapshot')
  @Roles(
    UserRoleEnum.F_MANAGER,
    UserRoleEnum.W_MANAGER,
    UserRoleEnum.M_MANAGER,
    UserRoleEnum.BOSS,
  )
  @ApiOperation({ summary: 'Filial inventory snapshot (grouped, drill-down)' })
  @ApiOkResponse({ description: 'Snapshot returned' })
  @HttpCode(HttpStatus.OK)
  async getFilialSnapshot(
    @Query() dto: FilialSnapshotQueryDto,
    @CurrentUser() user: any,
  ) {
    const role: number = user?.position?.role ?? user?.role ?? 0;

    // F_MANAGER / W_MANAGER can only see their own filial
    if (role <= UserRoleEnum.W_MANAGER) {
      dto.filialId = user?.filial?.id;
    }

    return this.service.getFilialSnapshot(dto);
  }

  /**
   * Partiya snapshot — only M_MANAGER / BOSS.
   * Lists partiyas of a given year with initial / sold / remaining.
   */
  @Get('partiya-snapshot')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Partiya inventory snapshot (M_MANAGER / BOSS)' })
  @ApiOkResponse({ description: 'Partiya snapshot returned' })
  @HttpCode(HttpStatus.OK)
  async getPartiyaSnapshot(
    @Query() dto: PartiyaSnapshotQueryDto,
    @CurrentUser() user: any,
  ) {
    const role: number = user?.position?.role ?? user?.role ?? 0;

    if (role < UserRoleEnum.M_MANAGER) {
      throw new ForbiddenException();
    }

    return this.service.getPartiyaSnapshot(dto);
  }
}
