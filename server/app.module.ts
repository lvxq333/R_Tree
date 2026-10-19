import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { LocalPlatformModule } from './platform/local-platform';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { CertificationModule } from './modules/certification/certification.module';
import { GrowthModule } from './modules/growth/growth.module';
import { IdpModule } from './modules/idp/idp.module';
import { TalentModule } from './modules/talent/talent.module';
import { SuccessionModule } from './modules/succession/succession.module';
import { TeamModule } from './modules/team/team.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    LocalPlatformModule,
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    EmployeeModule,
    CertificationModule,
    GrowthModule,
    IdpModule,
    TalentModule,
    SuccessionModule,
    TeamModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
