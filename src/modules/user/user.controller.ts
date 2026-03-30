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
