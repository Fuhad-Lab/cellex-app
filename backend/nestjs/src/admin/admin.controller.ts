import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers(@Req() req: any) {
    // TODO: Add admin role check
    const users = await this.adminService.listUsers();
    return { success: true, users };
  }

  @Post('moderate')
  async moderate(@Req() req: any, @Body() body: any) {
    await this.adminService.moderate(body);
    return { success: true };
  }
}
