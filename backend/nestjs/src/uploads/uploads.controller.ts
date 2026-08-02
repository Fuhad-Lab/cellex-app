import { Controller, Post, Body, Req } from '@nestjs/common';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  async uploadImage(@Req() req: any, @Body() body: any) {
    const url = await this.uploadsService.uploadImage(req.userId, body.imageData);
    return { success: true, url };
  }
}
