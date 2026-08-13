import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNoopNotificationsPorts,
  frameNotificationsExtension,
  frameNotificationsManifest,
  NotificationService,
  notificationsMigrationSource,
} from '../src/index.js';
import type { Database } from '@lingcootech/frame-database';

test('Notifications owns its REST, Worker and migration surfaces without SMTP', () => {
  assert.equal(frameNotificationsManifest.id, 'frame-notifications');
  assert.equal(frameNotificationsExtension.migrations?.source.id, 'frame-notifications');
  assert.deepEqual(frameNotificationsManifest.worker.jobs, ['notification.email.deliver']);
  assert.match(
    notificationsMigrationSource.migrations[0]?.sql ?? '',
    /CREATE TABLE "notifications"/,
  );
  assert.match(
    notificationsMigrationSource.migrations[0]?.sql ?? '',
    /CREATE TABLE "notification_deliveries"/,
  );
  assert.doesNotMatch(
    notificationsMigrationSource.migrations[0]?.sql ?? '',
    /integration_connections/,
  );
  assert.doesNotMatch(notificationsMigrationSource.migrations[0]?.sql ?? '', /smtp/i);
});

test('Notifications fails explicitly when account directory composition is missing', async () => {
  const service = new NotificationService({} as Database, createNoopNotificationsPorts());
  await assert.rejects(
    service.listAdmin({ limit: 20, offset: 0 }),
    (error: unknown) =>
      error instanceof Error &&
      error.name === 'ConfigurationError' &&
      'statusCode' in error &&
      error.statusCode === 503,
  );
  await assert.rejects(
    service.publishAnnouncement(
      { title: 'Notice', body: 'Body', level: 'info', sendEmail: false },
      'actor',
    ),
    { name: 'ConfigurationError' },
  );
});
