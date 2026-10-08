import { Motif } from './Motif';
import { relationshipArticles, type RelationshipArticle, type ArticleSection } from '../content/relationship-articles';

const sectionLabels: Record<ArticleSection['kind'], string> = {
  context: '從生活開始', research: '研究怎麼說', application: '把理解帶進生活・本站提案', limits: '閱讀的邊界',
};

function ArticleCard({ article, index }: { article: RelationshipArticle; index: number }) {
  return <a className={`reading-card theme-${article.theme}`} href={`#/learn/${article.id}`}>
    <div className="reading-card-art"><span className="reading-number">0{index + 1}</span><Motif kind={article.motif} /></div>
    <div className="reading-card-copy"><p className="reading-meta">{article.category}<span>約 {article.readMinutes} 分鐘</span></p><h2>{article.title}</h2><p>{article.subtitle}</p><span className="reading-card-link">閱讀文章 <span aria-hidden="true">↗</span></span></div>
  </a>;
}

export function RelationshipLibrary() {
  return <div className="reading-library">
    <section className="reading-hero" aria-labelledby="page-heading">
      <div><p className="eyebrow">A LITTLE MORE UNDERSTANDING</p><h1 id="page-heading" tabIndex={-1}>了解關係，<br />也了解彼此。</h1><p className="reading-intro">有些理解，從讀懂一個概念開始。<br />把研究帶回生活，留一點好奇給身邊的人。</p></div>
      <aside className="reading-invitation"><span aria-hidden="true">“</span><p>讀一篇文章，<br />找一句想和你聊的話。</p><small>不需要先做測驗，隨時都能閱讀。</small></aside>
    </section>
    <section aria-labelledby="reading-heading"><div className="section-top"><div><p className="eyebrow">READ, REFLECT, CONNECT</p><h2 id="reading-heading">從你在意的事情開始</h2></div><p className="section-aside">{relationshipArticles.length} 篇文章<br />每篇附研究來源</p></div><div className="reading-grid">{relationshipArticles.map((article, index) => <ArticleCard key={article.id} article={article} index={index} />)}</div></section>
    <section className="reading-editorial" aria-labelledby="reading-editorial-heading"><p className="eyebrow">HOW WE WRITE</p><h2 id="reading-editorial-heading">讓每個說法，都找得到來處。</h2><p>文章以原始研究為依據，說明研究的方法與適用範圍。生活例子與聊天提案另外標示，讓你知道哪些來自研究、哪些是我們邀請你們試著聊的事。</p><p>歡迎各種性向與性別認同的兩人閱讀；研究樣本的限制會保留，不把單一研究當成所有關係的定論。</p></section>
  </div>;
}

function goToSection(id: string) {
  const target = document.getElementById(id);
  target?.scrollIntoView({ block: 'start' });
  target?.focus({ preventScroll: true });
}

export function RelationshipArticlePage({ article }: { article: RelationshipArticle }) {
  const related = relationshipArticles.filter((item) => item.id !== article.id);
  return <div className="reading-page">
    <a className="back-link" href="#/learn">← 回到了解關係</a>
    <article>
      <header className={`reading-article-header theme-${article.theme}`}><div><p className="reading-meta">{article.category}<span>約 {article.readMinutes} 分鐘</span></p><h1 id="page-heading" tabIndex={-1}>{article.title}</h1><p className="reading-subtitle">{article.subtitle}</p><p className="reading-date">之間編輯整理 · 更新於 <time dateTime={article.updated}>{article.updated}</time></p></div><div className="reading-article-art"><Motif kind={article.motif} /></div></header>
      <div className="reading-layout">
        <aside className="reading-toc"><nav aria-label="文章目錄"><p className="eyebrow">IN THIS ARTICLE</p>{article.sections.map((section, index) => <button key={section.id} onClick={() => goToSection(`reading-${section.id}`)}><span>0{index + 1}</span>{section.heading}</button>)}<button onClick={() => goToSection('reading-conversation')}><span>＋</span>留一個問題給彼此</button><button onClick={() => goToSection('reading-sources')}><span>↗</span>研究來源</button></nav></aside>
        <div className="reading-body"><div className="reading-takeaway"><p className="eyebrow">帶走一個想法</p><p>{article.takeaway}</p></div>
          {article.sections.map((section) => <section className={`reading-section reading-${section.kind}`} key={section.id} aria-labelledby={`reading-${section.id}`}><p className="reading-section-label">{sectionLabels[section.kind]}</p><h2 id={`reading-${section.id}`} tabIndex={-1}>{section.heading}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{section.sourceIds && <div className="reading-citations">{section.sourceIds.map((id) => { const source = article.sources.find((item) => item.id === id)!; return <a href={source.url} key={id} target="_blank" rel="noreferrer">研究：{source.authors}（{source.year}）↗</a>; })}</div>}</section>)}
          <section className="reading-conversation" aria-labelledby="reading-conversation"><p className="eyebrow">A CONVERSATION FOR TWO</p><h2 id="reading-conversation" tabIndex={-1}>留一個問題，給彼此。</h2><p>本站設計的聊天提示，選一個想聊的就好。<br />可以跳過、改寫，也可以留到另一個時間。</p><ol>{article.conversation.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol></section>
          <section className="reading-sources" aria-labelledby="reading-sources"><p className="eyebrow">RESEARCH & CONTEXT</p><h2 id="reading-sources" tabIndex={-1}>研究來源與閱讀範圍</h2><p>以下是本文使用的原始研究。出版者頁面可能需要訂閱，另附可查閱的全文入口。</p><ol>{article.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><p className="source-author">{source.authors} · {source.year}</p><p>{source.method}</p><p>{source.scope}</p><a className="reading-fulltext" href={source.readUrl} target="_blank" rel="noreferrer">查閱原文 ↗</a></li>)}</ol></section>
        </div>
      </div>
    </article>
    <section className="reading-related" aria-labelledby="reading-related-heading"><p className="eyebrow">KEEP THE CURIOSITY</p><h2 id="reading-related-heading">還想多了解一點？</h2><div>{related.map((item) => <a href={`#/learn/${item.id}`} key={item.id}><span>{item.category}</span><h3>{item.title}</h3><span aria-hidden="true">↗</span></a>)}</div><a className="back-link" href="#/learn">查看所有文章 →</a></section>
  </div>;
}
