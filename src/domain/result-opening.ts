import type { RoundResults } from './round.ts';
import type { AnalysisEvidence } from './long-distance.ts';

export interface OpeningFinding {
  id: string; title: string; category: '共同方向' | '選項相同' | '這個方向相同' | '值得確認' | '各自條件';
  fact: string; question: string; evidence: AnalysisEvidence[];
}
export interface ResultOpening {
  version: '1.0.0'; origin: 'reading-layer'; discovery: string; discoveryEvidence: AnalysisEvidence[]; findings: OpeningFinding[];
}

// 閱讀層只摘取本輪已生成的分析，不重算相近度、不推導新人格或覆寫 V1。
export function buildResultOpening(result: RoundResults): ResultOpening {
  return buildResultOpeningV1(result);
}

// 後續另加 V2 與明確分流，不覆寫這個已交付的固定閱讀層。
function buildResultOpeningV1(result: RoundResults): ResultOpening {
  const { quiz, participants } = result;
  const [a, b] = participants;
  const names = { A: a.nickname, B: b.nickname };
  const findings: OpeningFinding[] = [];
  let discoveryEvidence: AnalysisEvidence[] = [];
  let discovery = '這輪先保留各自的情境，沒有足夠的主要選項形成共同方向或差異。不需要補充原因。';
  const evidenceFor = (questionIds: string[]): AnalysisEvidence[] => questionIds.flatMap((id) => {
    const q = quiz.questions.find((item) => item.id === id)!;
    return participants.map((person) => ({ slot: person.slot, questionId: id, prompt: q.prompt, role: '本輪回答', label: q.options.find((o) => o.id === person.answers[id])!.label }));
  });
  const add = (item: OpeningFinding) => findings.push(item);
  if (result.valueFeedback) {
    const report = result.valueFeedback;
    if (report.reason) discovery = '這輪至少一人的價值輪廓尚未呈現差異，因此先不排序共同優先或差異；可以在完整整理查看逐題選項。';
    else {
      const priority = (slot: 'A' | 'B') => report.priorities[slot].length ? `${names[slot]}相對優先的是${report.priorities[slot].join('、')}` : `${names[slot]}這輪沒有可列出的相對優先方向`;
      discovery = `${priority('A')}；${priority('B')}。這是相對於本人平均的本輪選答，不是人格判定。${report.common.length ? '' : '這輪沒有雙方都高於本人平均的共同方向。'}${report.differences.length ? '' : '可解讀的方向沒有顯示差異。'}`;
      discoveryEvidence = evidenceFor([...new Set(quiz.scoring!.values.filter((v) => [...report.priorities.A, ...report.priorities.B].includes(v.label)).flatMap((v) => v.questionIds))]);
      for (const [items, category] of [[report.common, '共同方向'], [report.differences, '值得確認']] as const) {
        const item = items[0];
        if (item) add({ id: `value-${category}-${item.id}`, title: item.label, category,
          fact: category === '共同方向' ? `在「${item.label}」，雙方都高於各自的作答平均，是這輪的共同優先方向。` : `在「${item.label}」，雙方相對重視程度不同；值得確認它在各自生活中的意思。`,
          question: `${item.scenario} ${item.question}`, evidence: evidenceFor(item.questionIds) });
      }
    }
  } else if (result.communicationAnalysis) {
    const report = result.communicationAnalysis;
    const usable = report.findings.filter((f) => f.state !== 'context');
    if (usable.length) {
      const f = usable.find((item) => item.state === 'different') ?? usable[0];
      discoveryEvidence = f.evidence;
      discovery = `在「${f.title}」，${names[f.wantedSlot]}希望「${f.evidence[0].label}」；${names[f.providedSlot]}自述「${f.evidence[1].label}」。這是本輪一個可以確認意思的方向，反向期待與做法另行閱讀。`;
    }
    for (const state of ['same', 'different'] as const) {
      const f = usable.find((item) => item.state === state);
      if (f) add({ id: f.id, title: f.title, category: state === 'same' ? '這個方向相同' : '值得確認',
        fact: `${names[f.wantedSlot]}的期待與${names[f.providedSlot]}自述的做法，這個方向選到${state === 'same' ? '同一類' : '不同'}方式。相同不等於已滿足，不同不等於衝突。`, question: f.discussion!, evidence: f.evidence });
    }
  } else if (result.moneyLifeAnalysis) {
    const report = result.moneyLifeAnalysis;
    const usable = report.preferences.filter((f) => f.state === 'same' || f.state === 'different');
    if (usable.length) {
      const f = usable.find((item) => item.questionId === 'money-life-priority') ?? usable[0];
      discoveryEvidence = f.evidence;
      discovery = `${names.A}這輪選「${f.evidence[0].label}」；${names.B}選「${f.evidence[1].label}」。這是生活偏好的一個討論起點；本人願意範圍和現實條件仍各自保留，相同偏好不等於同意付款或參加。`;
    } else {
      const f = report.pairs.find((item) => item.state !== 'context');
      if (f) discoveryEvidence = f.evidence;
      if (f) discovery = `在「${f.title}」，${names[f.wantedSlot]}希望「${f.evidence[0].label}」；${names[f.providedSlot]}自述「${f.evidence[1].label}」。本輪分開看期待與做法，仍需保留本人願意範圍和現實條件。`;
    }
    const condition = [...report.boundaries, ...report.constraints].find((f) => f.evidence.some((e) => quiz.questions.find((q) => q.id === e.questionId)!.options.find((o) => o.id === participants.find((p) => p.slot === e.slot)!.answers[e.questionId])!.kind === 'choice'));
    if (condition) {
      // 只展示主要選項；不對未分享／未確定追問，也不比較本人界線。
      const evidence = condition.evidence.filter((e) => quiz.questions.find((q) => q.id === e.questionId)!.options.find((o) => o.id === participants.find((p) => p.slot === e.slot)!.answers[e.questionId])!.kind === 'choice');
      add({ id: condition.questionId, title: '先保留本人願意的範圍與條件', category: '各自條件', fact: '以下是本人選答，各自保留，不要求一致或折衷。', question: '在一個雙方願意聊的生活安排中，這個範圍或條件需要怎麼被保留？也可以先不安排。', evidence });
    }
    for (const state of ['same', 'different'] as const) {
      const f = usable.find((item) => item.state === state);
      if (f) add({ id: f.questionId, title: f.title, category: state === 'same' ? '選項相同' : '值得確認', fact: `雙方在這題選到${state === 'same' ? '相同' : '不同'}偏好；理由、負擔與公平感仍需要本人說明。`, question: f.discussion!, evidence: f.evidence });
    }
    if (findings.length < 3) {
      const f = report.pairs.find((item) => item.state === 'different') ?? report.pairs.find((item) => item.state === 'same');
      if (f) add({ id: f.id, title: f.title, category: '值得確認', fact: `${names[f.wantedSlot]}的期待與${names[f.providedSlot]}自述的做法，這個方向選到${f.state === 'same' ? '同一類' : '不同'}方式。`, question: f.discussion!, evidence: f.evidence });
    }
    if (condition && !usable.length && !report.pairs.some((f) => f.state !== 'context')) discovery = '這輪可先看本人願意分享的範圍或條件；沒有足夠主要選項比較共同偏好或期待／做法。';
  } else if (result.dailyComparison) {
    const report = result.dailyComparison;
    const usable = report.items.filter((f) => {
      const choiceId = quiz.dailyValues!.scenes.find((s) => s.id === f.sceneId)!.questionIds[0];
      return f.a.state === 'shared' && f.b.state === 'shared' && [a, b].every((p) => ['A', 'B', 'C', 'D'].includes(p.answers[choiceId]));
    });
    if (usable.length) {
      const f = usable.find((item) => item.importantDifference) ?? usable.find((item) => item.common) ?? usable[0];
      discoveryEvidence = evidenceFor(quiz.dailyValues!.scenes.find((s) => s.id === f.sceneId)!.questionIds);
      discovery = `在「${f.title}」，${f.facts[0].replaceAll('{{A}}', a.nickname).replaceAll('{{B}}', b.nickname)} 做法、理由與接受範圍分開看；${f.importantDifference ? '這個入口有本人明示非常重要的選擇，值得先確認意思。' : '相同首選也可能有不同理由。'}`;
    }
    const selected = [usable.find((f) => f.common), usable.find((f) => f.importantDifference) ?? usable.find((f) => !f.common)].filter((f) => f !== undefined);
    for (const f of new Map(selected.map((f) => [f.sceneId, f])).values()) add({ id: f.sceneId, title: f.title, category: f.common ? '選項相同' : '值得確認',
      fact: f.facts.join(' ').replaceAll('{{A}}', a.nickname).replaceAll('{{B}}', b.nickname), question: f.discussion,
      evidence: evidenceFor(quiz.dailyValues!.scenes.find((s) => s.id === f.sceneId)!.questionIds) });
  } else if (result.pairAnalysis) {
    const report = result.pairAnalysis;
    const first = report.differences[0] ?? report.common[0];
    if (first) discoveryEvidence = first.evidence;
    if (first) discovery = `在「${first.title}」，${first.evidence.map((e) => `${names[e.slot]}的${e.role}是「${e.label}」`).join('；')}。可以先確認各自的意思，見面條件仍分開保留。`;
    for (const [items, category] of [[report.common, '共同方向'], [report.differences, '值得確認']] as const) {
      const f = items[0];
      if (f) add({ id: f.id, title: f.title, category: category === '共同方向' ? f.kind === 'cross-partner' ? '這個方向相同' : '選項相同' : category, fact: f.description,
        question: f.advice ?? '在這個遠距日常情境中，這個選擇對你各自代表什麼？', evidence: f.evidence });
    }
  } else if (result.conversation) {
    const report = result.conversation;
    const first = report.items.find((f) => f.status === 'different') ?? report.items.find((f) => f.status === 'common');
    if (first) {
      const [ea, eb] = evidenceFor([first.questionId]);
      discoveryEvidence = [ea, eb];
      discovery = `${names.A}在「${ea.prompt}」選「${ea.label}」；${names.B}選「${eb.label}」。這輪選項${first.status === 'common' ? '相同，仍可能有不同理由' : '不同，可以從各自的意思開始了解'}。`;
    }
    for (const state of ['common', 'different'] as const) {
      const f = report.items.find((item) => item.status === state);
      if (f) add({ id: f.questionId, title: quiz.questions.find((q) => q.id === f.questionId)!.prompt, category: state === 'common' ? '選項相同' : '值得確認',
        fact: `雙方這題選項${state === 'common' ? '相同' : '不同'}；這裡只描述本輪選答。`, question: f.discussion, evidence: evidenceFor([f.questionId]) });
    }
  } else discovery = '這輪是介面示例，只呈現實際選項；沒有正式分析或契合分數。';
  return { version: '1.0.0', origin: 'reading-layer', discovery, discoveryEvidence, findings: findings.slice(0, 3) };
}
