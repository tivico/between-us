import { lazy, Suspense, useEffect, useState } from 'react';
import { catalog as quizzes, roundSummaries, articleSummaries } from './content/catalog';
import { Motif } from './components/Motif';
import { PageBoundary } from './components/PageBoundary';
import type { TopicStatus } from './domain/quiz';
import { parseRoute, type Route } from './lib/routes';
import { invitationNote, storageNote } from './lib/deployment';
import { DataPrivacy, retentionNote } from './components/DataPrivacy';
import { topicGuide } from './content/topic-guide';
const ExplorationPage = lazy(() => import('./components/ExplorationPage'));
const LearningPage = lazy(() => import('./components/LearningPage'));

const statusLabels: Record<TopicStatus, string> = { draft: '可預覽', planned: '籌備中', ready: '已開放' };

function Arrow() { return <span aria-hidden="true">↗</span>; }

function Catalog() {
  const [filter, setFilter] = useState<'all' | 'ready' | 'planned'>('all');
  const visible = quizzes.filter((quiz) => filter === 'all' || quiz.status === filter);
  return <>
    <section className="hero" aria-labelledby="page-heading">
      <div className="hero-copy">
        <p className="eyebrow"><span className="tiny-line" /> TWO PEOPLE, A LITTLE CLOSER</p>
        <h1 id="page-heading" tabIndex={-1}>有些話，<br />從一個<span className="emphasis">問題</span>開始。</h1>
        <p className="hero-description">從生活裡的小選擇，到心裡重要的事。<br />各自回答，再一起發現彼此的不同與相同。</p>
        <button className="button primary" onClick={() => document.getElementById('start-guide')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>找一個想聊的主題 <span aria-hidden="true">↓</span></button>
        <p className="hero-footnote">兩個人，一人一份答案，一段新的對話。</p>
      </div>
      <div className="hero-art theme-sage">
        <span className="art-note note-top">你的世界</span>
        <Motif kind="arches" hero />
        <span className="art-note note-bottom">與我的世界，慢慢交會。</span>
        <span className="art-coordinate" aria-hidden="true">01 / BETWEEN US</span>
      </div>
    </section>

    <section id="start-guide" className="start-guide" aria-labelledby="start-guide-heading"><p className="eyebrow">FIND YOUR STARTING POINT</p><h2 id="start-guide-heading">第一次來，從今天想聊的事開始。</h2><p>不用一次完成全部。先選一件想了解的事，看看題數與完成後的收穫。</p><div className="guide-grid">{topicGuide.map((item) => <a className="guide-card" href={item.href} key={item.href}><h3>{item.title}</h3><p>{item.note}</p><span>{item.action} →</span></a>)}</div><p className="local-note">雙人回合會自動保存，可以稍後續答；單人探索／介面預覽不保存。完成時間尚未實測，請依自己的步調回答。</p></section>

    <section id="collection" className="collection" aria-labelledby="collection-heading">
      <div className="section-top">
        <div><p className="eyebrow">THE COLLECTION</p><h2 id="collection-heading">今天，想更了解哪一面？</h2></div>
        <p className="section-aside">不用一次了解全部，<br />選一個主題，慢慢開始。</p>
      </div>
      <div className="collection-toolbar">
        <div className="filters" role="group" aria-label="篩選測驗主題">
          {([{ value: 'all', label: '所有主題' }, { value: 'ready', label: '已開放' }, { value: 'planned', label: '籌備中' }] as const).map((item) => <button key={item.value} className={filter === item.value ? 'filter active' : 'filter'} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
        <span className="topic-count" aria-live="polite">{visible.length} 個主題</span>
      </div>
      <div className="topic-grid">
        {visible.map((quiz) => <a className={`topic-card theme-${quiz.theme}`} href={`#/topics/${quiz.id}`} key={quiz.id}>
          <div className="card-art"><span className={`status-pill status-${quiz.status}`}>{statusLabels[quiz.status]}</span><Motif kind={quiz.motif} /></div>
          <div className="card-body"><p className="card-audience">{quiz.audience}</p><h3>{quiz.title}</h3><p className="card-subtitle">{quiz.subtitle}</p><div className="card-footer"><span>{quiz.dailyValues ? '8情境・32步・雙人日常探索' : quiz.id === 'core-values' ? '57 題・雙人核心價值探索' : quiz.moneyLife ? '12 題・雙人生活探索' : quiz.communication ? '24 題・雙人溝通探索' : quiz.analysis ? '24 題・雙人遠距探索' : quiz.questionCount > 0 ? `${quiz.questionCount} 題介面示例` : '查看主題方向'}</span><span className="circle-arrow"><Arrow /></span></div></div>
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
        <details><summary>題目有什麼依據？<span aria-hidden="true">＋</span></summary><p>每個主題都會列出研究來源與驗證狀態。核心價值有依 PVQ-RR 改寫的 57 題，遠距有依研究方向自編的 24 題；兩者都使用不限定性別的稱呼。遠距共同點、差異與討論建議依本輪實際答案產生，題庫與建議效果尚未驗證。日常三觀另提供八個生活情境，每個四步，依做法、理由與接受範圍整理，不提供契合分數。溝通與生活探索也已開放，提供做法／期待、本人範圍與條件的整理；空間界線仍在籌備。</p></details>
        <details><summary>可以看到對方選了什麼嗎？<span aria-hidden="true">＋</span></summary><p>雙人回合會先取得分享同意，各自填答，完成後才解鎖彼此選項。單人探索只有你自己的選擇。{invitationNote}</p></details>
        <details><summary>現在填的答案會保存嗎？<span aria-hidden="true">＋</span></summary><p>{storageNote}，私人返回連結可找回。單人探索不保存。{retentionNote}可以在回合頁刪除本人答案並退出，或更換私人返回連結；<a href="#/privacy">查看資料說明</a>。</p></details>
      </div>
    </section>
  </>;
}

function Page({ route }: { route: Route }) {
  if (route.page === 'catalog') return <Catalog />;
  if (route.page === 'privacy') return <DataPrivacy />;
  return <PageBoundary key={route.page + ('id' in route ? route.id : '')}><Suspense fallback={<div className="flow-page" role="status">正在開啟頁面…</div>}>{route.page === 'learn' || route.page === 'article' ? <LearningPage route={route} /> : <ExplorationPage route={route} />}</Suspense></PageBoundary>;
}

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    const quiz = 'id' in route ? roundSummaries.find((q) => q.id === route.id) : undefined;
    const article = route.page === 'article' ? articleSummaries.find((a) => a.id === route.id) : undefined;
    document.title = route.page === 'privacy' ? '資料保存與退出｜之間 Between Us' : route.page === 'questions' ? '雙人問答｜之間 Between Us' : route.page === 'learn' ? '了解關係｜之間 Between Us' : article ? `${article.title}｜之間 Between Us` : route.page === 'trial' ? '核心價值探索｜之間 Between Us' : quiz ? `${quiz.title}｜之間 Between Us` : '之間 Between Us｜慢慢認識彼此';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.getElementById('page-heading')?.focus({ preventScroll: true });
  }, [route]);
  return <>
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>跳到主要內容</a>
    <div className="preview-banner">慢慢認識彼此 <span aria-hidden="true">·</span> 留一點時間，給重要的人</div>
    <header className="site-header"><a className="brand" href="#/" aria-label="之間 Between Us，回到首頁"><span className="brand-symbol" aria-hidden="true">∩</span><span>之間<span className="brand-english">BETWEEN US</span></span></a><nav aria-label="主要導覽"><a href="#/" aria-current={route.page === 'catalog' ? 'page' : undefined}>主題測驗</a><a href="#/questions" aria-current={route.page === 'questions' || route.page === 'question-topic' ? 'page' : undefined}>雙人問答</a><a href="#/learn" aria-current={route.page === 'learn' || route.page === 'article' ? 'page' : undefined}>了解關係</a><a href="#/history" aria-current={route.page === 'history' ? 'page' : undefined}>最近紀錄</a><span className="nav-note">慢慢認識，好好相處。</span></nav></header>
    <main id="main-content" tabIndex={-1}><Page route={route} /></main>
    <footer className="site-footer"><a className="footer-brand" href="#/">之間 <span>BETWEEN US</span></a><p>留一點好奇，給最靠近的人。</p><a className="footer-note" href="#/privacy">資料保存與退出</a></footer>
  </>;
}
