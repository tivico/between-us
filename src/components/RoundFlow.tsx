import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { QuizDefinition } from '../domain/quiz';
import type { InvitationPreview, RoundResults, RoundStatus } from '../domain/round';
import { api, ApiError, createPrivateToken, messageOf } from '../lib/api';
import { absoluteLink, forgetRound, recentRounds, rememberRound, roundPath } from '../lib/history';

const dateOf = (value: string) => new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeZone: 'Asia/Taipei' }).format(new Date(value));

function ErrorNotice({ message, retry, retryLabel = '重試' }: { message: string; retry?: () => void; retryLabel?: string }) {
  return <div className="flow-error" role="alert"><p>{message}</p>{retry && <button className="button secondary" onClick={retry}>{retryLabel}</button>}</div>;
}

function LinkCard({ title, note, path }: { title: string; note: string; path: string }) {
  const [copyState, setCopyState] = useState('');
  const value = absoluteLink(path);
  return <section className="link-card"><h2>{title}</h2><p>{note}</p><div className="link-controls"><input aria-label={title} readOnly value={value} onFocus={(event) => event.target.select()} /><button className="button secondary" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setCopyState('已複製'); }
    catch { setCopyState('請選取連結後手動複製'); }
  }}>複製連結</button></div><span className="copy-feedback" role="status">{copyState}</span></section>;
}

function EntryForm({ title, invitation, invitationToken, quiz }: { title: string; invitation?: InvitationPreview; invitationToken?: string; quiz?: QuizDefinition }) {
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [token] = useState(createPrivateToken);
  async function enter(event: FormEvent) {
    event.preventDefault();
    if (busy || !consent || !nickname.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ id: string }>(invitation ? '/invitations/claim' : '/rounds', { method: 'POST', body: { nickname, consent, privateToken: token, ...(invitation ? { invitationToken } : { quizId: quiz?.id }) } });
      rememberRound({ id: result.id, token, title, nickname: nickname.trim(), createdAt: new Date().toISOString() });
      location.hash = roundPath(result.id, token).slice(1);
    } catch (failure) { setError(messageOf(failure)); setBusy(false); }
  }
  return <div className="flow-page"><a className="back-link" href="#/">← 回到主題館</a><p className="eyebrow">A CONVERSATION FOR TWO</p><h1 id="page-heading" tabIndex={-1}>{invitation ? `${invitation.hostName} 想更認識你。` : '先從你自己開始。'}</h1><p className="flow-intro">{title} · {invitation?.questionCount ?? quiz?.questions.length} 題流程示例</p>
    <div className="preview-notice"><h2>這一輪，我們會分享什麼？</h2><p>你們各自填答，彼此完成後，才會公開本輪所有選項。提交後答案鎖定；想重新回答時，另開一輪。</p><p>目前使用三題自編示例，尚未驗證，不提供契合分數。答案會保存在此電腦的本機服務，保存期限尚未定案。</p></div>
    {invitation?.claimed ? <ErrorNotice message="這個邀請已有人加入。請使用自己的私人返回連結，或從最近紀錄返回。" /> : <form className="entry-form" onSubmit={enter}>
      <label className="field-label" htmlFor="nickname">你希望對方怎麼稱呼你？</label><input className="name-input" id="nickname" value={nickname} maxLength={24} required autoComplete="off" placeholder="你的暱稱" onChange={(event) => setNickname(event.target.value)} disabled={busy} />
      <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy} /><span>我同意雙方完成後，彼此查看本輪所有答案。</span></label>
      {error && <ErrorNotice message={error} />}
      <button className="button primary" disabled={busy || !consent || !nickname.trim()}>{busy ? '正在準備…' : invitation ? '接受邀請，開始填答' : '建立這一輪，開始填答'} <span aria-hidden="true">→</span></button>
    </form>}
    <p className="local-note">目前連結供同一電腦的不同瀏覽器測試。網站與後端上線後，才能邀請遠方的人。</p>
  </div>;
}

export function StartRound({ quiz }: { quiz: QuizDefinition }) { return <EntryForm title={quiz.title} quiz={quiz} />; }

