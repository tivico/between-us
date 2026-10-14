import { DailyOptions, editDailyAnswer } from './DailyValues';
import { useEffect, useRef, useState } from 'react';
import { getQuiz } from '../content/quizzes';
import { QuestionnaireLibrary, QuestionnaireIntro } from './QuestionnairePages';
import { Motif } from './Motif';
import { HistoryPage, JoinRound, RoundPage, StartRound } from './RoundFlow';
import { ContentTrial } from './ContentTrial';
import { coreValuesTrial } from '../content/core-values-trial';
import type { QuizDefinition, TopicStatus } from '../domain/quiz';
import type { Route } from '../lib/routes';
import { topicDepth, topicOutcome } from '../content/topic-guide';
const statusLabels: Record<TopicStatus, string> = { draft: '可預覽', planned: '籌備中', ready: '已開放' };
function Arrow() { return <span aria-hidden="true">↗</span>; }

function Sources({ quiz }: { quiz: QuizDefinition }) {
  return <section className="sources" aria-labelledby="sources-heading"><p className="eyebrow">RESEARCH & TRANSPARENCY</p><h2 id="sources-heading">這個主題的依據</h2><p>{quiz.evidenceSummary}</p>
    {quiz.sources.length > 0 && <ul className="source-list">{quiz.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} <Arrow /></a><p className="source-author">{source.authors} · {source.year}</p><p>{source.scope}</p></li>)}</ul>}
  </section>;
}

function Topic({ quiz }: { quiz: QuizDefinition }) {
  return <div className="detail-page">
    <a className="back-link" href="#/">← 回到主題館</a>
    <section className={`topic-intro theme-${quiz.theme}`}>
      <div><span className={`status-pill status-${quiz.status}`}>{statusLabels[quiz.status]}</span><p className="eyebrow intro-eyebrow">A CONVERSATION STARTER</p><h1 id="page-heading" tabIndex={-1}>{quiz.title}</h1><p className="intro-subtitle">{quiz.subtitle}</p><p className="intro-description">{quiz.description}</p><p className="intro-audience">適合：{quiz.audience}</p>

        {quiz.questions.length > 0 ? <div className="topic-actions"><a className="button primary" href={`#/start/${quiz.id}`}>{quiz.dailyValues ? '開始 8 情境雙人探索' : quiz.scoring ? '開始 57 題雙人探索' : quiz.moneyLife ? '開始 12 題雙人探索' : quiz.communication || quiz.analysis ? '開始 24 題雙人探索' : '開始雙人體驗'} <Arrow /></a><a className="back-link" href={quiz.scoring ? "#/trial/core-values" : `#/demo/${quiz.id}`}>{quiz.scoring ? '先自己探索（不保存）' : '先看單人介面預覽'}</a></div> : <p className="coming-soon">這個主題正在準備，尚未開放作答。</p>}
      </div><div className="intro-art"><Motif kind={quiz.motif} /></div>
    </section>
    <div className="detail-columns"><section><p className="eyebrow">WHAT WE WILL EXPLORE</p><h2>{quiz.scoring ? '19 個價值方向' : '我們會聊到'}</h2><ul className="dimension-list">{quiz.dimensions.map((dimension, index) => <li key={dimension}><span>{String(index + 1).padStart(2, '0')}</span>{dimension}</li>)}</ul></section>
      <aside className="preview-notice"><h2>{quiz.questions.length ? '給自己，也給彼此' : '為重要的話題，好好準備'}</h2><p>{quiz.dailyValues ? '八情境各四步，答案會自動保存。雙方提交後看選擇理由、共同接受的安排與值得先聊的期待。工作題另看對方能接受哪些個人選擇；暫不分享會取代整個情境，不提供契合分數。' : quiz.id === 'core-values' ? '57 題雙人探索會自動保存；你完成後邀請對方，兩人完整提交才解鎖彼此選項、19 類價值比較與核心價值相近度。相近度是探索性指標，不是關係成功率。' : quiz.moneyLife ? '12 題會自動保存，雙方提交後分開看本人願意的範圍、現實條件、偏好與兩組期待／做法配對。暫不分享取代原選項；選答不是付款或帳戶許可，不提供契合分數。自編題庫與提案效果尚未驗證。' : quiz.communication ? '24 題會自動保存，直接問自己的做法與希望收到的方式；雙方完成後看雙向配對與可選提案。可選暫不分享，未分享取代原選項。自編題庫與提案尚未驗證，不提供契合分數。' : quiz.analysis ? '24 題會自動保存，雙方完整提交後查看彼此選項、共同點、差異與討論建議。可以選暫不分享；三段是內容分類，題庫與建議尚未驗證，不提供契合分數。' : quiz.questions.length ? '三題自編示例尚未驗證，不提供正式分數。雙人測試會保存答案，完成後彼此可看；單人介面預覽則不保存或分享。' : '題目與結果規則仍在設計。研究與內容確認後，才會開放完整的雙人體驗。'}</p></aside>
    </div>
    {quiz.questions.length > 0 && <section className="preview-notice topic-expectation"><h2>開始前，先知道會得到什麼。</h2><p><strong>{topicDepth(quiz)}</strong> · {quiz.dailyValues ? "8 情境、32 步" : `${quiz.questions.length} 題`}</p><p>雙方完成後：{topicOutcome(quiz)}。</p><p>雙人回合自動保存，可稍後續答；提交後鎖定，重答需另開一輪。單人預覽不保存。完成時間尚未實測，依自己的步調回答。</p><p><a href="#/privacy">資料保存、分享與退出說明 →</a></p></section>}
    <Sources quiz={quiz} />
  </div>;
}

