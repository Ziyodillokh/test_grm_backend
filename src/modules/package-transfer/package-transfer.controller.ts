import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpCode, HttpStatus, Query, Patch, Param, Body, Delete, Post } from '@nestjs/common';
import { PackageTransferService } from '@modules/package-transfer/package-transfer.service';
import PaginationDto from '../../infra/shared/dto/pagination.dto';

@ApiTags('package-transfer')
@Controller('package-transfer')
export class PackageTransferController {
  constructor(private readonly service: PackageTransferService) {
  }

  @Get('/')
  @ApiOperation({ summary: 'Method: returns all partiya' })
  @ApiOkResponse({
    description: 'The partiya were returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query) {
    return await this.service.getAll(query)
  }

  @Patch('/:id/change-status')
  @ApiOperation({ summary: 'Method: change status' })
  @ApiOkResponse({
    description: 'The status was changed successfully',
  })
  @HttpCode(HttpStatus.OK)
  async changeStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return await this.service.changeStatus(id, body.status as any);
  }

  @Delete('/:pkgId/transfer/:transferId')
  @ApiOperation({ summary: 'Cancel a transfer from a package (before accept)' })
  @HttpCode(HttpStatus.OK)
  async cancelTransfer(
    @Param('pkgId') pkgId: string,
    @Param('transferId') transferId: string,
  ) {
    return await this.service.cancelTransferFromPackage(pkgId, transferId);
  }

  @Post('/:pkgId/transfer/:transferId/return')
  @ApiOperation({ summary: 'Return a transfer from an accepted package (vazvrat)' })
  @HttpCode(HttpStatus.OK)
  async returnTransfer(
    @Param('pkgId') pkgId: string,
    @Param('transferId') transferId: string,
    @Body() body: { targetFilialId: string },
  ) {
    return await this.service.returnTransferFromPackage(
      pkgId,
      transferId,
      body.targetFilialId,
    );
  }
}
