import type { RoundResults } from '../domain/round';
import type { MoneyReading } from '../domain/money-life';
import type { AnalysisEvidence } from '../domain/long-distance';
import './LongDistanceResults.css';

export function MoneyLifeResults({ results }: { results: RoundResults }) {
  const analysis = results.moneyLifeAnalysis;
  if (!analysis) return <div className="flow-error" role="alert">生活安排整理暫時無法讀取，請重新整理。</div>;
  const [a, b] = results.participants;
  const names = { A: a.nickname, B: b.nickname };
  const labels = { same: '同題選擇相同', different: '同題選擇不同', context: '保留各自情境' };
  const evidence = (items: AnalysisEvidence[]) => <dl className="distance-evidence">{items.map((e) => <div key={`${e.slot}-${e.questionId}`}><dt>{names[e.slot]} · {e.role}</dt><dd>{e.label}</dd></div>)}</dl>;
  const sources = (ids: string[]) => <>{ids.length === 0 && <p>此題為本站情境設計，沒有本題的直接研究證據。</p>}{results.quiz.sources.filter((s) => ids.includes(s.id)).map((s) => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.authors}（{s.year}）↗</a>：{s.scope}</p>)}</>;
  const readings = (items: MoneyReading[]) => <div className="distance-advice-grid">{items.map((item) => {
    const q = results.quiz.questions.find((q) => q.id === item.questionId)!;
    return <article className="distance-advice-card" key={item.questionId}>{item.state && <span className="distance-tag">{labels[item.state]}</span>}<h3>{item.title}</h3>{evidence(item.evidence)}{item.discussion && <p className="conversation-prompt">一起確認：{item.discussion}</p>}<details><summary>查看本題依據與限制</summary><p>{q.evidence.note}</p>{sources(q.evidence.sourceIds)}</details></article>;
  })}</div>;
  const comparable = analysis.pairs.filter((p) => p.state !== 'context');
  return <section className="shared-results money-life-results">
    <p className="eyebrow">CHOICES FOR OUR LIFE</p><h1 id="page-heading" tabIndex={-1}>先看願意與條件，再聊生活安排。</h1>
    <p className="flow-intro">{a.nickname} 與 {b.nickname} · {results.quiz.title}</p>
    <div className="preview-notice"><h2>這一輪，可以從哪裡開始理解彼此？</h2><p>先看兩人目前願意的範圍與條件，再確認想保留的生活及需要的資訊。{comparable.length ? `兩組資訊／確認方式的四個方向中，有 ${comparable.length} 個方向可按選項比較；每個方向的期待與做法分開呈現。` : '兩組資訊／確認方式目前沒有可配對的方向，先保留情境，不需要補充原因。'}</p><p>這份整理不提供契合或理財能力分數。相同不代表已能負擔、覺得公平或同意付款；不同不代表衝突。選答、沉默與過去安排都不能代替當次參與、付款或使用帳戶的許可。</p></div>
    <section className="preview-notice"><h2>從這輪回答看到的生活起點</h2>{analysis.preferences.filter((item) => ['money-life-priority', 'money-split-principle'].includes(item.questionId)).map((item) => <div key={item.questionId}><h3>{item.questionId === 'money-life-priority' ? '目前最想保留的生活' : '共同花費的分攤起點'}</h3>{item.state === 'same' ? <p>雙方在這題都選「{item.evidence[0].label}」。這是共同的討論起點，還需要輪流說明各自的理由，並核對下面的本人條件與願意範圍。</p> : item.state === 'different' ? <p>{names.A} 選「{item.evidence[0].label}」，{names.B} 選「{item.evidence[1].label}」。可以從同一個雙方願意聊的生活安排，確認兩個選擇各想保留什麼；目前不據此判定衝突或要求折衷。</p> : <p>這題先保留各自情境，沒有足夠的主要選項形成共同或不同的起點。不需要補充原因，仍可先看各自願意分享的範圍。</p>}</div>)}</section>
    <section className="distance-findings"><h2>本人目前願意的範圍</h2><p>每個人願意集中處理的範圍各自保留，不判相同或不同，也不要求折衷。可以保留目前回答，不必補充理由。</p>{readings(analysis.boundaries)}</section>
    <section className="distance-findings"><h2>各自的現實條件</h2><p>條件分開呈現；偏好相同也不能覆蓋這次不參加的選擇，不要求提出替代活動或更多出錢。</p>{readings(analysis.constraints)}</section>
    <section className="distance-findings"><h2>分攤、生活優先與準備分工</h2><p>這裡只描述主要選項相同或不同，相同不表示理由相同、已能負擔或覺得公平。其他想法與未分享先保留情境；分工選擇也不代表已答應擔任。</p>{readings(analysis.preferences)}</section>
    <section className="distance-findings"><h2>各自想先確認的事</h2><p>這裡分開看各自想先確認什麼，不代表已同意、已預留款項或已出現衝突。未確定與不適用也不表示沒有投入。</p>{readings(analysis.processes)}</section>
    <section className="distance-findings"><h2>期待與做法，逐方向確認</h2><p>每組分開看你的期待與對方自述的做法，再看反向。只有兩邊都選主要方式才配對；其他、依情況改變、未確定、沒有經歷、不適用與未分享只保留情境，不給個別提案。</p><div className="distance-advice-grid">{analysis.pairs.map((pair) => <article className="distance-advice-card" key={pair.id}>
      <span className="distance-tag">{pair.state === 'context' ? '保留情境，先不配對解讀' : pair.state === 'same' ? '這個方向選到同一類方式' : '這個方向選到不同方式'}</span>
      <h3>{pair.title}：{names[pair.wantedSlot]} 的期待 ← {names[pair.providedSlot]} 的做法</h3>{evidence(pair.evidence)}
      <p>{pair.state === 'context' ? '這個方向沒有足夠的主要選項可配對，不猜未來，也不判投入程度。' : '以上是本輪期待與最近一個月自述的第一步，需要再確認實際意思；不代表已協商或決定參加。'}</p>
      {pair.advice && <><p className="answer-dimension">給 {names[pair.providedSlot]} 的可選提案 · 本站設計</p><p className="distance-action">{pair.advice}</p><p className="conversation-prompt">一起確認：{pair.discussion}</p></>}
      <details><summary>查看本輪依據與限制</summary>{pair.evidence.map((e) => <p key={e.questionId}>{names[e.slot]} 回答「{e.prompt}」：{e.label}</p>)}<p>研究提供概念，本站配對與提案效果尚未驗證。</p>{sources([...new Set(pair.evidence.flatMap((e) => results.quiz.questions.find((q) => q.id === e.questionId)!.evidence.sourceIds))])}</details>
    </article>)}</div></section>
    <section className="preview-notice"><h2>把選擇變成新的理解</h2><ol><li>各選一個這次才注意到的範圍、條件或期待。</li><li>用一個雙方願意聊的生活情境輪流分享意思，可以保留私人細節。</li><li>回述這次才知道的需要或限制，請對方確認是否理解。</li><li>若雙方願意，再確認一個小安排與調整方式；也可以先不安排。</li></ol></section>
    <details className="raw-answer-details"><summary>查看完整 12 題的彼此答案</summary><div className="comparison-list">{results.quiz.questions.map((q, index) => <article className="comparison-card" key={q.id}><p className="eyebrow">{index + 1} / {q.dimension}</p><h2>{q.prompt}</h2>{evidence(([a, b]).map((p) => ({ slot: p.slot, questionId: q.id, prompt: q.prompt, label: q.options.find((o) => o.id === p.answers[q.id])!.label, role: '本輪回答' })))}<p>{q.evidence.note}</p></article>)}</div></details>
    <details className="trial-instructions"><summary>研究與結果規則</summary><p>{results.quiz.evidenceSummary}</p><p>回合工具 {results.quiz.version}；描述性分析 {analysis.ruleVersion}。題目、分類與提案保存在本輪快照；新條件請另開一輪。其他、依情況改變、未確定、沒經歷、不適用與未分享不生成個別提案。</p></details>
    <div className="demo-actions"><a className="button secondary" href="#/history">查看最近紀錄</a><a className="button primary" href="#/start/money-life">另開一輪 →</a></div>
  </section>;
}