function Demo({ quiz }: { quiz: QuizDefinition }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = quiz.questions[index];
  useEffect(() => { heading.current?.focus(); }, [index, finished]);
  if (!question) return <NotFound />;
  const selected = answers[question.id];
  return <div className="demo-page">
    <a className="back-link" href={`#/topics/${quiz.id}`}>← 回到主題介紹（離開會清除選擇）</a>
    <div className="demo-top"><span>作答介面預覽</span><span>{quiz.title}</span></div>
    <p className="demo-disclaimer">{quiz.moneyLife ? '生活探索預覽・自編未驗證・答案不保存或分享' : quiz.communication ? '溝通探索預覽・自編未驗證・答案不保存或分享' : quiz.analysis ? '遠距探索預覽・自編未驗證・答案不保存或分享' : '自編示例・尚未驗證・答案不保存或分享'}</p>
    {finished ? <section className="demo-summary">
      <p className="eyebrow">YOUR ANSWERS</p><h1 id="page-heading" ref={heading} tabIndex={-1}>先看見自己的選擇。</h1><p className="summary-intro">這裡只有你剛才選的答案。正式版會在雙方完成後，再呈現兩人的比較與討論提示。</p>
      <ol className="answer-list">{quiz.questions.map((item) => <li key={item.id}><span className="answer-dimension">{item.dimension}</span><h2>{item.prompt}</h2><p>{item.options.find((option) => option.id === answers[item.id])?.label}</p></li>)}</ol>
      <div className="demo-actions"><button className="button secondary" onClick={() => { setIndex(0); setFinished(false); }}>返回修改</button><a className="button primary" href="#/">回到主題館 <Arrow /></a></div>
    </section> : <>
      <div className="progress-meta"><span>問題 {index + 1} / {quiz.questions.length}</span><span>{question.dimension}</span></div>
      <progress value={index + 1} max={quiz.questions.length} aria-label="目前題目進度" />
      <section className="question-panel"><p className="eyebrow">A LITTLE ABOUT YOU</p><h1 id="page-heading" ref={heading} tabIndex={-1}>{question.prompt}</h1><p className="question-help">{question.help}</p>
        {quiz.dailyValues ? <DailyOptions quiz={quiz} question={question} selected={selected} choose={(id)=>setAnswers(editDailyAnswer(quiz,answers,question.id,id))} /> : <fieldset className="options"><legend className="sr-only">{question.prompt}</legend>{question.options.map((option, optionIndex) => <label className={`option ${selected === option.id ? 'selected' : ''}`} key={option.id}>
          <input type="radio" name={question.id} value={option.id} checked={selected === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} /><span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><span>{option.label}</span><span className="option-check" aria-hidden="true">{selected === option.id ? '✓' : ''}</span>
        </label>)}</fieldset>}
        <div className="demo-actions"><button className="button secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一題</button><button className="button primary" disabled={!selected} onClick={() => index + 1 === quiz.questions.length ? setFinished(true) : setIndex(index + 1)}>{index + 1 === quiz.questions.length ? '查看我的選擇' : '下一題'} <span aria-hidden="true">→</span></button></div>
        <details className="question-evidence" key={question.id}><summary>這題的設計依據</summary><p>{question.evidence.note}</p><ul>{quiz.sources.filter((source) => question.evidence.sourceIds.includes(source.id)).map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.authors}（{source.year}）<Arrow /></a></li>)}</ul></details>
      </section>
    </>}
  </div>;
}

function NotFound() {
  return <section className="not-found"><p className="eyebrow">LET'S FIND OUR WAY BACK</p><h1 id="page-heading" tabIndex={-1}>這個主題還不在這裡。</h1><p>連結可能不完整，回主題館找找想聊的事。</p><a className="button primary" href="#/">回到主題館 <Arrow /></a></section>;
}

export default function ExplorationPage({ route }: { route: Route }) {
  useEffect(() => { document.getElementById('page-heading')?.focus({ preventScroll: true }); }, [route]);
  if (route.page === 'catalog' || route.page === 'privacy' || route.page === 'learn' || route.page === 'article') return <NotFound />;
  if (route.page === 'questions') return <QuestionnaireLibrary />;
  if (route.page === 'question-topic') { const item = getQuiz(route.id); return item?.questionnaire ? <QuestionnaireIntro quiz={item} /> : <NotFound />; }
  if (route.page === 'not-found') return <NotFound />;
  if (route.page === 'history') return <HistoryPage />;
  if (route.page === 'invite') return <JoinRound key={route.token} token={route.token} />;
  if (route.page === 'round') return <RoundPage key={`${route.id}:${route.token}`} id={route.id} token={route.token} />;
  if (route.page === 'trial') return route.id === 'core-values' ? <ContentTrial key={coreValuesTrial.version} trial={coreValuesTrial} /> : <NotFound />;
  const quiz = getQuiz(route.id);
  if (!quiz) return <NotFound />;
  if (route.page === 'start') return quiz.questions.length ? <StartRound key={quiz.id} quiz={quiz} /> : <NotFound />;
  if (route.page === 'demo') return quiz.questions.length ? <Demo key={`${quiz.id}@${quiz.version}`} quiz={quiz} /> : <NotFound />;
  return quiz.questionnaire ? <QuestionnaireIntro quiz={quiz} /> : <Topic quiz={quiz} />;
}
