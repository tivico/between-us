export type Route = { page: 'catalog' } | { page: 'topic'; id: string } | { page: 'demo'; id: string } | { page: 'not-found' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/') return { page: 'catalog' };
  const match = /^\/(topics|demo)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
  if (!match) return { page: 'not-found' };
  return { page: match[1] === 'topics' ? 'topic' : 'demo', id: match[2] };
}
