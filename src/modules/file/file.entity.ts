import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { Media } from '../media/media.entity';
import { Model } from '../model/model.entity';
import { Color } from '../color/color.entity';
import { Shape } from '../shape/shape.entity';
import { Collection } from '../collection/collection.entity';
import { BaseEntity } from '../../common/database/base.entity';

@Entity('file')
export class File extends BaseEntity {
  @Column('boolean', { default: false })
  is_video: boolean;

  @OneToOne(() => Media, {onDelete: 'SET NULL'})
  @JoinColumn()
  media: Media;

  @ManyToOne(() => Model, {onDelete: 'SET NULL'})
  @JoinColumn()
  model: Model;

  @ManyToOne(() => Collection, {onDelete: 'SET NULL'})
  @JoinColumn()
  collection: Collection;

  @ManyToOne(() => Color, {onDelete: 'SET NULL'})
  @JoinColumn()
  color: Color;

  @ManyToOne(() => Shape, {onDelete: 'SET NULL'})
  @JoinColumn()
  shape: Shape;
}
