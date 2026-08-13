import type { Database } from '@lingcootech/frame-database';
import { defineWorkerExtension } from '@lingcootech/frame-extension-sdk/worker';

import type { CmsServicePorts } from './ports.js';
import { cmsScheduledJobSchema } from './schemas.js';
import { CmsService } from './service.js';

export function createCmsWorkerExtension<TEnvironment>(options: {
  servicePorts(database: Database, environment?: TEnvironment): CmsServicePorts;
}) {
  return defineWorkerExtension<TEnvironment, Database>({
    register(context) {
      const service = new CmsService(
        context.database,
        options.servicePorts(context.database, context.env),
      );
      context.registerJob('cms.content.publish-scheduled', ({ payload }) => {
        const input = cmsScheduledJobSchema.parse(payload);
        return service.publishScheduled(input.contentId, input.publishAt, input.actorId);
      });
    },
  });
}
