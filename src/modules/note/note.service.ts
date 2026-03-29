import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { CreateNoteDto, UpdateNoteDto } from './dto';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';

@Injectable()
export class NoteService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
  ) {}

  async create(createNoteDto: CreateNoteDto, user): Promise<Note> {
    const note = this.noteRepository.create({ ...createNoteDto, user: user.id });
    return this.noteRepository.save(note);
  }

  async findAll(options: IPaginationOptions, user): Promise<Pagination<Note>> {
    return paginate<Note>(this.noteRepository, options, {
      where: {
        ...(user?.id && { user: { id: user.id } }),
      },
    });
  }

  async findOne(id: string): Promise<Note> {
    const note = await this.noteRepository.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }
    return note;
  }

  async findByUser(userId: string, page = 1, limit = 10): Promise<{ data: Note[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.noteRepository.findAndCount({
      where: { user: { id: userId } },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { title: 'ASC' }, // optional: you can sort by createdAt or other fields
    });

    return { data, total, page, limit };
  }

  async update(id: string, updateNoteDto: UpdateNoteDto): Promise<Note> {
    const note = await this.findOne(id);
    const updated = Object.assign(note, updateNoteDto);
    return this.noteRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const note = await this.findOne(id);
    await this.noteRepository.remove(note);
  }
}