import { useEffect, useRef, useState } from 'react';
import type { RoundResults } from '../domain/round';

export function ResultOpening({ results }: { results: RoundResults }) {
  const opening = results.resultOpening;
  const [chosen, setChosen] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = opening?.findings.find((f) => f.id === chosen);
  useEffect(() => { if (chosen) heading.current?.focus(); }, [chosen]);
  if (!opening) return <p>本輪摘要暫時無法讀取，仍可展開完整主題整理。</p>;
  const names = Object.fromEntries(results.participants.map((p) => [p.slot, p.nickname]));
  return <section className="result-opening" aria-labelledby="opening-heading">
    <div className="opening-discovery"><p className="eyebrow">WHAT WE DISCOVERED</p><h2 id="opening-heading">這輪，看見彼此什麼？</h2><p>{opening.discovery}</p>{opening.discoveryEvidence?.length > 0 && <details><summary>查看整體理解的作答依據</summary><dl>{opening.discoveryEvidence.map((e) => <div key={`${e.slot}-${e.questionId}`}><dt>{names[e.slot]} · {e.role}</dt><dd>{e.prompt}<br /><strong>{e.label}</strong></dd></div>)}</dl></details>}</div>
    {opening.findings.length > 0 && <><p className="local-note">摘要沿用本輪分析的選取規則，供挑選聊天入口，不是衝突程度排名。你們可以自行選擇，也可以先不聊。</p><div className="opening-grid">{opening.findings.map((f) => <article className="opening-card" key={f.id}>
      <span className="distance-tag">{f.category}</span><h3>{f.title}</h3><p>{f.fact}</p>
      <details><summary>查看這個發現的作答依據</summary><dl>{f.evidence.map((e) => <div key={`${e.slot}-${e.questionId}`}><dt>{names[e.slot]} · {e.role}</dt><dd>{e.prompt}<br /><strong>{e.label}</strong></dd></div>)}</dl></details>
      <button className="button secondary" onClick={() => setChosen(f.id)}>今天先聊這一件 →</button>
    </article>)}</div></>}
    {active && <section className="opening-chat preview-notice" aria-live="polite"><h2 ref={heading} tabIndex={-1}>一起聊：{active.title}</h2><p className="conversation-prompt">本站討論提案：{active.question}</p><ol><li>先讀出這個發現，確認答案代表的意思。</li><li>回到一個雙方願意聊的生活情境。</li><li>輪流分享理由與需要，另一人先聽，再交換。</li><li>回述今天才理解的地方，讓對方確認或修正。</li></ol><p>可以隨時停下，不必透露私人事件或做出安排。選擇只留在本頁，不保存或同步。</p><button className="text-button" onClick={() => setChosen(null)}>收起聊天入口</button></section>}
    <p className="local-note">摘要閱讀層 {opening.version}；作答事實與本站討論提案分開，研究及分析規則見完整整理。</p>
  </section>;
}
