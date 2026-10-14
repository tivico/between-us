import { useEffect } from 'react';
import { RelationshipLibrary, RelationshipArticlePage } from './RelationshipPages';
import { getRelationshipArticle } from '../content/relationship-articles';
import type { Route } from '../lib/routes';
export default function LearningPage({ route }: { route: Route }) {
  useEffect(() => { document.getElementById('page-heading')?.focus({ preventScroll: true }); }, [route]);
  if (route.page === 'learn') return <RelationshipLibrary />;
  const article = route.page === 'article' ? getRelationshipArticle(route.id) : undefined;
  return article ? <RelationshipArticlePage key={article.id} article={article} /> : <section className="not-found"><h1 id="page-heading" tabIndex={-1}>找不到這篇文章。</h1><a href="#/learn">回到了解關係</a></section>;
}
