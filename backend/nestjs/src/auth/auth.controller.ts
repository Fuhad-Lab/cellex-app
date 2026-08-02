import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('verify')
  async verifySession(@Req() req: any) {
    const user = await this.authService.verifyUser(req.userId);
    return { success: true, user };
  }
}
