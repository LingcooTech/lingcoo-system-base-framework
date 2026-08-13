export function integrationError(
  statusCode: number,
  message: string,
  name = 'IntegrationError',
): Error {
  return Object.assign(new Error(message), { name, statusCode });
}
