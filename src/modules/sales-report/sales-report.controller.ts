import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SalesReportService } from './sales-report.service';
import { SalesQueryDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Sales Report')
@Controller('sales-report')
export class SalesReportController {
  constructor(private readonly service: SalesReportService) {}

  /**
   * Filial sales report. F_MANAGER is auto-scoped to their own filial (drill-down only).
   */
  @Get('filial')
  @Roles(
    UserRoleEnum.F_MANAGER,
    UserRoleEnum.W_MANAGER,
    UserRoleEnum.M_MANAGER,
    UserRoleEnum.BOSS,
  )
  @ApiOperation({ summary: 'Filial sales (top-level + drill-down)' })
  @ApiOkResponse({ description: 'Filial sales returned' })
  @HttpCode(HttpStatus.OK)
  async getFilialSales(
    @Query() dto: SalesQueryDto,
    @CurrentUser() user: any,
  ) {
    const role: number = user?.position?.role ?? user?.role ?? 0;

    // F_MANAGER / W_MANAGER can only see their own filial
    if (role <= UserRoleEnum.W_MANAGER) {
      dto.filialId = user?.filial?.id;
      dto.groupBy = dto.groupBy || 'country';
    }

    return this.service.getFilialSales(dto);
  }

  /**
   * Internet (market) sales report.
   */
  @Get('internet')
  @Roles(
    UserRoleEnum.I_MANAGER,
    UserRoleEnum.M_MANAGER,
    UserRoleEnum.BOSS,
  )
  @ApiOperation({ summary: 'Internet sales (top-level + drill-down)' })
  @ApiOkResponse({ description: 'Internet sales returned' })
  @HttpCode(HttpStatus.OK)
  async getInternetSales(
    @Query() dto: SalesQueryDto,
    @CurrentUser() user: any,
  ) {
    const role: number = user?.position?.role ?? user?.role ?? 0;

    if (role < UserRoleEnum.I_MANAGER) {
      throw new ForbiddenException();
    }

    return this.service.getInternetSales(dto);
  }

  /**
   * Dealer sales report — M_MANAGER / BOSS only.
   */
  @Get('dealer')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Dealer sales (top-level + drill-down)' })
  @ApiOkResponse({ description: 'Dealer sales returned' })
  @HttpCode(HttpStatus.OK)
  async getDealerSales(
    @Query() dto: SalesQueryDto,
    @CurrentUser() user: any,
  ) {
    const role: number = user?.position?.role ?? user?.role ?? 0;

    if (role < UserRoleEnum.M_MANAGER) {
      throw new ForbiddenException();
    }

    return this.service.getDealerSales(dto);
  }

  /**
   * Partiya sales report — M_MANAGER / BOSS only.
   */
  @Get('partiya')
  @Roles(UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @ApiOperation({ summary: 'Partiya sales (top-level + drill-down)' })
  @ApiOkResponse({ description: 'Partiya sales returned' })
  @HttpCode(HttpStatus.OK)
  async getPartiyaSales(
    @Query() dto: SalesQueryDto,
    @CurrentUser() user: any,
  ) {
    const role: number = user?.position?.role ?? user?.role ?? 0;

    if (role < UserRoleEnum.M_MANAGER) {
      throw new ForbiddenException();
    }

    return this.service.getPartiyaSales(dto);
  }
}
