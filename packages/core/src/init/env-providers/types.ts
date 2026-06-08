export type CommandRunner = (command: string, args: readonly string[], cwd: string) => Promise<boolean>;

export interface EnvProviderContext {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly key: string;
  readonly runCommand: CommandRunner;
}

export interface EnvProvider {
  readonly id: string;
  readonly label: string;
  readonly hookWrapMarker: string;
  readonly detect: (context: EnvProviderContext) => Promise<boolean>;
  readonly wrapHookCommand: (command: string) => string;
  readonly verifyResolves: (context: EnvProviderContext) => Promise<boolean>;
  readonly describe: () => string;
}
