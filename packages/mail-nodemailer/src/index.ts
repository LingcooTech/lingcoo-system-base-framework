export {
  SmtpProvider,
  type SmtpConnectionConfig,
  type SmtpCredentials,
  type SmtpMessage,
  type SmtpSendResult,
} from './provider.js';
export { SmtpService, type SmtpTestEmailInput } from './service.js';
export { registerSmtpAdapterRoutes, smtpAdapterRoutes } from './routes.js';
