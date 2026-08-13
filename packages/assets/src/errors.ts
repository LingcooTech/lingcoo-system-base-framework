export function assetsError(statusCode: number, message: string, name = 'AssetsError'): Error {
  return Object.assign(new Error(message), { name, statusCode });
}
