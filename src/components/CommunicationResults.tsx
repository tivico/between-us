import type { RoundResults } from '../domain/round';
import type { CommunicationFinding } from '../domain/communication';
import { ResultLearningCards } from './ResultLearningCards';
import './LongDistanceResults.css';

export function CommunicationResults({ results }: { results: RoundResults }) {
  const [a, b] = results.participants;
  const names = { A: a.nickname, B: b.nickname };
  const analysis = results.communicationAnalysis;
  if (!analysis) return <div className="flow-error" role="alert">溝通整理暫時無法讀取，請重新整理。</div>;
  const labels = { same: '這個方向選到同一類方式', different: '這個方向選到不同方式', context: '保留情境，先不配對解讀' };
  const card = (finding: CommunicationFinding) => <article key={finding.id} className="distance-advice-card">
    <span className="distance-tag">{labels[finding.state]}</span>
    <h3>{finding.title}：{names[finding.wantedSlot]} 的期待 ← {names[finding.providedSlot]} 的做法</h3>
    <dl className="distance-evidence">{finding.evidence.map((e) => <div key={e.questionId}><dt>{names[e.slot]} · {e.role}</dt><dd>{e.label}</dd></div>)}</dl>
    <p>{finding.description}</p>
    {finding.advice && <><p className="answer-dimension">給 {names[finding.providedSlot]} 的可選提案</p><p className="distance-action">{finding.advice}</p><p className="conversation-prompt">一起確認：{finding.discussion}</p></>}
    <details><summary>查看本輪依據與限制</summary>
      {finding.evidence.map((e) => <p key={e.questionId}>{names[e.slot]} 回答「{e.prompt}」：{e.label}</p>)}
      <p>比較目前期待與最近一個月自述的做法，不代表實際滿足、衝突或人格。提案由本站原創，效果尚未驗證。</p>
      {finding.sourceIds.length === 0 && <p>此情境為本站設計，沒有本題的直接研究證據。</p>}
      {results.quiz.sources.filter((s) => finding.sourceIds.includes(s.id)).map((s) => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.authors}（{s.year}）↗</a></p>)}
    </details>
  </article>;
  return <section className="shared-results communication-results">
    <p className="eyebrow">HOW WE TALK, HOW WE UNDERSTAND</p>
    <h2>一起找到，好好說話的入口。</h2>
    <p className="flow-intro">{a.nickname} 與 {b.nickname} · {results.quiz.title}</p>
    <div className="preview-notice"><h2>做法與期待，先一起確認。</h2><p>相同選項不代表期待已被滿足；不同選項不代表衝突。這份整理分開看「你的期待與對方的做法」及反向配對，沒有契合分數或誰比較會溝通的判定。</p></div>
    <h2>四個可以開始聊的方向</h2><p>每段先挑一組可比較的差異；沒有差異時看一組同類選擇。依題序選入口，不是重要性或衝突排名；同一組的兩個方向都保留。</p>
    {analysis.summaries.map((summary) => <section className="distance-findings" key={summary.sectionId}><h2>{summary.title}</h2>{summary.pairId ? <div className="distance-advice-grid">{analysis.findings.filter((f) => f.pairId === summary.pairId).map(card)}</div> : <p className="distance-empty">這段沒有可比較的配對，先保留各自情境，不需要補充原因。</p>}</section>)}
    <section className="preview-notice"><h2>把選項變成新的理解</h2><ol><li>確認這張卡比較的是誰的期待與誰的做法。</li><li>輪流說這個選擇的意思與適用情境，不必分享私人事件。</li><li>說說這次才知道的需要或限制。</li><li>自願選一個小安排，確認做不到時怎麼調整；也可以先不安排。</li></ol></section>
    <details className="distance-context"><summary>查看全部 12 組雙向配對與情境</summary><div className="distance-advice-grid">{analysis.findings.map(card)}</div></details>
    <details className="raw-answer-details"><summary>查看完整 24 題的彼此答案</summary><div className="comparison-list">{results.quiz.questions.map((q, index) => {
      const context = [a, b].some((person) => q.options.find((o) => o.id === person.answers[q.id])?.kind !== 'choice');
      return <article className="comparison-card" key={q.id}><p className="eyebrow">{index + 1} / {q.dimension}</p><h2>{q.prompt}</h2><div className="answer-pair">{[a, b].map((person) => <div className="person-answer" key={person.slot}><span>{person.nickname}</span><p>{q.options.find((o) => o.id === person.answers[q.id])?.label}</p></div>)}</div><p className="conversation-prompt">{context ? '這題先保留各自回答，不需要補充原因。' : `一起確認：${q.discussion}`}</p><details><summary>這題的依據與限制</summary><p>{q.evidence.note}</p></details></article>;
    })}</div></details>
    <ResultLearningCards />
    <details className="trial-instructions"><summary>研究與結果規則</summary><p>{results.quiz.evidenceSummary}</p><p>回合工具 {results.quiz.version}；描述性分析 {analysis.ruleVersion}。只有兩邊均為主要選項才按本輪語意分類比較；其他、依情況改變、未確定、不適用、沒有經歷與未分享不生成提案。題庫與提案保存在本輪快照。</p></details>
    <div className="demo-actions"><a className="button secondary" href="#/history">查看最近紀錄</a><a className="button primary" href="#/start/communication">另開一輪 →</a></div>
  </section>;
}
