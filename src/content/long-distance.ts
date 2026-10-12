import bank from '../../docs/quizzes/long-distance-candidate.json' with { type: 'json' };
import type { QuizDefinition } from '../domain/quiz.ts';

const comparisons: NonNullable<QuizDefinition['analysis']>['comparisons'] = [
  ['contact-wanted', '文字聯絡的期待', '一起確認忙碌週是否也沿用這個期待，保留調整的空間。', '先說明各自希望聯絡的原因，再選一個雙方願意試行的節奏；天數不代表投入程度。'],
  ['medium-wanted', '深入談話的方式', '需要深入聊時，先確認當時環境是否適合你們喜歡的方式。', '先問彼此用什麼方式最容易表達；可以分段或更換媒介，不要求一方立刻配合。'],
  ['call-arrangement', '通話時間怎麼安排', '把共同喜歡的安排說清楚，也先約好臨時有事時怎麼調整。', '可以先試一個預約時段加上彈性聯絡；若不想通話，先討論可接受的其他方式。'],
  ['shared-activity', '隔著距離一起做什麼', '想試時先確認雙方的時間與體力，做完再說說感受。', '輪流提出一個想嘗試的活動，彼此確認是否願意；也可以保留各自的休閒時間。'],
  ['busy-wanted', '忙碌時的聯絡期待', '先確認在工作、睡眠或無法用手機時，這個期待要怎麼調整。', '說說什麼訊息讓自己安心，再確認對方哪些情況做得到；可以約下一次方便聯絡的時間。'],
  ['support-wanted', '各自想收到的支持', '分享煩惱時仍可以先確認當下需要，避免把共同偏好當成每次都一樣。', '分享前先說目前想被怎麼陪伴；輪到另一方分享時，按對方需要重新確認。'],
  ['text-misunderstanding', '語氣不確定時怎麼釐清', '一起確認何時方便用這個方式釐清，給彼此整理想法的時間。', '先約一個雙方都能表達的方式與時間；可以先文字確認意思，再決定是否換媒介。'],
  ['resume-after-pause', '暫停後怎麼再談', '用一句雙方理解的話表示需要暫停，按你們選的方式確認後續。', '先協商如何表示需要休息，以及下一次確認的方式；不用承諾做不到的期限。'],
  ['visit-wanted', '希望多久見面', '把共同期待與各自可行條件一起看，再安排下一次見面。', '先說見面頻率對自己有什麼意義，再對照各自的時間、交通與負擔能力。'],
  ['visit-costs', '見面旅費的分擔原則', '下一次見面前確認這個原則對雙方都可行，也把移動時間與體力納入討論。', '先確認各自能負擔的部分，再試訂這一次的分擔方式；不需要交出收入或資產資料。'],
  ['visit-style', '見面時最想保留什麼', '安排見面時留一段給共同期待的事，也確認有沒有其他需要。', '各自選一件最想保留的事，看看同一次見面能否容納；不要把每分鐘都排滿。'],
  ['visit-change', '見面計畫改變時的需要', '計畫有變時先確認這次是否仍希望按同樣順序處理。', '可以先輪流說最需要知道或被回應的事，再安排後續；新日期無法立刻確定時，先約何時確認。'],
  ['future-location', '未來的距離安排', '再確認各自想像的時間與條件是否相同；第 23 題可幫你們看目前談到哪裡。', '先把各自希望的生活與條件說清楚，找一個現在願意討論的下一步；不必立即決定搬家或同居。'],
  ['future-revisit', '何時再談未來安排', '可以先照共同偏好約一次確認，之後再決定是否需要調整。', '先約一次雙方都願意的確認方式或時間，只談目前知道的條件，保留尚未確定的部分。'],
].map(([id, title, commonAdvice, differentAdvice]) => ({ questionId: `ldr-${id}`, title, commonAdvice, differentAdvice }));

const calls = comparisons.find((item) => item.questionId === 'ldr-call-arrangement')!;
calls.optionAdvice = {
  fixed: '可以一起挑一個都方便的固定時段，另約臨時取消時如何通知。',
  'weekly-plan': '可以在每週方便的時候先確認這週能聊的時間。',
  spontaneous: '想打電話時先問對方是否方便，未能接通時保留改約的空間。',
  mixed: '一起確認哪些時段固定、哪些時段當天再問。',
  'no-calls': '先確認目前是否想用其他方式聯絡，也可以維持各自選擇。',
};

