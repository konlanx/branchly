import spawn from 'cross-spawn';

import type { CommandRunner } from './types';

export const spawnSucceeds: CommandRunner = (command, args, cwd) =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], { cwd, stdio: 'ignore' });
    child.on('error', () => {
      resolve(false);
    });
    child.on('exit', (code) => {
      resolve(code === 0);
    });
  });

export const resolveProbe = (key: string): string => `if (!process.env[${JSON.stringify(key)}]) process.exit(1);`;
