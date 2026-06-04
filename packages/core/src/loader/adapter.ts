const SUPPORTED_API_VERSION = 1;

type AdapterFactory = (options: Record<string, unknown>) => unknown;

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
): Promise<TAdapter> => {
  const imported: unknown = await import(packageName);
  const factory = selectDefaultFactory(imported, packageName);
  const adapter = factory(options);
  assertApiVersion(adapter, packageName);
  return adapter as TAdapter;
};
