import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const profile = await this.usersService.getProfile(req.userId);
    return { success: true, profile };
  }

  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    const profile = await this.usersService.updateProfile(req.userId, body);
    return { success: true, profile };
  }
}
