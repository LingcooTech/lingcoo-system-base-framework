export function notificationsError(
  statusCode: number,
  message: string,
  name = 'NotificationsError',
): Error {
  return Object.assign(new Error(message), { name, statusCode });
}
