export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  if (base.endsWith('/')) {
    return base + path;
  }
  return base + '/' + path;
}
