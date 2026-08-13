import type { Database } from '@lingcootech/frame-database';
import {
  PostgresAuditCommandPort,
  PostgresAuditQueryPort,
} from '@lingcootech/frame-audit/postgres';

import { getRequestContext } from '../../host/request-context.js';

export function createLegacyAuditPort(database: Database): PostgresAuditCommandPort {
  return new PostgresAuditCommandPort(database, getRequestContext);
}

export function createLegacyAuditQueryPort(database: Database): PostgresAuditQueryPort {
  return new PostgresAuditQueryPort(database);
}
