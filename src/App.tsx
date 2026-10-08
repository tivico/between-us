import { useEffect, useRef, useState } from 'react';
import { quizzes, getQuiz } from './content/quizzes';
import { Motif } from './components/Motif';
import { HistoryPage, JoinRound, RoundPage, StartRound } from './components/RoundFlow';
import { ContentTrial } from './components/ContentTrial';
import { coreValuesTrial } from './content/core-values-trial';
import type { QuizDefinition, TopicStatus } from './domain/quiz';
import { parseRoute, type Route } from './lib/routes';
import { invitationNote, storageNote } from './lib/deployment';

const statusLabels: Record<TopicStatus, string> = { draft: '可預覽', planned: '籌備中', ready: '已開放' };

function Arrow() { return <span aria-hidden="true">↗</span>; }

function Catalog() {
  const [filter, setFilter] = useState<'all' | 'preview' | 'planned'>('all');
  const visible = quizzes.filter((quiz) => filter === 'all' || (filter === 'preview' ? quiz.questions.length > 0 : quiz.status === 'planned'));
  return <>
    <section className="hero" aria-labelledby="page-heading">
      <div className="hero-copy">
        <p className="eyebrow"><span className="tiny-line" /> TWO PEOPLE, A LITTLE CLOSER</p>
        <h1 id="page-heading" tabIndex={-1}>有些話，<br />從一個<span className="emphasis">問題</span>開始。</h1>
        <p className="hero-description">從生活裡的小選擇，到心裡重要的事。<br />各自回答，再一起發現彼此的不同與相同。</p>
        <button className="button primary" onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}>找一個想聊的主題 <span aria-hidden="true">↓</span></button>
        <p className="hero-footnote">兩個人，一人一份答案，一段新的對話。</p>
      </div>
      <div className="hero-art theme-sage">
        <span className="art-note note-top">你的世界</span>
        <Motif kind="arches" hero />
        <span className="art-note note-bottom">與我的世界，慢慢交會。</span>
        <span className="art-coordinate" aria-hidden="true">01 / BETWEEN US</span>
      </div>
    </section>

    <section id="collection" className="collection" aria-labelledby="collection-heading">
      <div className="section-top">
        <div><p className="eyebrow">THE COLLECTION</p><h2 id="collection-heading">今天，想更了解哪一面？</h2></div>
        <p className="section-aside">不用一次了解全部，<br />選一個主題，慢慢開始。</p>
      </div>
      <div className="collection-toolbar">
        <div className="filters" role="group" aria-label="篩選測驗主題">
          {([{ value: 'all', label: '所有主題' }, { value: 'preview', label: '可預覽' }, { value: 'planned', label: '籌備中' }] as const).map((item) => <button key={item.value} className={filter === item.value ? 'filter active' : 'filter'} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
        <span className="topic-count" aria-live="polite">{visible.length} 個主題</span>
      </div>
      <div className="topic-grid">
        {visible.map((quiz) => <a className={`topic-card theme-${quiz.theme}`} href={`#/topics/${quiz.id}`} key={quiz.id}>
          <div className="card-art"><span className={`status-pill status-${quiz.status}`}>{statusLabels[quiz.status]}</span><Motif kind={quiz.motif} /></div>
          <div className="card-body"><p className="card-audience">{quiz.audience}</p><h3>{quiz.title}</h3><p className="card-subtitle">{quiz.subtitle}</p><div className="card-footer"><span>{quiz.id === 'core-values' ? '57 題・雙人核心價值探索' : quiz.questions.length > 0 ? `${quiz.questions.length} 題介面示例` : '查看主題方向'}</span><span className="circle-arrow"><Arrow /></span></div></div>
        </a>)}
      </div>
    </section>

    <section className="how-section" id="how" aria-labelledby="how-heading">
      <div className="how-title"><p className="eyebrow">A MOMENT FOR TWO</p><h2 id="how-heading">留一點時間，<br />給彼此。</h2><p>各自留一點時間，<br />再一起看見彼此的選擇。</p></div>
      <ol className="how-steps">
        <li><span className="step-number">01</span><h3>先聽見自己</h3><p>選一個主題，各自回答。<br />不用猜對方想聽什麼。</p></li>
        <li><span className="step-number">02</span><h3>邀請另一個人</h3><p>分享連結，讓對方<br />在自己的時間裡慢慢填答。</p></li>
        <li><span className="step-number">03</span><h3>一起看見彼此</h3><p>雙方完成後，查看彼此答案，<br />從一個值得聊的問題開始。</p></li>
      </ol>
    </section>

    <section className="approach" aria-labelledby="approach-heading">
      <div><p className="eyebrow">OUR APPROACH</p><h2 id="approach-heading">理解，比一個分數更重要。</h2><p>差異是認識彼此的起點。<br />我們希望把答案變成對話，讓重要的想法有機會被聽見。</p></div>
      <div className="faq">
        <details><summary>題目有什麼依據？<span aria-hidden="true">＋</span></summary><p>每個主題都會列出研究來源與驗證狀態。核心價值提供依 PVQ-RR 改寫的 57 題性別中性人物描述，本改寫尚未完成測量驗證；雙人探索使用完整 57 題；原三題示例另外保留。其他主題仍在籌備。</p></details>
        <details><summary>可以看到對方選了什麼嗎？<span aria-hidden="true">＋</span></summary><p>雙人回合會先取得分享同意，各自填答，完成後才解鎖彼此選項。單人探索只有你自己的選擇。{invitationNote}</p></details>
        <details><summary>現在填的答案會保存嗎？<span aria-hidden="true">＋</span></summary><p>{storageNote}，私人返回連結可找回。單人探索不保存。保存期限與刪除規則尚未定案，請保留私人返回連結。</p></details>
      </div>
    </section>
  </>;
}

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

        {quiz.questions.length > 0 ? <div className="topic-actions"><a className="button primary" href={`#/start/${quiz.id}`}>{quiz.scoring ? '開始 57 題雙人探索' : '開始雙人體驗'} <Arrow /></a><a className="back-link" href={quiz.scoring ? "#/trial/core-values" : `#/demo/${quiz.id}`}>{quiz.scoring ? '先自己探索（不保存）' : '先看單人介面預覽'}</a></div> : <p className="coming-soon">這個主題正在準備，尚未開放作答。</p>}
      </div><div className="intro-art"><Motif kind={quiz.motif} /></div>
    </section>
    <div className="detail-columns"><section><p className="eyebrow">WHAT WE WILL EXPLORE</p><h2>{quiz.scoring ? '19 個價值方向' : '我們會聊到'}</h2><ul className="dimension-list">{quiz.dimensions.map((dimension, index) => <li key={dimension}><span>{String(index + 1).padStart(2, '0')}</span>{dimension}</li>)}</ul></section>
      <aside className="preview-notice"><h2>{quiz.questions.length ? '給自己，也給彼此' : '為重要的話題，好好準備'}</h2><p>{quiz.id === 'core-values' ? '57 題雙人探索會自動保存；你完成後邀請對方，兩人完整提交才解鎖彼此選項、19 類價值比較與核心價值相近度。相近度是探索性指標，不是關係成功率。' : quiz.questions.length ? '三題自編示例尚未驗證，不提供正式分數。雙人測試會保存答案，完成後彼此可看；單人介面預覽則不保存或分享。' : '題目與結果規則仍在設計。研究與內容確認後，才會開放完整的雙人體驗。'}</p></aside>
    </div>
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
    <p className="demo-disclaimer">自編示例・尚未驗證・答案不保存或分享</p>
    {finished ? <section className="demo-summary">
      <p className="eyebrow">YOUR ANSWERS</p><h1 id="page-heading" ref={heading} tabIndex={-1}>先看見自己的選擇。</h1><p className="summary-intro">這裡只有你剛才選的答案。正式版會在雙方完成後，再呈現兩人的比較與討論提示。</p>
      <ol className="answer-list">{quiz.questions.map((item) => <li key={item.id}><span className="answer-dimension">{item.dimension}</span><h2>{item.prompt}</h2><p>{item.options.find((option) => option.id === answers[item.id])?.label}</p></li>)}</ol>
      <div className="demo-actions"><button className="button secondary" onClick={() => { setIndex(0); setFinished(false); }}>返回修改</button><a className="button primary" href="#/">回到主題館 <Arrow /></a></div>
    </section> : <>
      <div className="progress-meta"><span>問題 {index + 1} / {quiz.questions.length}</span><span>{question.dimension}</span></div>
      <progress value={index + 1} max={quiz.questions.length} aria-label="目前題目進度" />
      <section className="question-panel"><p className="eyebrow">A LITTLE ABOUT YOU</p><h1 id="page-heading" ref={heading} tabIndex={-1}>{question.prompt}</h1><p className="question-help">{question.help}</p>
        <fieldset className="options"><legend className="sr-only">{question.prompt}</legend>{question.options.map((option, optionIndex) => <label className={`option ${selected === option.id ? 'selected' : ''}`} key={option.id}>
          <input type="radio" name={question.id} value={option.id} checked={selected === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} /><span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><span>{option.label}</span><span className="option-check" aria-hidden="true">{selected === option.id ? '✓' : ''}</span>
        </label>)}</fieldset>
        <div className="demo-actions"><button className="button secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>← 上一題</button><button className="button primary" disabled={!selected} onClick={() => index + 1 === quiz.questions.length ? setFinished(true) : setIndex(index + 1)}>{index + 1 === quiz.questions.length ? '查看我的選擇' : '下一題'} <span aria-hidden="true">→</span></button></div>
        <details className="question-evidence" key={question.id}><summary>這題的設計依據</summary><p>{question.evidence.note}</p><ul>{quiz.sources.filter((source) => question.evidence.sourceIds.includes(source.id)).map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.authors}（{source.year}）<Arrow /></a></li>)}</ul></details>
      </section>
    </>}
  </div>;
}

