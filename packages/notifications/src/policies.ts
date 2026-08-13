import type { OutboxSubscriber } from '@lingcootech/frame-extension-sdk/worker';

import type { NotificationService } from './service.js';

export function createPasswordChangedSubscriber(
  notifications: NotificationService,
): OutboxSubscriber {
  return async (event) => {
    const accountId = typeof event.payload.accountId === 'string' ? event.payload.accountId : '';
    if (!accountId) throw new Error('auth.password_changed event is missing accountId');
    await notifications.create({
      recipientAccountId: accountId,
      category: 'account',
      level: 'warning',
      title: '账号密码已修改',
      body: '你的账号密码刚刚发生了变更，其他登录会话已经失效。如果这不是你的操作，请立即联系系统管理员。',
      ctaLabel: '查看账号安全',
      ctaUrl: '/admin/account#security',
      sourceEventId: event.eventId,
      sourceEventName: event.topic,
      dedupeKey: `event:${event.eventId}`,
      email: {},
    });
  };
}
