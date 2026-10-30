import { Body, Controller, Get, Put, Query, StreamableFile } from '@nestjs/common';
import { SuccessionService } from './succession.service';
import type { KeyPositionCatalog, SuccessionOverview } from '@shared/api.interface';

@Controller('api/succession')
export class SuccessionController {
  constructor(private readonly successionService: SuccessionService) {}

  @Get()
  overview(
    @Query('department') department = '',
    @Query('track') track = '',
    @Query('level') level = '',
  ): Promise<SuccessionOverview> {
    return this.successionService.overview({ department, track, level });
  }

  @Get('catalog')
  catalog(): Promise<KeyPositionCatalog> {
    return this.successionService.catalog();
  }

  @Put('key-positions')
  save(@Body() body: unknown): Promise<KeyPositionCatalog> {
    return this.successionService.save(body);
  }

  @Get('export')
  async export(
    @Query('department') department = '',
    @Query('track') track = '',
    @Query('level') level = '',
  ): Promise<StreamableFile> {
    const buffer = await this.successionService.exportWorkbook({ department, track, level });
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(this.successionService.exportFilename())}`,
    });
  }
}
