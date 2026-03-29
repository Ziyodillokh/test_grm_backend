import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto, UpdateContactDto } from './dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {
  }

  @Public()
  @Post()
  @ApiResponse({ status: 201, description: 'Contact created successfully' })
  create(@Body() dto: CreateContactDto, @Req() req) {
    return this.contactService.create({ ...dto, ...(!dto?.filial && { filial: req?.user?.filial?.id }) });
  }

  @Put(':id')
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactService.update(id, dto);
  }

  @Public()
  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'filial', required: false })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10, @Query('filial') filial: string) {
    return this.contactService.findAll({
      page: Number(page),
      limit: Number(limit),
      route: '/contact',
    }, filial);
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get single contact' })
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }
}