const usedSourceIds = new Set(bank.questions.flatMap((q) => q.evidence.sourceIds));
if (bank.questions.length !== 24 || bank.questions.some((q, index) => q.order !== index + 1)) throw new Error('遠距候選題庫需完整保留 24 題題序');

export const longDistanceQuiz: QuizDefinition = {
  id: 'long-distance', version: '0.2.0', title: bank.title, subtitle: bank.subtitle,
  description: '各自回答 24 題，認識你們聯絡、支持與見面的期待。雙方完成後，一起看共同點、差異與依本輪答案提供的討論建議。',
  audience: '正在遠距・準備開始遠距的兩人', status: 'ready', theme: 'clay', motif: 'distance',
  dimensions: bank.dimensions, instructions: bank.instructions,
  questions: bank.questions.map((q) => ({ id: q.id, dimension: q.dimension, prompt: q.prompt, help: q.help,
    options: q.options, evidence: { status: 'research-informed', sourceIds: q.evidence.sourceIds, note: q.evidence.note } })),
  sources: bank.sources.filter((s) => usedSourceIds.has(s.id)).map((s) => ({ id: s.id, title: s.title, authors: s.authors, year: s.year, url: s.url,
    scope: `${s.scope} ${s.limitations}` })),
  evidenceSummary: '24 題依遠距研究方向自編，全部使用不限定性別的稱呼。三段只供閱讀，尚未做本題庫的心理測量或效果驗證；建議由本輪實際選項產生，供雙方調整或略過，不提供契合分數。',
  analysis: {
    kind: 'long-distance-paired', version: '1.0.0', excludedOptionIds: [...new Set([...bank.resultPlan.exclusionOptionIds, ...bank.resultPlan.contextOnlyOptionIds, 'other'])],
    comparisons,
    discussionPrompts: Object.fromEntries(bank.questions.map((q) => [q.id, q.design.discussionPrompt])),
    pairs: [
      { id: 'busy-response', title: '忙碌時，希望與實際做法', kind: 'cross-partner', wantedQuestionId: 'ldr-busy-wanted', providedQuestionId: 'ldr-busy-actual',
        commonAdvice: '先確認這個做法在哪些忙碌情況下可行；相同選項也可以有不同理由。',
        differentAdvice: '輪流說明期待與目前做法的原因，再一起找雙方都做得到的聯絡安排。',
        optionAdvice: {
          before: '先確認可預期的忙碌時能否提前說一聲；臨時無法通知時，另約下一次方便聯絡的時間。',
          acknowledge: '先確認哪些情況能簡短回覆；若當時連手機都無法使用，可以保留忙完再聯絡的安排。',
          after: '可以說清楚希望忙完再聊的意思，並確認雙方是否需要下一次聯絡的大致安排。',
          varies: '可以約定遇到不確定情況時如何詢問，保留依當天條件調整的空間。',
        } },
      { id: 'support', title: '分享煩惱，希望與第一步', kind: 'cross-partner', wantedQuestionId: 'ldr-support-wanted', providedQuestionId: 'ldr-support-actual',
        commonAdvice: '下次分享時可以再確認當下需要，看看平常的做法是否仍適合。',
        differentAdvice: '先確認分享者現在希望得到什麼，再協商另一方能提供的回應。',
        optionAdvice: {
          listen: '分享者可以先說「我現在想先說完」；另一方再確認什麼時候需要一起想辦法。',
          comfort: '可以先問什麼樣的關心或安慰讓對方舒服，避免猜測。',
          solutions: '可以先問是否要一起找做法，以及對方現在願意投入多少時間。',
          'check-need': '開始分享時可以先問「你現在想被聽見、安慰，還是一起想辦法？」',
          space: '一起確認想留空間時怎麼表示，以及何時再詢問是否需要陪伴。',
        } },
      { id: 'visits', title: '自己的見面期待與可行條件', kind: 'within-person', wantedQuestionId: 'ldr-visit-wanted', providedQuestionId: 'ldr-visit-capacity',
        commonAdvice: '先確認另一方也有可行的時間與移動條件，再安排下一次見面。',
        differentAdvice: '先確認是哪個條件限制安排，再一起選一個近期做得到的方案；期待可以保留，不需靠更多支出來證明。',
      },
    ],
  },
};
