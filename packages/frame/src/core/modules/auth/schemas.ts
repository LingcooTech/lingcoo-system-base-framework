import { z } from 'zod';

const normalizedEmail = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const password = z.string().min(12).max(128);
const securityToken = z.string().trim().min(32).max(256);

export const loginSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    confirmPassword: password,
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的新密码不一致',
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: '新密码不能与当前密码相同',
  });

export const passwordResetRequestSchema = z.object({ email: normalizedEmail });

export const completeSecurityChallengeSchema = z
  .object({ token: securityToken, newPassword: password, confirmPassword: password })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的新密码不一致',
  });

export const verifyEmailSchema = z.object({ token: securityToken });
export const sessionParamsSchema = z.object({ sessionId: z.uuid() });
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  avatarAssetId: z.uuid().nullable(),
});
