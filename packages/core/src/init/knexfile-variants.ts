const KNEXFILE_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'] as const;

export const KNEXFILE_VARIANTS: readonly string[] = KNEXFILE_EXTENSIONS.map((extension) => `knexfile.${extension}`);
