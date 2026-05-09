import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateNoPurchaseVisitDto } from './dto/create-visit.dto';
import { VisitService } from './visit.service';

@ApiTags('visit')
@Controller('visit')
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Post('/no-purchase')
  async createNoPurchase(@Body() dto: CreateNoPurchaseVisitDto, @Req() req) {
    return this.visitService.createNoPurchase(dto.clientId, req.user);
  }

  @Get()
  async findByClient(@Query('clientId') clientId: string) {
    return this.visitService.findByClient(clientId);
  }
}
