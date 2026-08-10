import { defineWorkerExtension } from '@lingcootech/frame-extension-sdk/worker';

export const domainWorkerExtension = defineWorkerExtension({
  register({ registerJob }) {
    registerJob('domain.echo', ({ payload }) => ({ echoed: payload }));
  },
});
