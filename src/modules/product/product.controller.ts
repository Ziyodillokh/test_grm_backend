import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Product } from './product.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Route } from '../../infra/shared/decorators/route.decorator';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Roles(
    Role.BOSS,
    Role.M_MANAGER,
    Role.ACCOUNTANT,
    Role.F_MANAGER,
    Role.W_MANAGER,
    Role.SELLER,
    Role.D_MANAGER,
    Role.DEALER,
    Role.I_MANAGER,
  )
  @ApiOperation({ summary: 'Get all products with pagination' })
  @ApiOkResponse({ description: 'Products returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Route() route: string,
    @Query() query: QueryProductDto,
  ) {
    return this.productService.findAll(
      { page: query.page, limit: query.limit, route },
      query,
    );
  }

  @Get('filial')
  @Roles(
    Role.BOSS,
    Role.M_MANAGER,
    Role.ACCOUNTANT,
    Role.F_MANAGER,
    Role.W_MANAGER,
    Role.SELLER,
    Role.D_MANAGER,
    Role.I_MANAGER,
  )
  @ApiOperation({ summary: 'Get filials that have matching products (search)' })
  @ApiOkResponse({ description: 'Filials with product count' })
  @HttpCode(HttpStatus.OK)
  async searchFilials(@Query() query: QueryProductDto) {
    return this.productService.searchFilials(query.search || '');
  }

  @Get(':id')
  @Roles(
    Role.BOSS,
    Role.M_MANAGER,
    Role.ACCOUNTANT,
    Role.F_MANAGER,
    Role.W_MANAGER,
    Role.SELLER,
  )
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiOkResponse({ description: 'Product returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productService.findOne(id);
  }

  @Post()
  @Roles(Role.BOSS, Role.M_MANAGER, Role.W_MANAGER)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto): Promise<Product | Product[]> {
    return this.productService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.BOSS, Role.M_MANAGER, Role.W_MANAGER, Role.F_MANAGER)
  @ApiOperation({ summary: 'Update a product' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.M_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a product' })
  @ApiOkResponse({ description: 'Product deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productService.remove(id);
  }
}
