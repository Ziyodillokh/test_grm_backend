// src/note/note.controller.ts
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Note } from './note.entity'; // Adjust path as needed
import { NoteService } from './note.service';
import { CreateNoteDto, UpdateNoteDto } from './dto';

@ApiTags('notes')
@Controller('notes')
export class NoteController {
  constructor(private readonly noteService: NoteService) {
  }

  @Post()
  @ApiOperation({ summary: 'Create a new note' })
  @ApiResponse({ status: 201, description: 'The note has been successfully created.', type: Note })
  create(@Body() createNoteDto: CreateNoteDto, @Req() req) {
    return this.noteService.create(createNoteDto, req.user);
  }

  @Get('/')
  @ApiOperation({ summary: 'Get all notes' })
  @ApiResponse({ status: 200, description: 'Returns all notes.', type: [Note] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Req() req,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.noteService.findAll({ page, limit }, req.user);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get notes by user ID with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  getNotesByUser(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<{ data: Note[]; total: number; page: number; limit: number }> {
    return this.noteService.findByUser(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get note by ID' })
  @ApiResponse({ status: 200, description: 'Returns the note.', type: Note })
  findOne(@Param('id') id: string) {
    return this.noteService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note by ID' })
  @ApiResponse({ status: 200, description: 'The note has been updated.', type: Note })
  update(@Param('id') id: string, @Body() updateNoteDto: UpdateNoteDto) {
    return this.noteService.update(id, updateNoteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note by ID' })
  @ApiResponse({ status: 200, description: 'The note has been deleted.' })
  remove(@Param('id') id: string) {
    return this.noteService.remove(id);
  }
}
