import { Controller, Get, Res } from '@nestjs/common';
import { join } from 'node:path';
import type { Response } from 'express';
@Controller()
export class ViewController {
  @Get('/')
  render(@Res() response: Response) { return response.sendFile(join(process.cwd(), 'dist/client/index.html')); }
}
