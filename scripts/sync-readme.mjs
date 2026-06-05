import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

['README.md', 'LICENSE'].forEach((file) => {
  copyFileSync(join(root, file), join(process.cwd(), file));
});
