import { useEffect, useState } from 'react';
import type { QuizDefinition } from '../domain/quiz';
import type { RoundResults } from '../domain/round';
import type { ValueComparison } from '../domain/compatibility';
import type { ValueFeedback, ValueInsight } from '../domain/value-feedback';
import './ValueFeedbackReport.css';

type People = RoundResults['participants'];
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

function InsightEvidence({ item, quiz, comparison, people }: { item: ValueInsight; quiz: QuizDefinition; comparison: ValueComparison; people: People }) {
  const source = quiz.sources.find((entry) => entry.id === item.sourceId);
  return <details className="insight-evidence"><summary>為什麼選這個方向？查看三題作答依據</summary><p>這個方向對應以下三題。相對分數是三題平均減去本人全部 57 題平均，不是人格或行為判定。</p>
    <div className="insight-numbers">{people.map((person, index) => { const profile = comparison.profiles[index]; const value = profile.values.find((entry) => entry.id === item.id)!; return <p key={person.slot}><strong>{person.nickname}</strong>：三題平均 {value.mean.toFixed(2)} − 整體平均 {profile.mrat.toFixed(2)} ＝ {signed(value.centered)}</p>; })}<p>雙方相對分數差距：{item.gap.toFixed(2)}。差距沒有已驗證的高低門檻。</p></div>
    <ol>{item.questionIds.map((id) => { const question = quiz.questions.find((entry) => entry.id === id)!; return <li key={id}><span>第 {quiz.questions.indexOf(question) + 1} 題</span><p>{question.prompt}</p><div>{people.map((person) => <p key={person.slot}><strong>{person.nickname}</strong>：{question.options.find((option) => option.id === person.answers[id])?.label}</p>)}</div></li>; })}</ol>
    {source && <a href={source.url} target="_blank" rel="noreferrer">價值概念來源：{source.authors}（{source.year}）↗</a>}<p>價值定義參照原研究；情境、聊天問題與選題規則由本站設計，效果尚未驗證。</p>
  </details>;
}

function InsightCard({ item, kind, quiz, comparison, people, onExplore }: { item: ValueInsight; kind: 'common' | 'difference'; quiz: QuizDefinition; comparison: ValueComparison; people: People; onExplore: () => void }) {
  const higher = people.find((person) => person.slot === item.higher)?.nickname;
  return <article className={`insight-card insight-${kind}`}><p className="insight-label">{item.label}</p><h3>{kind === 'common' ? `你們都把「${item.label}」相對放在前面` : item.title}</h3><p className="insight-meaning">這個價值方向關注：{item.meaning}</p>
    <div className="insight-fact"><span>作答事實</span><p>{kind === 'common' ? '兩人的這個方向，都高於各自全部回答的平均。' : `相對於各自的整體回答，${higher}在「${item.label}」的分數較高。`}</p></div>
    {kind === 'difference' && <div className="insight-scenario"><span>試著想像・本站情境</span><p>{item.scenario}</p><p>這是邀請你們確認的情境，並不表示它已經發生。</p></div>}
    <div className="insight-question"><span>一起問問</span><p>{item.question}</p></div><button className="button secondary" onClick={onExplore}>先聊這個方向 →</button><InsightEvidence item={item} quiz={quiz} comparison={comparison} people={people} />
  </article>;
}

function GuidedConversation({ item, onReset }: { item?: ValueInsight; onReset: () => void }) {
  const [step, setStep] = useState(0);
  const labels = ['先看發現', '帶進情境', '輪流說說', '重新認識'];
  const heading = item?.title ?? '從一個你想說清楚的答案開始';
  const content = item ? [
    `這一輪，我們選到「${item.label}」這個方向。先各自回想一個最近的例子，確認文字是否符合自己的意思。`,
    item.scenario,
    item.question,
    '各自接完這句話：「我原本以為你在意的是＿＿，現在了解到你在意的是＿＿。」再請對方確認，而不是替對方下結論。',
  ] : [
    '從逐題答案裡，選一題你們都願意聊的。先讓每個人說說，當時想到的是哪個情境。',
    '想一件最近做過的選擇。有哪些不同做法？你保留了什麼，又放下了什麼？',
    '你選這個答案的理由，有哪些是對方以前不知道的？可以輪流說，也可以先保留。',
    '各自接完這句話：「我原本以為＿＿，現在了解到＿＿。」問問對方，這樣的理解有沒有需要修正。',
  ];
  return <section className="guided-conversation" aria-labelledby="guided-heading"><p className="eyebrow">ONE CONVERSATION, A LITTLE CLOSER</p><h2 id="guided-heading" tabIndex={-1}>我們可以怎麼聊？</h2><p className="guided-description">不用一次聊完。選一個雙方都願意的方向，輪流說，也輪流確認。</p><div className="guided-steps" role="group" aria-label="聊天步驟">{labels.map((label, index) => <button key={label} aria-pressed={step === index} onClick={() => setStep(index)}><span>0{index + 1}</span>{label}</button>)}</div><div className="guided-content" aria-live="polite"><p className="insight-label">{labels[step]}</p><h3>{heading}</h3><p>{content[step]}</p>{step === 2 && item && <p className="guided-follow-up">還可以問：{item.followUp}</p>}{step === 3 && <p className="guided-follow-up">有新發現，也可以直接告訴對方：「這是我今天才知道的事。」不符合你們的情境就改寫或跳過。</p>}</div><div className="guided-actions"><button className="text-button" disabled={step === 0} onClick={() => setStep(step - 1)}>← 上一步</button>{step < 3 ? <button className="button primary" onClick={() => setStep(step + 1)}>接著聊 →</button> : <button className="button secondary" onClick={() => { setStep(0); onReset(); }}>回去選另一個方向 ↑</button>}</div><p className="guided-note">這裡提供口頭交流的引導，不會記錄、評分或自動分享聊天內容。</p></section>;
}

