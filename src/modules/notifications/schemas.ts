import { z } from 'zod';

export const notificationListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['unread', 'read', 'archived']).optional(),
  category: z.string().trim().min(1).max(80).optional(),
});

export const adminNotificationListSchema = notificationListSchema.extend({
  search: z.string().trim().max(120).optional(),
});

export const deliveryListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'sending', 'sent', 'failed']).optional(),
});

export const notificationParamsSchema = z.object({ notificationId: z.uuid() });

export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  level: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaUrl: z.string().trim().max(500).startsWith('/').optional(),
  sendEmail: z.boolean().default(false),
  smtpConnectionId: z.uuid().optional(),
});
