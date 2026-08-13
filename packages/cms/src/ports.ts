import type { Database } from '@lingcootech/frame-database';
import type { AuditCommandPort } from '@lingcootech/frame-audit';

import type {
  CmsPublicAsset,
  CmsPublicRoute,
  CmsRedirectResolution,
} from './contracts.js';

export type CmsTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface CmsAssetPort {
  validatePublicImages(assetIds: readonly string[]): Promise<boolean>;
  loadPublicAssets(assetIds: readonly string[]): Promise<readonly CmsPublicAsset[]>;
  replaceReferences(
    transaction: CmsTransaction,
    input: {
      ownerType: string;
      ownerId: string;
      fields: Readonly<Record<string, string | null>>;
      actorId: string;
    },
  ): Promise<void>;
}

export interface CmsTaxonomyTerm {
  id: string;
  code: string;
  name: string;
  color: string | null;
  taxonomyCode: string;
  taxonomyName: string;
  taxonomyKind: string;
}

export interface CmsTaxonomyPort {
  validateActiveTerms(termIds: readonly string[]): Promise<boolean>;
  loadAssignedTerms(resourceType: string, resourceId: string): Promise<readonly CmsTaxonomyTerm[]>;
  replaceAssignments(
    transaction: CmsTransaction,
    input: {
      resourceType: string;
      resourceId: string;
      termIds: readonly string[];
      actorId: string;
    },
  ): Promise<void>;
}

export interface CmsJobPort {
  publishContent(
    transaction: CmsTransaction,
    input: { contentId: string; type: string; slug: string; version: number },
  ): Promise<void>;
  schedulePublish(
    transaction: CmsTransaction,
    input: { contentId: string; publishAt: Date; actorId: string },
  ): Promise<void>;
}

export type CmsAuditPort = AuditCommandPort;

export interface CmsServicePorts {
  assets: CmsAssetPort;
  audit: CmsAuditPort;
  jobs: CmsJobPort;
  taxonomy: CmsTaxonomyPort;
}

export interface CmsPublicSitePort {
  registerRedirectResolver(
    id: string,
    resolver: (path: string) => Promise<CmsRedirectResolution | null>,
  ): void;
  registerSitemapCollector(id: string, collector: () => Promise<readonly CmsPublicRoute[]>): void;
}
