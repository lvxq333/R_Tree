import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'dist/client'));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.SERVER_PORT || 3000), '127.0.0.1');
  console.log('技能树本地演示：http://127.0.0.1:3000');
}
bootstrap().catch(error => { console.error(error); process.exit(1); });
