import { desc, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { integrationConnections, integrationEvents } from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import { decryptSetting, encryptSetting, SettingsCryptoError } from '../../lib/settings-crypto.js';
import type { IntegrationProvider, ProviderTestResult } from './provider.js';
import { validateProviderFields, type IntegrationProviderRegistry } from './provider.js';

type ConnectionRow = typeof integrationConnections.$inferSelect;

function requireEncryptionKey(secret: string | undefined): string {
  if (!secret) {
    throw httpError(503, '集成凭据加密密钥尚未配置', 'ConfigurationError');
  }
  return secret;
}

function publicConnection(connection: ConnectionRow) {
  return {
    id: connection.id,
    providerCode: connection.providerCode,
    name: connection.name,
    enabled: connection.enabled,
    config: connection.config,
    credentialKeys: connection.credentialKeys,
    lastTestStatus: connection.lastTestStatus,
    lastTestMessage: connection.lastTestMessage,
    lastTestDurationMs: connection.lastTestDurationMs,
    lastTestAt: connection.lastTestAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

function decryptCredentials(connection: ConnectionRow, secret: string): Record<string, unknown> {
  try {
    return decryptSetting<Record<string, unknown>>(connection.encryptedCredentials, secret);
  } catch (error) {
    if (error instanceof SettingsCryptoError) {
      throw httpError(503, '集成凭据无法解密，请检查加密密钥', 'ConfigurationError');
    }
    throw error;
  }
}

function redactMessage(error: unknown, credentials: Record<string, unknown>): string {
  let message = error instanceof Error ? error.message : '连接测试失败';
  for (const value of Object.values(credentials)) {
    if (typeof value === 'string' && value.length >= 4) message = message.replaceAll(value, '***');
  }
  return message.slice(0, 500) || '连接测试失败';
}

function redactMetadata(
  metadata: Record<string, unknown> | undefined,
  credentials: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const secrets = Object.values(credentials).filter(
    (value): value is string => typeof value === 'string' && value.length >= 4,
  );
  function redact(value: unknown): unknown {
    if (typeof value === 'string') {
      return secrets.reduce((current, secret) => current.replaceAll(secret, '***'), value);
    }
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redact(item)]),
      );
    }
    return value;
  }
  return redact(metadata) as Record<string, unknown>;
}

export interface IntegrationExecutionContext {
  provider: IntegrationProvider;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  signal: AbortSignal;
}

export interface IntegrationExecutionResult<T> {
  value: T;
  message: string;
  metadata?: Record<string, unknown>;
}

export class IntegrationService {
  constructor(
    private readonly db: Database,
    private readonly registry: IntegrationProviderRegistry,
    private readonly encryptionKey: string | undefined,
  ) {}

  listProviders() {
    return this.registry.list();
  }

  async listConnections() {
    const rows = await this.db
      .select()
      .from(integrationConnections)
      .orderBy(desc(integrationConnections.createdAt));
    return rows.map(publicConnection);
  }

