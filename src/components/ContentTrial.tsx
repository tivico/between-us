import { useEffect, useRef, useState } from 'react';
import { Motif } from './Motif';
import { summarizeTrial, type TrialAnswers, type TrialDefinition } from '../domain/trial';

export function ContentTrial({ trial }: { trial: TrialDefinition }) {
  const [phase, setPhase] = useState<'intro' | 'questions' | 'summary'>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<TrialAnswers>({});
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [focusOnly, setFocusOnly] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = trial.questions[index];
  const summary = summarizeTrial(trial, answers, flagged);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [phase, index]);

  function toggleFlag(id: string) {
    setFlagged((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function nextQuestion() {
    if (index + 1 === trial.questions.length) setPhase('summary');
    else setIndex((previous) => previous + 1);
  }
  function revisit(nextIndex: number) {
    setIndex(nextIndex);
    setPhase('questions');
  }
  const sources = <details className="trial-sources"><summary>研究來源與目前的限制</summary>
    <p>這是依 PVQ-RR 改寫的性別中性措辭候選稿，用來確認題意與作答體驗。原工具的研究證據與本改寫版的驗證分開看。</p>
    <ul>{trial.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><p>{source.description}</p></li>)}</ul>
  </details>;

  return <div className="trial-page">
    <a className="back-link" href="#/topics/core-values">← 回到主題介紹{phase !== 'intro' && '（離開會清除試答）'}</a>
    {phase === 'intro' ? <>
      <section className="trial-intro theme-sage">
        <div><span className="status-pill status-draft">57 題・內容試讀</span><p className="eyebrow">A MOMENT TO UNDERSTAND YOURSELF</p>
          <h1 id="page-heading" ref={heading} tabIndex={-1}>讀一個人，<br />也讀懂<span className="emphasis">自己</span>。</h1>
          <p className="intro-subtitle">哪些事，對現在的你很重要？</p>
          <p className="intro-description">每題描述一個不限定性別的人。讀一讀，再選擇這個人有多像你。各種性向與性別認同，都使用同一份題目。</p>
          <button className="button primary" onClick={() => setPhase('questions')}>開始 57 題試讀 <span aria-hidden="true">→</span></button>
        </div><div className="trial-intro-art"><Motif kind="arches" /></div>
      </section>
      <div className="trial-expectations">
        <div><span className="eyebrow">01 / 慢慢回答</span><h2>照自己的想法選。</h2><p>六段選項，沒有標準答案。讀不懂或不好選時，可以先跳過。</p></div>
        <div><span className="eyebrow">02 / 留下疑問</span><h2>標記想再讀的題目。</h2><p>試讀後，會一起整理你的選項、未答題與想再讀的題號。</p></div>
        <div><span className="eyebrow">03 / 這一頁的選擇</span><h2>給自己的一次預覽。</h2><p>答案只留在這一頁，不保存或分享。離開、關閉或重新整理會清除。</p></div>
      </div>
      <p className="trial-status">中性措辭候選稿 {trial.version}・尚在審查・此試讀不提供量表分數或契合度</p>
      {sources}
    </> : phase === 'questions' ? <>
      <div className="demo-top"><span>核心價值・內容試讀</span><span>中性措辭 {trial.version}</span></div>
      <div className="progress-meta"><span>第 {index + 1} 題 / {trial.questions.length}</span><span>已答 {summary.answered} 題</span></div>
      <progress value={summary.answered} max={trial.questions.length} aria-label="已作答題數" />
      <section className="trial-question">
        <p className="eyebrow">A LITTLE ABOUT YOU</p><h1 id="page-heading" ref={heading} tabIndex={-1}>{question.prompt}</h1>
        <p className="question-help">這個人有多像你？請以你自己的想法作答。</p>
        <fieldset className="trial-options"><legend className="sr-only">第 {question.number} 題：這個人有多像你？</legend>
          {trial.options.map((option) => <label className={`trial-option ${answers[question.id] === option.id ? 'selected' : ''}`} key={option.id}>
            <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: option.id }))} />
            <span className="trial-radio" aria-hidden="true">{answers[question.id] === option.id ? '✓' : ''}</span><span>{option.label}</span>
          </label>)}
        </fieldset>
        <label className="trial-flag"><input type="checkbox" checked={flagged.has(question.id)} onChange={() => toggleFlag(question.id)} /><span>這題想再讀</span></label>
        <div className="demo-actions"><button className="button secondary" disabled={index === 0} onClick={() => setIndex((previous) => previous - 1)}>← 上一題</button>
          <button className="button primary" disabled={!answers[question.id]} onClick={nextQuestion}>{index + 1 === trial.questions.length ? '查看試讀整理' : '下一題'} <span aria-hidden="true">→</span></button></div>
        {!answers[question.id] && <button className="text-button trial-skip" onClick={nextQuestion}>{index + 1 === trial.questions.length ? '先跳過，查看整理' : '先跳過這題'} →</button>}
        <p className="trial-session-note">答案只留在這一頁；離開或重新整理會清除。</p>
        <button className="text-button" onClick={() => setPhase('summary')}>查看目前整理 →</button>
        <details className="trial-instructions"><summary>再看一次作答說明</summary><p>{trial.instructions}</p></details>
      </section>
    </> : <section className="trial-summary">
      <p className="eyebrow">YOUR READING NOTES</p><h1 id="page-heading" ref={heading} tabIndex={-1}>你的選擇，<br />與想再讀的題目。</h1>
      <p className="summary-intro">先看看哪些描述像你，哪些地方還想釐清。這裡整理你的試答，不產生分數或伴侶比較。</p>
      <dl className="trial-counts"><div><dt>已答</dt><dd>{summary.answered}<span> 題</span></dd></div><div><dt>未答</dt><dd>{summary.unanswered}<span> 題</span></dd></div><div><dt>想再讀</dt><dd>{summary.flagged}<span> 題</span></dd></div></dl>
      <div className="trial-summary-actions"><button className="button secondary" onClick={() => revisit(0)}>返回試答</button><a className="back-link" href="#/topics/core-values">結束試讀（清除選擇） →</a></div>
      <div className="trial-review-guide"><h2>覺得難懂的地方，可以從這裡說起。</h2><p>你可以記下題號，想想「這題在問什麼？」、「哪個字不好懂？」或「哪兩個選項不好區分？」。不需要分享私人答案。</p><p>完整題庫仍在審查中。這份整理用來了解題意與作答體驗，不代表測量驗證已經完成。</p></div>
      <label className="trial-filter"><input type="checkbox" checked={focusOnly} onChange={() => setFocusOnly((previous) => !previous)} /><span>只看未答與想再讀的題目</span></label>
      <ol className="trial-answer-list">{summary.rows.filter((row) => !focusOnly || row.flagged || !row.answer).map((row) => <li key={row.id}>
        <div className="trial-answer-meta"><span>第 {row.number} 題</span>{row.flagged && <span className="trial-tag">想再讀</span>}</div>
        <h2>{row.prompt}</h2><p className={row.answer ? 'trial-answer' : 'trial-unanswered'}>{row.answer ?? '未作答'}</p>
        <button className="text-button" onClick={() => revisit(row.number - 1)}>重新閱讀第 {row.number} 題 →</button>
      </li>)}</ol>
      {focusOnly && !summary.rows.some((row) => row.flagged || !row.answer) && <p className="trial-empty">目前沒有未答或標記的題目。取消篩選即可查看全部選項。</p>}
      {sources}
    </section>}
  </div>;
}
