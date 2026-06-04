const appendPatterns = (content: string, patterns: readonly string[]): string => {
  const base = content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
  return `${base}${patterns.join('\n')}\n`;
};

export const ensureIgnored = (content: string, patterns: readonly string[]): string => {
  const present = new Set(content.split('\n').map((line) => line.trim()));
  const missing = patterns.filter((pattern) => !present.has(pattern));
  if (missing.length === 0) {
    return content;
  }
  return appendPatterns(content, missing);
};