  async findConnection(connectionId: string): Promise<ConnectionRow> {
    const [connection] = await this.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, connectionId))
      .limit(1);
    if (!connection) throw httpError(404, '集成连接不存在', 'NotFoundError');
    return connection;
  }

  async createConnection(
    input: {
      providerCode: string;
      name: string;
      config: Record<string, unknown>;
      credentials: Record<string, unknown>;
    },
    actorId: string,
  ) {
    const provider = this.registry.requireAdapter(input.providerCode);
    validateProviderFields(provider.configFields, input.config, '连接配置');
    validateProviderFields(provider.credentialFields, input.credentials, '访问凭据');
    const secret = requireEncryptionKey(this.encryptionKey);
    const [connection] = await this.db
      .insert(integrationConnections)
      .values({
        providerCode: provider.code,
        name: input.name,
        config: input.config,
        encryptedCredentials: encryptSetting(input.credentials, secret),
        credentialKeys: Object.keys(input.credentials).sort(),
        createdBy: actorId,
      })
      .returning();
    await recordAuditEvent(this.db, {
      action: 'integration.connection_created',
      resourceType: 'integration_connection',
      resourceId: connection.id,
      actorId,
      metadata: { providerCode: provider.code, credentialKeys: connection.credentialKeys },
    });
    return publicConnection(connection);
  }

  async updateConnection(
    connectionId: string,
    input: {
      name?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      credentials?: Record<string, unknown>;
    },
    actorId: string,
  ) {
    const current = await this.findConnection(connectionId);
    const provider = this.registry.requireAdapter(current.providerCode);
    const nextConfig = input.config ?? current.config;
    validateProviderFields(provider.configFields, nextConfig, '连接配置');

    let encryptedCredentials = current.encryptedCredentials;
    let credentialKeys = current.credentialKeys;
    if (input.credentials) {
      const secret = requireEncryptionKey(this.encryptionKey);
      const nextCredentials = {
        ...decryptCredentials(current, secret),
      };
      for (const [key, value] of Object.entries(input.credentials)) {
        if (value === null || value === '') delete nextCredentials[key];
        else nextCredentials[key] = value;
      }
      validateProviderFields(provider.credentialFields, nextCredentials, '访问凭据');
      encryptedCredentials = encryptSetting(nextCredentials, secret);
      credentialKeys = Object.keys(nextCredentials).sort();
    }

    const invalidatesTest = input.config !== undefined || input.credentials !== undefined;
    if (input.enabled === true && (invalidatesTest || current.lastTestStatus !== 'success')) {
      throw httpError(409, '启用连接前必须使用当前配置完成连通性测试', 'ConflictError');
    }
    const [updated] = await this.db
      .update(integrationConnections)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.config !== undefined ? { config: nextConfig } : {}),
        ...(input.credentials !== undefined ? { encryptedCredentials, credentialKeys } : {}),
        ...(invalidatesTest
          ? {
              enabled: false,
              lastTestStatus: null,
              lastTestMessage: null,
              lastTestDurationMs: null,
              lastTestAt: null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'integration.connection_updated',
      resourceType: 'integration_connection',
      resourceId: connectionId,
      actorId,
      metadata: {
        providerCode: current.providerCode,
        configChanged: input.config !== undefined,
        credentialsChanged: input.credentials !== undefined,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
    return publicConnection(updated);
  }

  async testConnection(connectionId: string, actorId: string) {
    const connection = await this.findConnection(connectionId);
    const provider = this.registry.requireAdapter(connection.providerCode);
    const credentials = decryptCredentials(connection, requireEncryptionKey(this.encryptionKey));
    validateProviderFields(provider.configFields, connection.config, '连接配置');
    validateProviderFields(provider.credentialFields, credentials, '访问凭据');

    const startedAt = performance.now();
    let result: ProviderTestResult;
    try {
      result = await provider.testConnection({
        config: connection.config,
        credentials,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const message = redactMessage(error, credentials);
      await this.finishTest(connection, actorId, 'failure', durationMs, message);
      return { ok: false, message, durationMs };
    }

    const durationMs = Math.round(performance.now() - startedAt);
    const message = redactMessage(new Error(result.message), credentials);
    await this.finishTest(
      connection,
      actorId,
      'success',
      durationMs,
      message,
      redactMetadata(result.metadata, credentials),
    );
    return { ok: true, message, durationMs };
  }

  async listEvents(connectionId: string) {
    await this.findConnection(connectionId);
    return this.db
      .select({
        id: integrationEvents.id,
        operation: integrationEvents.operation,
        outcome: integrationEvents.outcome,
        durationMs: integrationEvents.durationMs,
        message: integrationEvents.message,
        metadata: integrationEvents.metadata,
        createdAt: integrationEvents.createdAt,
      })
      .from(integrationEvents)
      .where(eq(integrationEvents.connectionId, connectionId))
      .orderBy(desc(integrationEvents.createdAt))
      .limit(50);
  }

  async executeConnection<T>(input: {
    connectionId: string;
    providerCode: string;
    operation: string;
    actorId?: string;
    execute(context: IntegrationExecutionContext): Promise<IntegrationExecutionResult<T>>;
  }): Promise<T> {
    const connection = await this.findConnection(input.connectionId);
    if (connection.providerCode !== input.providerCode) {
      throw httpError(422, '集成连接类型不匹配', 'ValidationError');
    }
    if (!connection.enabled) {
      throw httpError(409, '集成连接尚未启用', 'ConflictError');
    }
    const provider = this.registry.requireAdapter(connection.providerCode);
    const credentials = decryptCredentials(connection, requireEncryptionKey(this.encryptionKey));
    validateProviderFields(provider.configFields, connection.config, '连接配置');
    validateProviderFields(provider.credentialFields, credentials, '访问凭据');

    const startedAt = performance.now();
    try {
      const result = await input.execute({
        provider,
        config: connection.config,
        credentials,
        signal: AbortSignal.timeout(30_000),
      });
      const durationMs = Math.round(performance.now() - startedAt);
      await this.recordOperation(
        connection,
        input.operation,
        'success',
        durationMs,
        redactMessage(new Error(result.message), credentials),
        input.actorId,
        redactMetadata(result.metadata, credentials),
      );
      return result.value;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      const message = redactMessage(error, credentials);
      await this.recordOperation(
        connection,
        input.operation,
        'failure',
        durationMs,
        message,
        input.actorId,
      );
      throw httpError(502, '外部服务调用失败，请查看连接事件', 'IntegrationError');
    }
  }

  private async finishTest(
    connection: ConnectionRow,
    actorId: string,
    outcome: 'success' | 'failure',
    durationMs: number,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.db.transaction(async (transaction) => {
      await transaction
        .update(integrationConnections)
        .set({
          lastTestStatus: outcome,
          lastTestMessage: message,
          lastTestDurationMs: durationMs,
          lastTestAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, connection.id));
      await transaction.insert(integrationEvents).values({
        connectionId: connection.id,
        operation: 'connection.test',
        outcome,
        durationMs,
        message,
        actorId,
        metadata,
      });
    });
    await recordAuditEvent(this.db, {
      action: 'integration.connection_tested',
      resourceType: 'integration_connection',
      resourceId: connection.id,
      actorId,
      metadata: { providerCode: connection.providerCode, outcome, durationMs },
    });
  }

  private async recordOperation(
    connection: ConnectionRow,
    operation: string,
    outcome: 'success' | 'failure',
    durationMs: number,
    message: string,
    actorId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.db.insert(integrationEvents).values({
      connectionId: connection.id,
      operation,
      outcome,
      durationMs,
      message,
      actorId,
      metadata,
    });
    await recordAuditEvent(this.db, {
      action: 'integration.operation_executed',
      resourceType: 'integration_connection',
      resourceId: connection.id,
      actorId,
      metadata: { providerCode: connection.providerCode, operation, outcome, durationMs },
    });
  }
}
