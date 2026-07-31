import nodemailer from 'nodemailer';

import { httpError } from '../../../lib/http-error.js';
import type { IntegrationProvider, ProviderTestContext } from '../provider.js';

export interface SmtpConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  from: string;
}

export interface SmtpCredentials {
  password: string;
}

export interface SmtpMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmtpSendResult {
  messageId: string | null;
  accepted: string[];
  rejected: string[];
  response: string | null;
}

interface SmtpTransport {
  verify(): Promise<unknown>;
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    disableFileAccess: boolean;
    disableUrlAccess: boolean;
  }): Promise<{
    messageId?: unknown;
    accepted?: unknown;
    rejected?: unknown;
    response?: unknown;
  }>;
  close(): void;
}

export type SmtpTransportFactory = (
  config: SmtpConnectionConfig & SmtpCredentials,
) => SmtpTransport;

const defaultTransportFactory: SmtpTransportFactory = (config) => {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls && !config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    verify: () => transport.verify(),
    sendMail: (message) => transport.sendMail(message),
    close: () => transport.close(),
  };
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function parseSettings(
  config: Record<string, unknown>,
  credentials: Record<string, unknown>,
): SmtpConnectionConfig & SmtpCredentials {
  const settings = {
    host: String(config.host ?? '').trim(),
    port: Number(config.port),
    secure: Boolean(config.secure),
    requireTls: config.requireTls === undefined ? true : Boolean(config.requireTls),
    user: String(config.user ?? '').trim(),
    from: String(config.from ?? '').trim(),
    password: String(credentials.password ?? ''),
  };
  if (!/^[^\s/:]+$/.test(settings.host)) {
    throw httpError(422, 'SMTP 主机格式无效', 'ValidationError');
  }
  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65_535) {
    throw httpError(422, 'SMTP 端口必须在 1 到 65535 之间', 'ValidationError');
  }
  if ([settings.user, settings.from].some((value) => /[\r\n]/.test(value))) {
    throw httpError(422, 'SMTP 发件信息格式无效', 'ValidationError');
  }
  return settings;
}

async function waitForTransport<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error('SMTP 操作超时'));
    signal.addEventListener('abort', abort, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class SmtpProvider implements IntegrationProvider {
  readonly code = 'smtp';
  readonly name = 'SMTP 邮件服务';
  readonly category = 'communication' as const;
  readonly description = '事务邮件、验证码和系统通知的统一发送通道。';
  readonly adapterVersion = '1.0.0';
  readonly capabilities = ['email.send', 'connection.test'];
  readonly configFields = [
    {
      key: 'host',
      label: 'SMTP 主机',
      type: 'text' as const,
      required: true,
      placeholder: 'smtp.example.com',
    },
    {
      key: 'port',
      label: 'SMTP 端口',
      type: 'number' as const,
      required: true,
      defaultValue: 465,
      description: '常用端口为 465（TLS）或 587（STARTTLS）。',
    },
    {
      key: 'secure',
      label: '使用隐式 TLS',
      type: 'boolean' as const,
      required: true,
      defaultValue: true,
      description: '端口 465 通常启用；端口 587 通常关闭并自动升级 STARTTLS。',
    },
    {
      key: 'user',
      label: 'SMTP 用户名',
      type: 'text' as const,
      required: true,
      placeholder: 'mailer@example.com',
    },
    {
      key: 'requireTls',
      label: '强制 STARTTLS',
      type: 'boolean' as const,
      required: true,
      defaultValue: true,
      description: '非 465 端口默认强制加密升级，避免明文传输登录凭据。',
    },
    {
      key: 'from',
      label: '默认发件人',
      type: 'text' as const,
      required: true,
      placeholder: 'Lingcoo <mailer@example.com>',
    },
  ];
  readonly credentialFields = [
    {
      key: 'password',
      label: 'SMTP 密码或授权码',
      type: 'password' as const,
      required: true,
      description: '保存后不再回传；编辑时留空可保持原值。',
    },
  ];

  constructor(private readonly createTransport: SmtpTransportFactory = defaultTransportFactory) {}

  async testConnection({ config, credentials, signal }: ProviderTestContext) {
    const settings = parseSettings(config, credentials);
    const transport = this.createTransport(settings);
    try {
      await waitForTransport(transport.verify(), signal);
      return {
        message: 'SMTP 连接与身份认证正常',
        metadata: {
          host: settings.host,
          port: settings.port,
          secure: settings.secure,
          requireTls: settings.requireTls,
        },
      };
    } finally {
      transport.close();
    }
  }

  async sendMail(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    message: SmtpMessage,
    signal: AbortSignal,
  ): Promise<SmtpSendResult> {
    const settings = parseSettings(config, credentials);
    const transport = this.createTransport(settings);
    try {
      const info = await waitForTransport(
        transport.sendMail({
          from: settings.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          disableFileAccess: true,
          disableUrlAccess: true,
        }),
        signal,
      );
      return {
        messageId: typeof info.messageId === 'string' ? info.messageId : null,
        accepted: stringList(info.accepted),
        rejected: stringList(info.rejected),
        response: typeof info.response === 'string' ? info.response : null,
      };
    } finally {
      transport.close();
    }
  }
}
