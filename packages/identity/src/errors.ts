export function identityError(statusCode: number, message: string, name = 'IdentityError'): Error {
  return Object.assign(new Error(message), { name, statusCode });
}
