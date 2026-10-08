import type { ValueComparison } from '../domain/compatibility';
import { ResultLearningCards } from './ResultLearningCards';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
export function ValueResults({ comparison, names }: { comparison: ValueComparison; names: [string, string] }) {
  const close = [...comparison.values].sort((a, b) => a.gap - b.gap).slice(0, 3);
  const different = [...comparison.values].sort((a, b) => b.gap - a.gap).slice(0, 3);
  return <section className="value-results" aria-labelledby="value-heading">
    <div className="value-overview theme-sage"><p className="eyebrow">YOUR VALUES, SIDE BY SIDE</p><h2 id="value-heading">核心價值相近度</h2>
      {comparison.score === null ? <><strong className="value-no-score">先聊聊你的選擇</strong><p>至少一人的 19 類結果沒有呈現相對差異，這次不計相近度。這不代表作答錯誤，也不代表你們不合。</p></> : <><p className="value-score"><strong>{comparison.score.toFixed(1)}</strong><span> / 100</span></p><p>比較這一輪，你們對不同價值的相對重視程度。<br />相近不代表理由相同，差異也不代表不適合。</p></>}
      <p className="value-limits">探索性指標・不是關係成功率或經驗證的伴侶契合量表</p>
    </div>
    {comparison.score !== null && <div className="value-highlights"><div><p className="eyebrow">比較接近的方向</p><h3>{close.map((value) => value.label).join('、')}</h3><p>這幾類的相對重視程度差距較小，不一定是你們最重視的事。</p></div><div><p className="eyebrow">值得多聊的方向</p><h3>{different.map((value) => value.label).join('、')}</h3><p>可以各自說說：這件事在生活裡，會如何影響你的選擇？</p></div></div>}
    <ResultLearningCards coreValues noScore={comparison.score === null} />
    <div className="value-chart-heading"><h2>19 個方向，放在一起看。</h2><p>0 是各自的整體平均；正值表示相對更重視，負值表示相對較少重視。數字沒有好壞，也不是百分比。</p><div className="value-legend"><span className="legend-a">{names[0]}</span><span className="legend-b">{names[1]}</span></div></div>
    <ul className="value-chart">{comparison.values.map((value) => <li key={value.id}><div className="value-row-heading"><h3>{value.label}</h3><span>差距 {value.gap.toFixed(2)}</span></div>{[value.a, value.b].map((rating, index) => <div className={`value-person value-person-${index}`} key={index}><span className="value-name">{names[index]}</span><div className="value-track" aria-hidden="true"><span className="value-zero" /><span className="value-bar" style={{ left: `${50 + Math.min(0, rating) * 10}%`, width: `${Math.abs(rating) * 10}%` }} /></div><span className="value-number">{signed(rating)}</span></div>)}</li>)}</ul>
    <details className="value-method"><summary>分數怎麼算？研究依據與限制</summary><p>先依 PVQ-RR 原計分，將每類三題取平均，再減去本人全部 57 題的平均，得到 19 類相對重視程度。這能區分「每題都傾向選高」與各自的價值優先順序。</p><p>本站將雙方 19 類相對分數的絕對差取平均，19 類等權重；相近度＝100 ×（1 − 平均差距 ÷ 5）。5 是六段量尺下平均差距的保守上界，並非常模或感情研究門檻。平均差距為 {comparison.meanGap.toFixed(3)}，規則版本 {comparison.ruleVersion}。</p><p>這個換算由本站設計，沒有高低契合門檻；相同相對分數可能來自不同原始選項。任一人的 19 類相對分數全部相同時不顯示總分；缺答不補值，雙方完整提交才計算。</p><p>原 PVQ-RR 有研究證據；本繁體中性改寫與雙人公式尚未驗證。第 49 題的原繁體譯法仍有待核對，可能影響形象與避免羞辱這一類；請結合逐題答案討論。此結果只涵蓋核心價值，沒有包含人生方向。</p><a href="https://doi.org/10.1177/1073191121998760" target="_blank" rel="noreferrer">PVQ-RR 原研究 ↗</a></details>
  </section>;
}
