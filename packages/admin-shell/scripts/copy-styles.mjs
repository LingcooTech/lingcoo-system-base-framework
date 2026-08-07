import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

await copyFile(`${packageRoot}/src/styles.css`, `${packageRoot}/dist/styles.css`);
