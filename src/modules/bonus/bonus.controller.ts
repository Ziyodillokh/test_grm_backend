import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BonusService } from './bonus.service';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { UpdateBonusDto } from './dto/update-bonus.dto';
import { Bonus } from './bonus.entity';
import { Pagination } from 'nestjs-typeorm-paginate';

@ApiTags('Bonus')
@Controller('bonus')
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bonus' })
  @ApiResponse({ status: 201, description: 'Bonus successfully created', type: Bonus })
  create(@Body() createBonusDto: CreateBonusDto): Promise<Bonus> {
    return this.bonusService.create(createBonusDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bonuses with pagination' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  @ApiResponse({ status: 200, description: 'List of bonuses', type: [Bonus] })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10): Promise<Pagination<Bonus>> {
    limit = Math.min(limit, 100);
    return this.bonusService.findAll({ page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific bonus by ID' })
  @ApiResponse({ status: 200, description: 'Bonus found', type: Bonus })
  findOne(@Param('id') id: string): Promise<Bonus> {
    return this.bonusService.findOne(id);
  }
  @Patch('restore/:id')
  @ApiOperation({ summary: 'Restore deleted award' })
  // @ApiParam({ name: 'id', type: String })
  async restore(@Param('id') id: string): Promise<{ message: string }> {
    await this.bonusService.restore(id);
    return { message: 'Bonus successfully restored' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bonus' })
  @ApiResponse({ status: 200, description: 'Bonus updated', type: Bonus })
  update(@Param('id') id: string, @Body() updateBonusDto: UpdateBonusDto): Promise<Bonus> {
    return this.bonusService.update(id, updateBonusDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bonus' })
  @ApiResponse({ status: 204, description: 'Bonus deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.bonusService.remove(id);
  }
}
