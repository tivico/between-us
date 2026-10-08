export type Route = { page: 'catalog' } | { page: 'topic' | 'demo' | 'start' | 'trial'; id: string }
  | { page: 'history' } | { page: 'round'; id: string; token: string } | { page: 'invite'; token: string }
  | { page: 'not-found' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/') return { page: 'catalog' };
  if (path === '/history') return { page: 'history' };
  const round = /^\/rounds\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([a-f0-9]{64})$/.exec(path);
  if (round) return { page: 'round', id: round[1], token: round[2] };
  const invite = /^\/invite\/([a-f0-9]{64})$/.exec(path);
  if (invite) return { page: 'invite', token: invite[1] };
  const match = /^\/(topics|demo|start|trial)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
  if (!match) return { page: 'not-found' };
  return { page: match[1] === 'topics' ? 'topic' : match[1] === 'start' ? 'start' : match[1] === 'trial' ? 'trial' : 'demo', id: match[2] };
}