function NotFound() {
  return <section className="not-found"><p className="eyebrow">LET'S FIND OUR WAY BACK</p><h1 id="page-heading" tabIndex={-1}>這個主題還不在這裡。</h1><p>連結可能不完整，回主題館找找想聊的事。</p><a className="button primary" href="#/">回到主題館 <Arrow /></a></section>;
}

function Page({ route }: { route: Route }) {
  if (route.page === 'catalog') return <Catalog />;
  if (route.page === 'not-found') return <NotFound />;
  if (route.page === 'history') return <HistoryPage />;
  if (route.page === 'invite') return <JoinRound key={route.token} token={route.token} />;
  if (route.page === 'round') return <RoundPage key={`${route.id}:${route.token}`} id={route.id} token={route.token} />;
  if (route.page === 'trial') return route.id === 'core-values' ? <ContentTrial key={coreValuesTrial.version} trial={coreValuesTrial} /> : <NotFound />;
  const quiz = getQuiz(route.id);
  if (!quiz) return <NotFound />;
  if (route.page === 'start') return quiz.questions.length ? <StartRound key={quiz.id} quiz={quiz} /> : <NotFound />;
  if (route.page === 'demo') return quiz.questions.length ? <Demo key={`${quiz.id}@${quiz.version}`} quiz={quiz} /> : <NotFound />;
  return <Topic quiz={quiz} />;
}

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    const quiz = 'id' in route ? getQuiz(route.id) : undefined;
    document.title = route.page === 'trial' ? '核心價值探索｜之間 Between Us' : quiz ? `${quiz.title}｜之間 Between Us` : '之間 Between Us｜慢慢認識彼此';
    window.scrollTo(0, 0);
    document.getElementById('page-heading')?.focus();
  }, [route]);
  return <>
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>跳到主要內容</a>
    <div className="preview-banner">慢慢認識彼此 <span aria-hidden="true">·</span> 留一點時間，給重要的人</div>
    <header className="site-header"><a className="brand" href="#/" aria-label="之間 Between Us，回到首頁"><span className="brand-symbol" aria-hidden="true">∩</span><span>之間<span className="brand-english">BETWEEN US</span></span></a><nav aria-label="主要導覽"><a href="#/">測驗主題館</a><a href="#/history">最近紀錄</a><span className="nav-note">慢慢認識，好好相處。</span></nav></header>
    <main id="main-content" tabIndex={-1}><Page route={route} /></main>
    <footer className="site-footer"><a className="footer-brand" href="#/">之間 <span>BETWEEN US</span></a><p>留一點好奇，給最靠近的人。</p><span className="footer-note">理解彼此的對話起點</span></footer>
  </>;
}
