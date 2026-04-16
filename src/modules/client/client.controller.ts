import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { PayDebtDto, UpdateClientDto } from './dto/update-client.dto';
import { Client } from './client.entity';
import { Pagination } from 'nestjs-typeorm-paginate';

@ApiTags('Client')
@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, type: Client })
  create(@Body() createClientDto: CreateClientDto): Promise<Client> {
    return this.clientService.create(createClientDto);
  }

  @Patch(':id/pay')
  @ApiBody({ type: PayDebtDto })
  async payDebt(@Param('id') id: string, @Body() dto: PayDebtDto, @Req() req): Promise<Client> {
    return this.clientService.payDebt(id, dto.amount, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get clients with optional filial filter and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'filialId', required: true, type: String })
  @ApiResponse({ status: 200, type: [Client] })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('filial') filial: string,
  ): Promise<Pagination<Client>> {
    return this.clientService.findAll({ page: Number(page), limit: Number(limit) }, { filial });
  }

  @Get('debt-report/filials')
  @ApiOperation({ summary: 'Filiallar bo\'yicha qarz hisoboti' })
  async getDebtReportByFilials() {
    return this.clientService.getDebtReportByFilials();
  }

  @Get('debt-report/filials/:filialId/clients')
  @ApiOperation({ summary: 'Filial ichidagi qarzdor clientlar' })
  async getDebtClientsByFilial(
    @Param('filialId') filialId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.clientService.getDebtClientsByFilial(filialId, { page: +page, limit: +limit });
  }

  @Get('debt-report/clients/:clientId/orders')
  @ApiOperation({ summary: 'Client debt orderlari' })
  async getDebtOrdersByClient(
    @Param('clientId') clientId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.clientService.getDebtOrdersByClient(
      clientId,
      { year: year ? +year : undefined, month: month ? +month : undefined },
      { page: +page, limit: +limit },
    );
  }

  @Get('debts/by-filial')
  @ApiOperation({ summary: 'Get paginated clients with debt orders by filial' })
  @ApiQuery({ name: 'filialId', required: true })
  @ApiQuery({ name: 'sellerId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getDebtOrdersByFilial(
    @Query('filialId') filialId: string,
    @Query('sellerId') sellerId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    if (!filialId) {
      throw new BadRequestException('filialId is required');
    }

    return this.clientService.getClientsWithDebtOrdersPaginated(filialId, { page: +page, limit: +limit }, sellerId);
  }

  @Get('debt/total/:filialId')
  async getTotalDebt(@Param('filialId') filialId: string) {
    const total = await this.clientService.getTotalDebtByFilial(filialId);
    return { totalDebt: total };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single client by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: Client })
  findOne(@Param('id') id: string): Promise<Client> {
    return this.clientService.findOne(id);
  }

  @Patch('restore/:id')
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Client has been deleted restore' })
  restore(@Param('id') id: string): Promise<void> {
    return this.clientService.restore(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: Client })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto): Promise<Client> {
    return this.clientService.update(id, updateClientDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a client by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Client has been deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.clientService.remove(id);
  }

  @Post(':id/complete-debt')
  @ApiOperation({ summary: 'Qarzni to‘liq yopish va orderlarni yangilash' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Qarz yopildi' })
  async completeDebt(@Param('id') clientId: string): Promise<Client> {
    return this.clientService.completeDebt(clientId);
  }
}
