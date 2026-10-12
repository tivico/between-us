import type { QuizDefinition } from '../domain/quiz';
import type { AnalysisEvidence, AnalysisSlot, DistanceAnalysis, DistanceFinding } from '../domain/long-distance';
import './LongDistanceResults.css';

export function LongDistanceResults({ analysis, quiz, names }: { analysis: DistanceAnalysis; quiz: QuizDefinition; names: Record<AnalysisSlot, string> }) {
  const title = (finding: DistanceFinding) => finding.kind === 'within-person' ? `${names[finding.evidence[0].slot]} 的見面期待與條件`
    : finding.kind === 'cross-partner' ? `${finding.title}：${names[finding.evidence[0].slot]} 希望收到的回應` : finding.title;
  const evidence = (items: AnalysisEvidence[]) => <dl className="distance-evidence">{items.map((item) => <div key={`${item.slot}-${item.questionId}`}><dt>{names[item.slot]} · {item.role}</dt><dd>{item.label}</dd></div>)}</dl>;
  const summary = (items: DistanceFinding[], label: string, id: string, empty: string) => <section className="distance-findings" aria-labelledby={id}><h2 id={id}>{label}</h2><p className="distance-section-note">{label === '共同點' ? '相同的是這輪選項，你們仍可能有不同理由。' : '先確認彼此的需要與條件，再一起決定想調整什麼。'}</p>{!items.length ? <p className="distance-empty">{empty}</p> : <>
    {items.slice(0, 3).map((item) => <article key={item.id}><h3>{title(item)}</h3><p>{item.description}</p>{evidence(item.evidence)}{item.advice && <details className="distance-more"><summary>{item.state === 'common' ? '可以怎麼延續這個共同點？' : '可以怎麼一起調整？'}</summary><p>{item.advice}</p></details>}</article>)}
    {items.length > 3 && <details className="distance-more"><summary>查看其餘 {items.length - 3} 組{label}</summary>{items.slice(3).map((item) => <article key={item.id}><h3>{title(item)}</h3><p>{item.description}</p>{evidence(item.evidence)}{item.advice && <p className="distance-small-advice">可以試試：{item.advice}</p>}</article>)}</details>}
  </>}</section>;
  return <section className="distance-results" aria-label="遠距雙人分析">
    <div className="distance-intro"><p className="eyebrow">YOUR WAY OF BEING TOGETHER</p><h2>你們的遠距，有自己的節奏。</h2><p>從這輪回答，看共同點、不同需要，以及目前做得到的安排。忙碌和支持會分別對照雙方的期待與另一方自述的做法；見面則先看各自的期待與條件。</p><p className="distance-limits">這是依實際選項整理的探索與討論提案。你們可以調整或略過；題庫與建議效果尚未驗證，不提供契合分數或關係判定。</p></div>
    <div className="distance-summary-grid">
      {summary(analysis.common, '共同點', 'distance-common', '這輪還沒有可列出的相同偏好或做法。可以從逐題選項開始了解彼此。')}
      {summary(analysis.differences, '差異點', 'distance-differences', '這輪可比較的選項沒有顯示不同；暫不分享或不適用的回答也會保留原狀。')}
    </div>
    <section className="distance-conditions" aria-labelledby="distance-conditions"><h2 id="distance-conditions">期待與可行條件</h2><p>先看各自希望與目前做得到的事，再一起找可行的見面安排。</p><div className="distance-advice-grid">{analysis.conditions.map((item) => <article key={item.id} className="distance-advice-card"><h3>{title(item)}</h3>{evidence(item.evidence)}<p>{item.description}</p>{item.advice && <p className="distance-action">{item.advice}</p>}</article>)}</div></section>
    <section className="distance-suggestions" aria-labelledby="distance-suggestions"><p className="eyebrow">SOMETHING TO TRY, TOGETHER</p><h2 id="distance-suggestions">給你們的討論建議</h2><p>先選一個雙方都願意談的安排。每張卡列出這項提案所依據的答案；排列順序是閱讀安排。</p>
      {!analysis.suggestions.length ? <p className="distance-empty">本輪沒有足夠的偏好或配對答案可以提出具體建議。暫不分享、不適用或尚未確定都可以保留，不需要補充原因。</p> : <div className="distance-advice-grid">{analysis.suggestions.map((item) => <article key={item.id} className="distance-advice-card"><span className="distance-tag">{item.state === 'common' ? '從共同點延伸' : '從不同需要開始'}</span><h3>{title(item)}</h3>{evidence(item.evidence)}<p className="distance-action">{item.advice}</p><details><summary>為什麼出現這張卡？</summary><p>{item.description}</p><ul>{item.evidence.map((entry) => <li key={`${entry.slot}-${entry.questionId}`}>{names[entry.slot]}回答「{entry.prompt}」：{entry.label}</li>)}</ul><p>提案為本站自編，研究支持概念；未證明這個安排對每對伴侶有效。</p>{quiz.sources.filter((source) => item.sourceIds.includes(source.id)).map((source) => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.authors}（{source.year}）↗</a></p>)}</details></article>)}</div>}
    </section>
    {analysis.context.length > 0 && <details className="distance-context"><summary>各自狀況與暫不比較的回答（{analysis.context.length} 組）</summary><p>近期經驗、現實條件與討論狀態保留上下文；暫不分享、不適用、沒有遇到、未確定或未提供固定安排時，先看各自情境。</p>{analysis.context.map((item) => <article key={item.id}><h3>{title(item)}</h3>{evidence(item.evidence)}<p>{item.description}</p></article>)}</details>}
  </section>;
}
