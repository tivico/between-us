import { useState } from 'react';
import { questionnaires } from '../content/questionnaires';
import type { QuizDefinition } from '../domain/quiz';
import type { RoundResults } from '../domain/round';
import { Motif } from './Motif';

export function QuestionnaireLibrary() {
  return <section className="qa-library"><p className="eyebrow">FOUR QUESTIONS, A LITTLE CLOSER</p>
    <h1 id="page-heading" tabIndex={-1}>今天，聊四題就好。</h1><p className="flow-intro">選一個想了解的面向，各自回答四題。一起看選擇與相處提案，想繼續再開另一組。</p>
    <p className="qa-library-note">每組都能獨立開始，沒有必玩順序。較私密的內容由你們自行選擇，每題也能暫不分享。</p>
    <div className="topic-grid">{questionnaires.map((quiz) => <a key={quiz.id} href={`#/questions/${quiz.id}`} className={`topic-card theme-${quiz.theme}`}>
      <div className="card-art"><span className="status-pill">四題 · {quiz.questionnaire?.depth}</span><Motif kind={quiz.motif} /></div>
      <div className="card-body"><h2>{quiz.title}</h2><p className="card-subtitle">{quiz.subtitle}</p><div className="card-footer"><span>選這組，慢慢聊</span><span className="circle-arrow" aria-hidden="true">↗</span></div></div>
    </a>)}</div>
    <details className="qa-source-note"><summary>問答的依據與分享方式</summary><p>這些是本站自編問答，研究作為概念背景，不是已驗證量表或關係成功率。雙方各自同意分享、提交後才解鎖本組答案；暫不分享會取代原選項，對方只看見未分享狀態。</p></details>
  </section>;
}

export function QuestionnaireIntro({ quiz }: { quiz: QuizDefinition }) {
  return <div className="detail-page"><a className="back-link" href="#/questions">← 回到雙人問答</a>
    <section className={`topic-intro theme-${quiz.theme}`}><div><p className="eyebrow">A LITTLE ABOUT US</p><h1 id="page-heading" tabIndex={-1}>{quiz.title}</h1><p className="intro-subtitle">{quiz.subtitle}</p><p className="intro-description">{quiz.description}</p><p className="intro-audience">四題 · {quiz.questionnaire?.depth} · {quiz.audience}</p>
      <a className="button primary" href={`#/start/${quiz.id}`}>開始這組四題 <span aria-hidden="true">→</span></a></div><div className="intro-art"><Motif kind={quiz.motif} /></div></section>
    <section className="preview-notice"><h2>只分享你願意的部分。</h2><p>你先回答，提交後邀請另一個人。雙方完成這四題，就能查看本組共同點、不同期待與給各自／兩人的相處提案。沒有總分，也不必完成其他七組。</p><p>每題可選「暫不分享」。這會取代該題原有選擇；雙方完成後只顯示「未分享」。提交後鎖定，想重新回答可另開一輪。</p></section>
    <details className="qa-source-note"><summary>研究來源與限制</summary><p>{quiz.evidenceSummary}</p><ul className="source-list">{quiz.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><p>{source.authors} · {source.year}</p><p>{source.scope}</p></li>)}</ul></details>
  </div>;
}

export function ConversationResults({ results }: { results: RoundResults }) {
  const [filter, setFilter] = useState<'all' | 'common' | 'different' | 'context'>('all');
  const [a, b] = results.participants;
  const comparison = results.conversation;
  if (!comparison) return <section role="alert"><h1 id="page-heading" tabIndex={-1}>問答整理暫時無法讀取。</h1><p>請重新整理；你的已提交答案仍保存於這一輪。</p></section>;
  const items = comparison.items.filter((item) => filter === 'all' || item.status === filter);
  const labels = { common: '共同選擇', different: '不同想法', context: '先保留更多情境' };
  return <section className="shared-results"><p className="eyebrow">FOUR ANSWERS, A SHARED MOMENT</p><h1 id="page-heading" tabIndex={-1}>四題之間，更認識你。</h1><p className="flow-intro">{a.nickname} 與 {b.nickname} · {results.quiz.title}</p>
    <p className="qa-library-note">這裡只整理本組四題。相同也可能有不同理由；差異是多了解一句的起點，相處提案可以一起決定是否嘗試。</p>
    <div className="filters qa-result-filters" role="group" aria-label="篩選問答整理">{(['all', 'common', 'different', 'context'] as const).map((value) => <button key={value} className={`filter ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? '全部四題' : labels[value]}</button>)}</div>
    {!items.length && <p className="empty-state" role="status">這一輪沒有這類整理，可以切換看看其他選擇。</p>}
    <div className="comparison-list">{items.map((item) => {
      const question = results.quiz.questions.find((value) => value.id === item.questionId)!;
      const first = question.options.find((option) => option.id === a.answers[question.id])!;
      const second = question.options.find((option) => option.id === b.answers[question.id])!;
      const withheld = first.kind === 'not-shared' || second.kind === 'not-shared';
      return <article key={item.questionId} className="comparison-card qa-result-card"><span className={`qa-result-tag qa-${item.status}`}>{labels[item.status]}</span><h2>{question.prompt}</h2>
        <div className="answer-pair">{[{ person: a, option: first }, { person: b, option: second }].map(({ person, option }) => <div className={`person-answer person-${person.slot.toLowerCase()}`} key={person.slot}><span>{person.nickname}</span><p>{option.label}</p></div>)}</div>
        <p className="qa-result-explanation">{item.status === 'common' ? '這一題雙方選擇相同；先確認背後的理由，別把同一選項當成已達成約定。' : item.status === 'different' ? '這一題的選擇不同，可以先說各自在這個情境需要什麼；不同不等於衝突或不適合。' : '這題包含未分享、尚未想清楚、依情境或其他狀態，因此不判定共同點或差異。'}</p>
        {item.status !== 'context' && <details className="qa-advice"><summary>給各自與兩人的相處提案</summary><div className="qa-advice-grid"><section><h3>給 {a.nickname}</h3><p>{item.forA}</p></section><section><h3>給 {b.nickname}</h3><p>{item.forB}</p></section></div><h3>給兩人</h3><p>{item.together}</p><p className="qa-advice-limit">這是依本輪選項整理的本站提案，不是已驗證的改善方案；界線與意願需要當次確認。</p></details>}
        {!withheld && <p className="conversation-prompt">想聊再聊：{item.discussion}</p>}
        <details className="question-evidence"><summary>這題的依據與限制</summary><p>{question.evidence.note}</p>{results.quiz.sources.filter((source) => question.evidence.sourceIds.includes(source.id)).map((source) => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.authors}（{source.year}） ↗</a></p>)}</details>
      </article>;
    })}</div>
    <div className="demo-actions"><a className="button secondary" href="#/history">查看最近紀錄</a><a className="button primary" href="#/questions">回題組列表，再玩一組 →</a></div>
  </section>;
}
