export type PluginAxis = 'datasource' | 'migrator' | 'resolver' | 'vcs';

const isFullyQualified = (use: string): boolean => use.startsWith('@') || use.includes('/');

export const resolvePluginName = (axis: PluginAxis, use: string): string =>
  isFullyQualified(use) ? use : `@branchly/${axis}-${use}`;
