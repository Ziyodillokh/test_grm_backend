import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export { default as CreateActionDto } from './create-action.dto';


export class restoreArxive{
  @ApiProperty({
    description: `filial id`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsUUID(4)
  readonly filialId: string;

  @ApiProperty({
    description: `kassa id`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsUUID(4)
  readonly kassaId: string;

  @ApiProperty({
    description: `startDate`,
    example: 'UUID',
  })
  @IsNotEmpty()
  @IsString()
  readonly startDate: Date;

  @ApiProperty({
    description: `endDate`,
    example: '',
  })
  @IsNotEmpty()
  @IsString()
  readonly endDate: Date;
}