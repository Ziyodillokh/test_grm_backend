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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto';
import { User } from './user.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Route } from '../../infra/shared/decorators/route.decorator';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(
    Role.BOSS,
    Role.M_MANAGER,
    Role.ACCOUNTANT,
    Role.HR,
    Role.F_MANAGER,
    Role.W_MANAGER,
    Role.D_MANAGER,
  )
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiOkResponse({ description: 'Users returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Route() route: string,
    @Query() query: QueryUserDto,
  ) {
    return this.userService.findAll(
      { page: query.page, limit: query.limit, route },
      query,
    );
  }

  @Get('imarket-clients')
  @ApiOperation({ summary: 'Get all iMarket clients (role=CLIENT)' })
  @ApiOkResponse({ description: 'iMarket clients returned' })
  @HttpCode(HttpStatus.OK)
  async getIMarketClients(@Route() route: string, @Query() query: QueryUserDto) {
    return this.userService.findIMarketClients(
      { page: query.page || 1, limit: query.limit || 20, route },
      query,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Current user returned successfully' })
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser('id') userId: string): Promise<User> {
    return this.userService.getOne(userId);
  }

  @Get('info/me')
  @ApiOperation({ summary: 'Get current user profile (alias)' })
  @HttpCode(HttpStatus.OK)
  async getProfileAlias(@CurrentUser('id') userId: string): Promise<User> {
    return this.userService.getOne(userId);
  }

  @Get('managers-accountants')
  @ApiOperation({ summary: 'Get managers and accountants' })
  @HttpCode(HttpStatus.OK)
  async getManagersAccountants(): Promise<any> {
    const users = await this.userService.findManagersAccountants();
    return { items: users };
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.M_MANAGER, Role.ACCOUNTANT, Role.HR, Role.F_MANAGER)
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiOkResponse({ description: 'User returned successfully' })
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.userService.findOne(id);
  }

  @Post()
  @Roles(Role.BOSS, Role.M_MANAGER, Role.HR)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ description: 'User created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.create(dto);
  }

  @Put('client')
  @ApiOperation({ summary: 'Update current client profile (firstName, lastName)' })
  @ApiOkResponse({ description: 'Client profile updated' })
  @HttpCode(HttpStatus.OK)
  async updateClient(
    @Body() dto: { firstName?: string; lastName?: string },
    @Req() req,
  ) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };
    await this.userService.update(userId, dto as any);
    return this.userService.findOne(userId);
  }

  @Patch(':id')
  @Roles(Role.BOSS, Role.M_MANAGER, Role.HR)
  @ApiOperation({ summary: 'Update a user' })
  @ApiOkResponse({ description: 'User updated successfully' })
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.M_MANAGER)
  @ApiOperation({ summary: 'Deactivate a user (soft delete)' })
  @ApiOkResponse({ description: 'User deactivated successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
