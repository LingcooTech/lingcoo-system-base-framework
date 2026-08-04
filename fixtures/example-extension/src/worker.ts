import { defineWorkerExtension } from '@lingcoo/frame-extension-sdk/worker';

export const exampleWorkerExtension = defineWorkerExtension({
  register({ registerJob, subscribe }) {
    registerJob('example.echo', ({ payload }) => ({ echoed: payload }));
    subscribe('example.created', () => undefined);
  },
});
