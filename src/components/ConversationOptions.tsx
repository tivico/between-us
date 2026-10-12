import type { Question } from '../domain/quiz';

export function ConversationOptions({ question, selected, choose }: { question: Question; selected?: string; choose: (id: string) => void }) {
  const choices = question.options.filter((option) => option.kind === 'choice');
  const states = question.options.filter((option) => option.kind !== 'choice' && option.kind !== 'not-shared');
  const current = states.find((option) => option.id === selected);
  const skipped = question.options.find((option) => option.kind === 'not-shared')!;
  return <div className="qa-response"><fieldset className="options"><legend className="sr-only">{question.prompt}</legend>
    {choices.map((option, index) => <label className={`option ${selected === option.id ? 'selected' : ''}`} key={option.id}><input type="radio" name={question.id} checked={selected === option.id} onChange={() => choose(option.id)} /><span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option.label}</span><span className="option-check" aria-hidden="true">{selected === option.id ? '✓' : ''}</span></label>)}
    <details className="qa-other-options" open={current ? true : undefined}><summary>{current ? `目前選擇：${current.label}` : '其他想法／尚未想清楚／不適用'}</summary><div className="options">{states.map((option) => <label className={`option ${selected === option.id ? 'selected' : ''}`} key={option.id}><input type="radio" name={question.id} checked={selected === option.id} onChange={() => choose(option.id)} /><span>{option.label}</span><span className="option-check" aria-hidden="true">{selected === option.id ? '✓' : ''}</span></label>)}</div></details>
  </fieldset><button type="button" className="text-button qa-withhold" aria-pressed={selected === skipped.id} onClick={() => choose(skipped.id)}>這題暫不分享</button>
    <p className="qa-withhold-note" role="status">{selected === skipped.id ? '已選擇暫不分享。這會取代原選項，對方只會看見「未分享」。' : '可以不分享這題，這會取代原選項；雙方完成後只顯示「未分享」。'}</p>
  </div>;
}
