import { Injectable, Logger } from '@nestjs/common';
import { CMS_SCHEMA_VERSION } from '../common/constants/statuses';

@Injectable()
export class CmsMigrationService {
  private readonly logger = new Logger(CmsMigrationService.name);

  /**
   * Run all needed migrations from state.schemaVersion up to CMS_SCHEMA_VERSION.
   * Each migration is safe to re-run (backfill-on-read).
   */
  migrate(state: any): any {
    let current = state.schemaVersion ?? 0;
    const result = { ...state };

    if (current < 1) {
      current = 1;
      result.schemaVersion = 1;
    }

    if (current < 2) {
      this.logger.log('CMS migration 1 → 2: ensure mediaLibrary');
      result.mediaLibrary = result.mediaLibrary ?? [];
      result.schemaVersion = 2;
      current = 2;
    }

    if (current < 3) {
      this.logger.log('CMS migration 2 → 3: ensure consultationTypes');
      result.consultationTypes = result.consultationTypes ?? [];
      result.schemaVersion = 3;
      current = 3;
    }

    if (current < 4) {
      this.logger.log('CMS migration 3 → 4: ensure settings.stats defaults');
      result.settings = result.settings ?? {};
      result.settings.stats = result.settings.stats ?? {
        governorates: '12',
        beneficiaries: '1.2M+',
        yearsOfService: '+12',
      };
      result.schemaVersion = 4;
      current = 4;
    }

    if (current < 5) {
      this.logger.log('CMS migration 4 → 5: ensure paymentMethods');
      result.paymentMethods = result.paymentMethods ?? [
        { key: 'card', label: 'بطاقة بنكية', enabled: true, icon: 'credit-card' },
        { key: 'fawry', label: 'فوري', enabled: true, icon: 'fawry' },
        { key: 'instapay', label: 'إنستاباي', enabled: true, icon: 'instapay' },
        { key: 'vodafone_cash', label: 'فودافون كاش', enabled: true, icon: 'vodafone' },
        { key: 'bank_transfer', label: 'تحويل بنكي', enabled: true, icon: 'bank' },
      ];
      result.schemaVersion = 5;
      current = 5;
    }

    // Future migrations go here (6, 7, ...)

    if (result.schemaVersion !== CMS_SCHEMA_VERSION) {
      this.logger.warn(
        `CMS state at schemaVersion ${result.schemaVersion}, expected ${CMS_SCHEMA_VERSION}`,
      );
    }

    return result;
  }
}
