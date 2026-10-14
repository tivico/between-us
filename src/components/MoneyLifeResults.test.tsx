import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { moneyLifeQuiz } from '../content/money-life';
import { analyzeMoneyLife } from '../domain/money-life';
import { MoneyLifeResults } from './MoneyLifeResults';
const blank = () => Object.fromEntries(moneyLifeQuiz.questions.map((q) => [q.id, 'not-shared']));
function render(a = blank(), b = blank()) {
  return renderToStaticMarkup(<MoneyLifeResults results={{ quiz: moneyLifeQuiz, createdAt: '', moneyLifeAnalysis: analyzeMoneyLife(moneyLifeQuiz, a, b), participants: [
    { slot: 'A', nickname: '工程A', answers: a, submittedAt: 'test' }, { slot: 'B', nickname: '工程B', answers: b, submittedAt: 'test' },
  ] }} />);
}
describe('生活結果的可理解摘要', () => {
  it('沒有主要答案時不宣稱共同起點或生成個別提案', () => {
    const html = render();
    expect(html).toContain('沒有足夠的主要選項形成共同或不同的起點');
    expect(html).not.toContain('雙方在這題都選');
    expect(html).not.toContain('的可選提案 · 本站設計');
    expect(html).not.toContain('advice:null'); expect(html).not.toContain('crossPairs');
  });
  it('相同分攤摘要仍提醒本人條件，拒絕與未分享忠實保留', () => {
    const html = render({ ...blank(), 'money-split-principle': 'equal-amount', 'money-over-capacity': 'not-participating' }, { ...blank(), 'money-split-principle': 'equal-amount' });
    expect(html).toContain('雙方在這題都選「各自支付相同金額」');
    expect(html).toContain('核對下面的本人條件與願意範圍');
    expect(html).toContain('這次先不參加，也先不安排替代活動');
    expect(html).toContain('未分享');
  });
  it('差異摘要只引用本輪選項，不推定衝突或要求折衷', () => {
    const html = render({ ...blank(), 'money-life-priority': 'basic-routine' }, { ...blank(), 'money-life-priority': 'flexibility' });
    expect(html).toContain('工程A'); expect(html).toContain('日常基本支出與休息'); expect(html).toContain('行程與預算的彈性');
    expect(html).toContain('目前不據此判定衝突或要求折衷');
  });
});
