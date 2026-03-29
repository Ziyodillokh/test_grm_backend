import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { Repository } from 'typeorm';
import { IPaginationOptions, paginate, Pagination } from 'nestjs-typeorm-paginate';
import { CreateContactDto, UpdateContactDto } from './dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {
  }

  async create(createContactDto: CreateContactDto): Promise<Contact> {
    if (!createContactDto?.filial) {
      throw new BadRequestException('Filial Should be exist!');
    }
    const contact = this.contactRepository.create(createContactDto as unknown as Contact);
    return this.contactRepository.save(contact);
  }

  async update(id: string, updateDto: UpdateContactDto): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');

    const updated = Object.assign(contact, updateDto);
    return this.contactRepository.save(updated);
  }

  async findAll(options: IPaginationOptions, filial?: string): Promise<Pagination<Contact>> {
    const queryBuilder = this.contactRepository.createQueryBuilder('contact');
    queryBuilder.orderBy('contact.name', 'ASC');

    if (filial) {
      queryBuilder.where('contact.filialId = :filial', { filial });
    }

    return paginate<Contact>(queryBuilder, options);
  }


  async findOne(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }
}
