import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';

@Injectable()
export class UploadsService {
  constructor(private readonly db: DatabaseService) {}

  async uploadImage(userId: string, imageData: string): Promise<string> {
    // Upload to Supabase Storage (server-side, using service role)
    const fileName = `uploads/${userId}/${Date.now()}.png`;
    const { data, error } = await (this.db as any).supabase
      .storage
      .from('product-images')
      .upload(fileName, this.decodeBase64Image(imageData), {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Get public URL
    const { data: urlData } = (this.db as any).supabase
      .storage
      .from('product-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  }

  private decodeBase64Image(dataUrl: string): Buffer {
    const base64 = dataUrl.split(',')[1];
    return Buffer.from(base64, 'base64');
  }
}
