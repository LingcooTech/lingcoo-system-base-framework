export function jobsError(statusCode: number, message: string, name = 'JobsError'): Error {
  return Object.assign(new Error(message), { name, statusCode });
}
