import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { PartiyaStatusService } from './partiya-status.service';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartiyaStatus } from './partiya-status.entity';
import { CreatePartiyaStatusDto } from './dto';

@ApiTags('Partiya-Status')
@Controller('partiya-status')
export class PartiyaStatusController {
  constructor(
    private readonly service: PartiyaStatusService,
  ) {
  }

  @Get()
  @ApiOperation({ summary: 'Method: returns all data' })
  @ApiOkResponse({
    description: 'The data was returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getAll(): Promise<PartiyaStatus[]> {
    return await this.service.getAll();
  }

  @Post('/')
  @ApiOperation({ summary: 'Method: creates new data' })
  @ApiCreatedResponse({
    description: 'The data was created successfully',
  })
  @HttpCode(HttpStatus.CREATED)
  async saveData(@Body() data: CreatePartiyaStatusDto): Promise<PartiyaStatus> {
    return await this.service.create(data);
  }

  @Delete('/:id')
  @ApiOperation({ summary: 'Method: deleting data' })
  @ApiOkResponse({
    description: 'Data was deleted',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteData(@Param('id') id: string) {
    return await this.service.deleteOne(id);
  }
}
