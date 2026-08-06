export function httpError(statusCode: number, message: string, name = 'HttpError'): Error {
  return Object.assign(new Error(message), { name, statusCode });
}