export function JoinRound({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState('');
  async function load() { setError(''); try { setInvitation(await api<InvitationPreview>('/invitations/preview', { token })); } catch (failure) { setError(messageOf(failure)); } }
  useEffect(() => { void load(); }, [token]);
  useEffect(() => { document.getElementById('page-heading')?.focus(); }, [Boolean(invitation), error]);
  if (error) return <div className="flow-page"><h1 id="page-heading" tabIndex={-1}>先確認這份邀請。</h1><ErrorNotice message={error} retry={() => void load()} /><a className="back-link" href="#/history">查看此裝置紀錄</a></div>;
  if (!invitation) return <div className="flow-page" role="status">正在讀取邀請…</div>;
  return <EntryForm key={token} title={invitation.title} invitation={invitation} invitationToken={token} />;
}

export function HistoryPage() {
  const [records, setRecords] = useState(recentRounds);
  const [error, setError] = useState('');
  return <div className="flow-page"><p className="eyebrow">YOUR RECENT MOMENTS</p><h1 id="page-heading" tabIndex={-1}>留給你們的紀錄。</h1><p className="flow-intro">此瀏覽器最近的 20 個入口。清除瀏覽器資料後，可用保留的私人連結返回；使用此瀏覽器的人也能開啟這些入口。</p>
    {error && <ErrorNotice message={error} />}
    {!records.length ? <div className="empty-state"><h2>還沒有留下的回合。</h2><p>選一個主題，開始你們的第一次探索。</p><a className="button primary" href="#/">找一個主題 →</a></div> : <ul className="history-list">{records.map((record) => <li key={`${record.id}:${record.token}`}><div><span className="answer-dimension">{record.nickname} · {dateOf(record.createdAt)}</span><h2>{record.title}</h2><a className="button secondary" href={roundPath(record.id, record.token)}>返回這一輪 →</a></div><button className="text-button" onClick={() => {
      try { forgetRound(record.id, record.token); setRecords(recentRounds()); }
      catch { setError('此瀏覽器不允許變更最近紀錄。'); }
    }}>移除此裝置入口</button></li>)}</ul>}
    <p className="local-note">移除入口不會刪除後端答案。再次開啟私人連結會重新加入最近紀錄；資料刪除與保存期限仍待定案，請保留自己的私人返回連結。</p>
  </div>;
}

function SharedResults({ results }: { results: RoundResults }) {
  const [a, b] = results.participants;
  const same = results.quiz.questions.filter((question) => a.answers[question.id] === b.answers[question.id]).length;
  return <section className="shared-results"><p className="eyebrow">TWO ANSWERS, ONE CONVERSATION</p><h1 id="page-heading" tabIndex={-1}>一起看見，你們的選擇。</h1><p className="flow-intro">{a.nickname} 與 {b.nickname} · {results.quiz.title}</p>
    <div className="result-overview"><div><strong>{same}</strong><span>題選項相同</span></div><div><strong>{results.quiz.questions.length - same}</strong><span>題選項不同</span></div><p>這只是本輪選項的比較，不是三觀契合度。相同選項也可能有不同理由，差異則是再問一句的起點。</p></div>
    <div className="comparison-list">{results.quiz.questions.map((question, index) => <article key={question.id} className="comparison-card"><p className="eyebrow">0{index + 1} / {question.dimension}</p><h2>{question.prompt}</h2><div className="answer-pair">{[a, b].map((person) => <div className={`person-answer person-${person.slot.toLowerCase()}`} key={person.slot}><span>{person.nickname}</span><p>{question.options.find((option) => option.id === person.answers[question.id])?.label}</p></div>)}</div><p className="conversation-prompt">一起聊聊：你選這個答案時，想到的是什麼經驗或考量？</p><details className="question-evidence"><summary>這題的依據與限制</summary><p>{question.evidence.note}</p>{results.quiz.sources.filter((source) => question.evidence.sourceIds.includes(source.id)).map((source) => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.authors}（{source.year}） ↗</a></p>)}</details></article>)}</div>
    <div className="preview-notice"><h2>理解，從再問一句開始。</h2><p>本輪是雙人流程測試。正式量表與科普內容核定後，再加入核心價值同頻度、人生方向交集與相關說明。</p></div>
    <div className="demo-actions"><a className="button secondary" href="#/history">查看最近紀錄</a><a className="button primary" href={`#/start/${results.quiz.id}`}>另開一輪 →</a></div>
  </section>;
}

