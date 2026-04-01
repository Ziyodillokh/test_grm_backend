import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVideoMessageDto {
  @ApiProperty({ description: 'MinIO path to the video file', example: '/video-messages/abc123.mp4' })
  @IsNotEmpty()
  @IsString()
  videoPath: string;

  @ApiProperty({ description: 'Title of the video message', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Description of the video message', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Target role number (null = all roles)', required: false })
  @IsOptional()
  @IsNumber()
  targetRole?: number;

  @ApiProperty({ description: 'Target user ID (null = all users in target role)', required: false })
  @IsOptional()
  @IsString()
  targetUserId?: string;
}
