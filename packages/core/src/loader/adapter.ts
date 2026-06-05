import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SUPPORTED_API_VERSION = 1;

type AdapterFactory = (options: Record<string, unknown>) => unknown;

const resolveFromProject = (packageName: string, cwd: string): string | null => {
  try {
    return createRequire(join(cwd, 'package.json')).resolve(packageName);
  } catch {
    return null;
  }
};

export const selectDefaultFactory = (imported: unknown, packageName: string): AdapterFactory => {
  const factory = (imported as { default?: unknown }).default;
  if (typeof factory !== 'function') {
    throw new Error(`Adapter "${packageName}" must default-export a factory function.`);
  }
  return factory as AdapterFactory;
};

const describeVersion = (version: unknown): string =>
  typeof version === 'number' ? version.toString() : 'an unrecognized value';

export const assertApiVersion = (adapter: unknown, packageName: string): void => {
  const version = (adapter as { apiVersion?: unknown }).apiVersion;
  if (version === SUPPORTED_API_VERSION) {
    return;
  }
  throw new Error(
    `Adapter "${packageName}" targets apiVersion ${describeVersion(version)}, but branchly supports apiVersion ${String(SUPPORTED_API_VERSION)}. Upgrade the adapter or branchly so the two agree.`,
  );
};

export const loadAdapter = async <TAdapter>(
  packageName: string,
  options: Record<string, unknown>,
  cwd: string,
): Promise<TAdapter> => {
  const resolved = resolveFromProject(packageName, cwd);
  const specifier = resolved === null ? packageName : pathToFileURL(resolved).href;
  const imported: unknown = await import(specifier);
  const factory = selectDefaultFactory(imported, packageName);
  const adapter = factory(options);
  assertApiVersion(adapter, packageName);
  return adapter as TAdapter;
};
