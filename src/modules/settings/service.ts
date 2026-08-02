import { desc, eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { accounts, systemSettings, systemSettingVersions } from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import { findSettingDefinition, settingDefinitions } from './registry.js';

export class SettingsService {
  constructor(private readonly db: Database) {}

  async list() {
    const rows = await this.db.select().from(systemSettings);
    const values = new Map(rows.map((row) => [row.key, row]));
    return settingDefinitions.map((definition) => {
      const stored = values.get(definition.key);
      return {
        key: definition.key,
        group: definition.group,
        groupLabel: definition.groupLabel,
        label: definition.label,
        description: definition.description,
        type: definition.type,
        defaultValue: definition.defaultValue,
        options: definition.options,
        value: stored?.value ?? definition.defaultValue,
        isDefault: !stored,
        version: stored?.version ?? 0,
        updatedAt: stored?.updatedAt ?? null,
      };
    });
  }

  async update(key: string, value: unknown, reason: string | undefined, actorId: string) {
    const definition = findSettingDefinition(key);
    if (!definition) throw httpError(404, '设置项不存在或不允许修改', 'NotFoundError');
    const parsedValue = definition.schema.parse(value);

    const saved = await this.db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);
      const [row] = existing
        ? await transaction
            .update(systemSettings)
            .set({
              value: parsedValue,
              version: sql`${systemSettings.version} + 1`,
              updatedBy: actorId,
              updatedAt: new Date(),
            })
            .where(eq(systemSettings.id, existing.id))
            .returning()
        : await transaction
            .insert(systemSettings)
            .values({ key, value: parsedValue, version: 1, updatedBy: actorId })
            .returning();
      await transaction.insert(systemSettingVersions).values({
        settingKey: key,
        version: row.version,
        value: parsedValue,
        changeReason: reason,
        changedBy: actorId,
      });
      return row;
    });
    await recordAuditEvent(this.db, {
      action: 'system.setting_updated',
      resourceType: 'system_setting',
      resourceId: key,
      actorId,
      metadata: { version: saved.version, reason: reason || undefined },
    });
    return {
      key,
      value: saved.value,
      version: saved.version,
      isDefault: false,
      updatedAt: saved.updatedAt,
    };
  }

  async history(key: string) {
    if (!findSettingDefinition(key)) {
      throw httpError(404, '设置项不存在', 'NotFoundError');
    }
    return this.db
      .select({
        id: systemSettingVersions.id,
        version: systemSettingVersions.version,
        value: systemSettingVersions.value,
        changeReason: systemSettingVersions.changeReason,
        createdAt: systemSettingVersions.createdAt,
        actor: {
          id: accounts.id,
          email: accounts.email,
          displayName: accounts.displayName,
        },
      })
      .from(systemSettingVersions)
      .leftJoin(accounts, eq(systemSettingVersions.changedBy, accounts.id))
      .where(eq(systemSettingVersions.settingKey, key))
      .orderBy(desc(systemSettingVersions.version));
  }
}
