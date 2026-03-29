import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AwardService } from './award.service';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { Award } from './award.entity';
import { Pagination } from 'nestjs-typeorm-paginate';

@ApiTags('Awards')
@Controller('awards')
export class AwardController {
  constructor(private readonly awardService: AwardService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new award' })
  @ApiResponse({ status: 201, type: Award })
  async create(@Body() dto: CreateAwardDto): Promise<Award> {
    return this.awardService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all awards with pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: [Award] })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10): Promise<Pagination<Award>> {
    limit = Math.min(limit, 100);
    return await this.awardService.findAll({ page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific award by ID' })
  @ApiResponse({ status: 200, type: Award })
  async findOne(@Param('id') id: string): Promise<Award> {
    return await this.awardService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an award' })
  @ApiResponse({ status: 200, type: Award })
  async update(@Param('id') id: string, @Body() dto: UpdateAwardDto): Promise<Award> {
    return await this.awardService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an award' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.awardService.remove(id);
  }

  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore deleted award' })
  @ApiParam({ name: 'id', type: String })
  async restore(@Param('id') id: string): Promise<{ message: string }> {
    await this.awardService.restore(id);
    return { message: 'Award successfully restored' };
  }
}