export function ValueFeedbackReport({ report, quiz, comparison, people }: { report: ValueFeedback; quiz: QuizDefinition; comparison: ValueComparison; people: People }) {
  const [chosen, setChosen] = useState<ValueInsight>();
  const [conversationRun, setConversationRun] = useState(0);
  const names = people.map((person) => person.nickname);
  useEffect(() => {
    if (!chosen) return;
    const heading = document.getElementById('guided-heading');
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  }, [chosen, conversationRun]);
  function explore(item: ValueInsight) {
    setChosen(item);
    setConversationRun((value) => value + 1);
  }
  return <section className="value-feedback" aria-labelledby="value-feedback-heading">
    <div className="feedback-intro"><p className="eyebrow">WHAT WE LEARNED ABOUT EACH OTHER</p><h2 id="value-feedback-heading">從這輪回答，<br />看見彼此在意的事。</h2>
      {report.reason ? <p>這輪至少一人的 19 類相對分數沒有分化，所以不排列共同優先方向或差異。這不代表你們不合；先從一個想澄清的答案聊起，仍然可以發現彼此的理由。</p> : <><p>{report.common.length ? `你們都相對把「${report.common[0].label}」放在前面。` : '這輪可解讀的方向裡，沒有同時高於兩人各自平均的共同方向。這不代表你們沒有共同點。'}{report.differences.length ? `「${report.differences[0].label}」則是相對差距較大的方向，可以先從它的生活意義聊起。` : '這輪可解讀方向的相對分數一致；仍值得問問，相同選擇背後的理由是否也相同。'}</p><div className="feedback-people">{(['A', 'B'] as const).map((slot, index) => <div key={slot}><span>{names[index]}相對放在前面的方向</span><p>{report.priorities[slot].length ? report.priorities[slot].join('、') : '目前可解讀方向中沒有高於本人平均的項目。'}</p></div>)}</div></>}
      <p className="feedback-boundary">這是本輪回答的閱讀與聊天提案。它描述相對重視程度，不判定人格、相處模式或是否適合交往。</p>
    </div>
    {!report.reason && <><section className="feedback-group" aria-labelledby="feedback-common"><p className="eyebrow">A SHARED STARTING POINT</p><h2 id="feedback-common">共同放在前面的方向</h2><p className="feedback-group-note">兩人都高於各自整體平均的方向，最多選三個；相對優先不等於程度完全一樣。</p>{report.common.length ? <div className="feedback-grid">{report.common.map((item) => <InsightCard key={item.id} item={item} kind="common" quiz={quiz} comparison={comparison} people={people} onExplore={() => explore(item)} />)}</div> : <p className="feedback-empty">這輪沒有符合這個條件的方向，不硬湊三個共同點。可以從逐題答案找相同理由或共同經驗。</p>}{report.commonTied && <p className="feedback-tie">邊界有同分項目，依原價值排列呈現其中三個；不是唯一重要的三個方向。</p>}</section>
    <section className="feedback-group" aria-labelledby="feedback-differences"><p className="eyebrow">A LITTLE MORE CURIOSITY</p><h2 id="feedback-differences">值得多了解的差異</h2><p className="feedback-group-note">按本輪相對分數差距選最多三個方向；差距大小不是衝突風險或顯著性判定。共同方向也可能有程度差異。</p>{report.differences.length ? <div className="feedback-grid">{report.differences.map((item) => <InsightCard key={item.id} item={item} kind="difference" quiz={quiz} comparison={comparison} people={people} onExplore={() => explore(item)} />)}</div> : <p className="feedback-empty">這輪可解讀方向沒有相對分數差距。你們仍可以從共同方向或逐題選擇，聊聊不同經驗。</p>}{report.differencesTied && <p className="feedback-tie">邊界有同分差距，依原價值排列選出其中三個；其他方向仍可在數據裡查看。</p>}</section></>}
    <GuidedConversation key={`${chosen?.id ?? 'open'}:${conversationRun}`} item={chosen ?? report.differences[0] ?? report.common[0]} onReset={() => { setChosen(undefined); document.getElementById('feedback-differences')?.scrollIntoView({ block: 'start' }); }} />
    <details className="feedback-method"><summary>這份回饋如何選題？依據與限制</summary><p>共同方向要求兩人相對分數都大於 0，按兩人較小的相對分數排序；差異按相對分數絕對差排序。各自優先方向按本人的相對分數排序。最多各取三個，不設常模或戀愛門檻，同分依原價值次序。</p><p>0 是本人的整體平均；計算使用 1e-9 容許浮點誤差，並非測量門檻。第 49 題譯法仍待核對，因此「公眾形象與避免羞辱」保留原計分與答案，暫不生成生活解讀。整體平均仍含此題，故也可能影響其他方向的相對分數。</p><p>回饋版本 {report.version}。{report.origin === 'legacy-reading-layer' ? '這是加入既有 0.3.0 回合的新版閱讀層；原題目、答案與計分未改。' : '選題內容與版本固定在本輪快照。'}生活情境與聊天提案由本站編寫，尚未驗證效果；沒有使用外部 AI 生成或傳送答案。</p></details>
  </section>;
}
