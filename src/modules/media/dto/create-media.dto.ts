class CreateMediaDto {
  path: string;
  model: string;
  mimetype: string;
  size: number;
  name: string;
  i_image?: string;
}

export default CreateMediaDto;