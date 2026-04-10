import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PackageCollectionPriceService } from './package-collection-price.service';
import { UpsertPackageCollectionPriceDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@infra/shared/enum';

@ApiTags('Package Collection Price')
@Controller('package-collection-price')
export class PackageCollectionPriceController {
  constructor(private readonly service: PackageCollectionPriceService) {}

  @Get('package/:packageId')
  @ApiOperation({ summary: 'List per-collection dealer prices for a package' })
  getByPackage(@Param('packageId') packageId: string) {
    return this.service.getByPackage(packageId);
  }

  @Roles(UserRoleEnum.D_MANAGER, UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @Post()
  @ApiOperation({ summary: 'Bulk upsert per-collection dealer prices for a package' })
  upsertMany(@Body() dto: UpsertPackageCollectionPriceDto) {
    return this.service.upsertMany(dto);
  }

  @Roles(UserRoleEnum.D_MANAGER, UserRoleEnum.M_MANAGER, UserRoleEnum.BOSS)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a PackageCollectionPrice row' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
