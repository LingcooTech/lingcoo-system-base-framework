import type { CmsJobPort } from '@lingcoo/frame-cms/server';
import { jobRuns, outboxEvents } from '@lingcoo/frame-database/schema';

const resourceType = 'cms.content';

export class DatabaseCmsJobPort implements CmsJobPort {
  async publishContent(
    transaction: Parameters<CmsJobPort['publishContent']>[0],
    input: Parameters<CmsJobPort['publishContent']>[1],
  ) {
    await transaction
      .insert(outboxEvents)
      .values({
        topic: 'cms.content.published',
        aggregateType: resourceType,
        aggregateId: input.contentId,
        payload: { contentId: input.contentId, type: input.type, slug: input.slug },
        dedupeKey: `cms-published:${input.contentId}:${input.version}`,
      })
      .onConflictDoNothing({ target: outboxEvents.dedupeKey });
  }

  async schedulePublish(
    transaction: Parameters<CmsJobPort['schedulePublish']>[0],
    input: Parameters<CmsJobPort['schedulePublish']>[1],
  ) {
    await transaction
      .insert(jobRuns)
      .values({
        kind: 'cms.content.publish-scheduled',
        queue: 'default',
        payload: {
          contentId: input.contentId,
          publishAt: input.publishAt.toISOString(),
          actorId: input.actorId,
        },
        availableAt: input.publishAt,
        dedupeKey: `cms-publish:${input.contentId}:${input.publishAt.toISOString()}`,
        relatedEntityType: resourceType,
        relatedEntityId: input.contentId,
        createdBy: input.actorId,
      })
      .onConflictDoNothing({ target: jobRuns.dedupeKey });
  }
}
