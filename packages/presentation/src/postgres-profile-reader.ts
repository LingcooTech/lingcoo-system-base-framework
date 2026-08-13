import { eq } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import { presentationProfiles } from '@lingcootech/frame-database/schema';
import {
  defaultPresentationProfileSummary,
  type PresentationProfileReaderPort,
  type PresentationProfileSummary,
} from './profile-reader.js';

const profileId = 'default';

export class PostgresPresentationProfileReader implements PresentationProfileReaderPort {
  constructor(private readonly database: Database) {}

  async get(): Promise<PresentationProfileSummary> {
    const [profile] = await this.database
      .select({
        displayName: presentationProfiles.displayName,
        publicUrl: presentationProfiles.publicUrl,
      })
      .from(presentationProfiles)
      .where(eq(presentationProfiles.id, profileId))
      .limit(1);
    return profile ?? defaultPresentationProfileSummary;
  }
}
