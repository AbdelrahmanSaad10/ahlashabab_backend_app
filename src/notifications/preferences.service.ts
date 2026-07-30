import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationPrefKey } from '../common/constants/statuses';

/** All available preference keys */
const ALL_PREF_KEYS = Object.values(NotificationPrefKey);

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all notification preferences for a user.
   * Returns a map of { key: enabled }.
   */
  async getPreferences(userId: string) {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    // Build result with defaults (all enabled) for any missing keys
    const result: Record<string, boolean> = {};
    for (const key of ALL_PREF_KEYS) {
      const found = prefs.find((p) => p.key === key);
      result[key] = found ? found.enabled : true;
    }

    return result;
  }

  /**
   * Upsert notification preferences for a user.
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const updates = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    );

    for (const [key, enabled] of updates) {
      await this.prisma.notificationPreference.upsert({
        where: { userId_key: { userId, key } },
        update: { enabled: enabled as boolean },
        create: { userId, key, enabled: enabled as boolean },
      });
    }

    return this.getPreferences(userId);
  }

  /**
   * Check if a single notification preference is enabled for a user.
   * Defaults to true if no preference record exists.
   */
  async isEnabled(userId: string, key: string): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_key: { userId, key } },
    });

    return pref ? pref.enabled : true;
  }

  /**
   * Create default preferences for a user (all enabled).
   */
  async createDefaults(userId: string) {
    const data = ALL_PREF_KEYS.map((key) => ({
      userId,
      key,
      enabled: true,
    }));

    await this.prisma.notificationPreference.createMany({
      data,
      skipDuplicates: true,
    });

    return this.getPreferences(userId);
  }
}