export function RoundPage({ id, token }: { id: string; token: string }) {
  const [round, setRound] = useState<RoundStatus | null>(null);
  const [results, setResults] = useState<RoundResults | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [reloadRequired, setReloadRequired] = useState(false);
  const [pending, setPending] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [historySaved, setHistorySaved] = useState(true);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve());
  const failed = useRef('');
  const latestAnswers = useRef<Record<string, string>>({});
  const mounted = useRef(true);

  async function load(initial = false) {
    try {
      const current = await api<RoundStatus>(`/rounds/${id}/status`, { token });
      if (!mounted.current) return;
      setRound(current); setError('');
      if (initial) {
        failed.current = ''; setSaveError(''); setReloadRequired(false);
        revision.current = current.own.revision;
        setAnswers(current.own.answers); latestAnswers.current = current.own.answers;
        const next = current.quiz.questions.findIndex((question) => !current.own.answers[question.id]);
        setIndex(Math.max(0, next)); setReview(next === -1);
      }
      setHistorySaved(rememberRound({ id, token, title: current.quiz.title, nickname: current.own.nickname, createdAt: current.createdAt }));
      if (current.state === 'unlocked') {
        const shared = await api<RoundResults>(`/rounds/${id}/results`, { token });
        if (mounted.current) setResults(shared);
      }
    } catch (failure) { if (mounted.current) setError(messageOf(failure)); }
  }
  useEffect(() => {
    mounted.current = true; void load(true);
    return () => { mounted.current = false; };
  }, [id, token]);
  useEffect(() => {
    if (!round || round.state !== 'waiting') return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [round?.state]);
  useEffect(() => { document.getElementById('page-heading')?.focus(); }, [index, review, Boolean(results), round?.state]);

  function save(snapshot: Record<string, string>) {
    setPending((count) => count + 1);
    queue.current = queue.current.then(async () => {
      if (failed.current) return;
      try {
        const response = await api<{ revision: number }>(`/rounds/${id}/answers`, { token, method: 'PUT', body: { answers: snapshot, revision: revision.current } });
        revision.current = response.revision;
      } catch (failure) {
        failed.current = messageOf(failure);
        if (mounted.current) {
          setSaveError(failed.current);
          setReloadRequired(failure instanceof ApiError && ['STALE_REVISION', 'ROUND_LOCKED'].includes(failure.code));
        }
      }
    }).finally(() => { if (mounted.current) setPending((count) => count - 1); });
  }
  function choose(questionId: string, optionId: string) {
    const next = { ...latestAnswers.current, [questionId]: optionId };
    latestAnswers.current = next; setAnswers(next); save(next);
  }
  async function submit() {
    if (submitting) return;
    setSubmitting(true); setError('');
    try {
      await queue.current;
      if (failed.current) throw new Error('還有未保存的答案，請先重試儲存。');
      const current = await api<RoundStatus>(`/rounds/${id}/submit`, { token, method: 'POST', body: {} });
      if (mounted.current) setRound(current);
      await load();
    } catch (failure) { if (mounted.current) setError(messageOf(failure)); }
    finally { if (mounted.current) setSubmitting(false); }
  }
  if (!round) return <div className="flow-page">{error ? <><h1 id="page-heading" tabIndex={-1}>找回這一輪。</h1><ErrorNotice message={error} retry={() => void load(true)} /><a className="back-link" href="#/history">查看此裝置紀錄</a></> : <p role="status">正在找回你的紀錄…</p>}</div>;
  const question = round.quiz.questions[index];
  const privateLink = <LinkCard title="你的私人返回連結" note="保留給自己，關掉頁面後可繼續或看結果。持有連結的人能開啟你的紀錄，請勿轉傳。" path={roundPath(id, token)} />;
  return <div className="flow-page round-page">
    <div className="flow-top"><a className="back-link" href="#/history">← 最近紀錄</a><span>{round.own.nickname} · {round.quiz.title}</span></div>
    <p className="demo-disclaimer">雙人流程測試 · 三題自編示例尚未驗證 · 不提供契合分數</p>
    {!historySaved && <ErrorNotice message="此瀏覽器未能保存最近紀錄入口，請另外保留私人返回連結。" />}
    {error && <ErrorNotice message={error} retry={() => void load(!round.own.submittedAt)} />}
    {results ? <SharedResults results={results} /> : round.own.submittedAt ? <section className="waiting-panel"><p className="eyebrow">A LITTLE PATIENCE, A SHARED MOMENT</p><h1 id="page-heading" tabIndex={-1}>你的答案，先好好保留。</h1><p className="flow-intro">{round.peer ? `${round.peer.nickname} 已加入，等待對方完成。` : '分享邀請，讓另一個人在自己的時間裡回答。'}</p><div className="participant-progress"><div><span className="done-dot">✓</span><strong>{round.own.nickname}</strong><span>已完成</span></div><div><span className="waiting-dot">○</span><strong>{round.peer?.nickname ?? '另一個人'}</strong><span>{round.peer ? '填答中' : '尚未加入'}</span></div></div><p className="waiting-note">雙方完成後才會解鎖答案。這個頁面會定期更新，也可以手動確認。</p><button className="button secondary" onClick={() => void load()}>更新完成狀態</button>{round.invitationToken && <LinkCard title="給另一個人的邀請連結" note="只邀請一人加入。這個連結不包含你的私人返回憑證。" path={`#/invite/${round.invitationToken}`} />}</section> : <>
      <div className="save-status" role="status">{saveError ? '尚有答案未保存' : pending ? '正在儲存…' : '已儲存至本機服務'}</div>
      {saveError && <ErrorNotice message={saveError} retryLabel={reloadRequired ? '重新載入最新紀錄，取代未保存選擇' : '重試儲存'} retry={() => {
        if (reloadRequired) void load(true);
        else { failed.current = ''; setSaveError(''); save(latestAnswers.current); }
      }} />}
      {review ? <section><p className="eyebrow">BEFORE WE SHARE</p><h1 id="page-heading" tabIndex={-1}>確認你的選擇。</h1><p className="flow-intro">提交後，本輪答案會鎖定；雙方完成後彼此可查看。</p><ol className="answer-list">{round.quiz.questions.map((item) => <li key={item.id}><span className="answer-dimension">{item.dimension}</span><h2>{item.prompt}</h2><p>{item.options.find((option) => option.id === answers[item.id])?.label ?? '尚未回答'}</p></li>)}</ol><div className="demo-actions"><button className="button secondary" onClick={() => { setReview(false); setIndex(0); }}>修改答案</button><button className="button primary" disabled={submitting || pending > 0 || Boolean(saveError) || !round.quiz.questions.every((item) => answers[item.id])} onClick={() => void submit()}>{submitting ? '正在提交…' : '確認提交，鎖定答案'}</button></div></section> : <>
        <div className="progress-meta"><span>問題 {index + 1} / {round.quiz.questions.length}</span><span>{question.dimension}</span></div><progress value={index + 1} max={round.quiz.questions.length} aria-label="目前題目進度" />
        <section className="question-panel"><p className="eyebrow">A LITTLE ABOUT YOU</p><h1 id="page-heading" tabIndex={-1}>{question.prompt}</h1><p className="question-help">{question.help}</p><fieldset className="options"><legend className="sr-only">{question.prompt}</legend>{question.options.map((option, optionIndex) => <label className={`option ${answers[question.id] === option.id ? 'selected' : ''}`} key={option.id}><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => choose(question.id, option.id)} /><span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><span>{option.label}</span><span className="option-check" aria-hidden="true">{answers[question.id] === option.id ? '✓' : ''}</span></label>)}</fieldset><div className="demo-actions"><button className="button secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一題</button><button className="button primary" disabled={!answers[question.id]} onClick={() => index + 1 === round.quiz.questions.length ? setReview(true) : setIndex(index + 1)}>{index + 1 === round.quiz.questions.length ? '確認我的選擇' : '下一題'} →</button></div><details className="question-evidence" key={question.id}><summary>這題的設計依據</summary><p>{question.evidence.note}</p></details></section>
      </>}
    </>}
    {privateLink}
  </div>;
}
