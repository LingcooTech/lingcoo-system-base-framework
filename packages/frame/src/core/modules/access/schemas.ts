import { z } from 'zod';

const roleCode = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value), {
    message: '角色代码格式无效',
  });

export const createAccountSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    displayName: z.string().trim().min(1).max(120),
    setupMethod: z.enum(['invitation', 'temporary_password']).default('invitation'),
    password: z.string().min(12).max(128).optional(),
    roleCodes: z.array(roleCode).min(1),
  })
  .superRefine((value, context) => {
    if (value.setupMethod === 'temporary_password' && !value.password) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: '请输入至少 12 位的临时密码',
      });
    }
  });

export const updateAccountSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    roleCodes: z.array(roleCode).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const accountParamsSchema = z.object({ accountId: z.uuid() });

export const createRoleSchema = z.object({
  code: roleCode,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  permissions: z.array(z.string().trim().min(1).max(120)).default([]),
});

export const updateRoleSchema = createRoleSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const roleParamsSchema = z.object({ roleId: z.uuid() });
