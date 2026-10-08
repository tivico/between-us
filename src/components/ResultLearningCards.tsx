import { getRelationshipArticle } from '../content/relationship-articles';

export function ResultLearningCards({ coreValues = false, noScore = false }: { coreValues?: boolean; noScore?: boolean }) {
  const cards = [
    ...(coreValues ? [{
      articleId: 'values-and-understanding',
      title: noScore ? '沒有總分，也可以了解彼此' : '相近的分數，可能有不同的理由',
      text: noScore ? '這次沒有相近度總分，是本站的計分保護規則，不是關係判定。可以先從逐題答案聊起；「相對重視程度」是和自己的整體回答比較，數字沒有好壞。' : '這份比較看的是各自的相對重視程度。相近不代表理由相同，差異也不是不適合的判決；試著各說一個最近的生活例子，補上分數沒有呈現的背景。',
      label: '結果怎麼讀・本站說明',
    }] : []),
    {
      articleId: 'feeling-understood', title: '分享之後，也問問對方有沒有被理解',
      text: '日記研究發現，分享與感受到的回應都和互動中的親密感有關。聊答案時，可以先問：「你想要我聽你說，還是一起想辦法？」這句話是本站的聊天提案。',
      label: '研究概念＋本站聊天提案',
    },
  ];
  return <section className="result-learning" aria-labelledby="result-learning-heading"><p className="eyebrow">UNDERSTANDING BEYOND THE ANSWERS</p><h2 id="result-learning-heading">多懂一點，再聊下去。</h2><p className="result-learning-intro">從一個概念開始，完整文章隨時能讀，不用重新測驗。</p><div className="result-learning-grid">{cards.map((card) => {
    const article = getRelationshipArticle(card.articleId)!;
    const source = article.sources[0];
    return <article key={card.articleId}><p className="reading-section-label">{card.label}</p><h3>{card.title}</h3><p>{card.text}</p><a className="result-learning-source" href={source.url} target="_blank" rel="noreferrer">相關研究：{source.authors}（{source.year}）↗</a><a className="result-learning-link" href={`#/learn/${article.id}`}>讀完整文章 <span aria-hidden="true">↗</span></a></article>;
  })}</div><a className="back-link" href="#/learn">更多文章：了解關係 →</a></section>;
}
