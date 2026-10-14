import { quizzes, roundQuizzes } from '../src/content/quizzes.ts';
import { relationshipArticles } from '../src/content/relationship-articles.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function catalogManifest() {
  const summary = (q) => ({ id: q.id, version: q.version, title: q.title, subtitle: q.subtitle, audience: q.audience, status: q.status, theme: q.theme, motif: q.motif, questionCount: q.questions.length,
    dailyValues: Boolean(q.dailyValues), scoring: Boolean(q.scoring), moneyLife: Boolean(q.moneyLife), communication: Boolean(q.communication), analysis: Boolean(q.analysis) });
  return { topics: quizzes.map(summary), rounds: roundQuizzes.map(summary), articles: relationshipArticles.map(({ id, title }) => ({ id, title })) };
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const path = new URL('../src/content/quiz-catalog.json', import.meta.url);
  const encoded = JSON.stringify(catalogManifest(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== encoded) { console.error('CATALOG_STALE: 請執行 npm run catalog:generate。'); process.exitCode = 1; }
  } else { writeFileSync(path, encoded); console.log('CATALOG_GENERATED'); }
}
