import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { RoundStore } from './store.mjs';
import { coreValuesExample, roundQuizzes } from '../src/content/quizzes.ts';

const token = () => randomBytes(32).toString('hex');
const fullAnswers = (quiz) => Object.fromEntries(quiz.questions.map((question) => [question.id, question.options[0].id]));
let store;
let a;
let id;
beforeEach(() => {
  store = new RoundStore(); a = token();
  id = store.create({ quizId: 'core-values-example', nickname: '測試 A', consent: true, privateToken: a }).id;
});
afterEach(() => store.close());
function submitA() {
  const quiz = store.status(id, a).quiz;
  store.save(id, a, { answers: fullAnswers(quiz), revision: 0 });
  return store.submit(id, a).invitationToken;
}

describe('私人回合與保存', () => {
  it('建立需同意分享，未準備的主題不能建立；重試不新增回合', () => {
    expect(() => store.create({ quizId: 'core-values-example', nickname: '人', consent: false, privateToken: token() })).toThrow('同意');
    expect(() => store.create({ quizId: 'communication', nickname: '人', consent: true, privateToken: token() })).toThrow('還沒有');
    expect(store.create({ quizId: 'core-values-example', nickname: '測試 A', consent: true, privateToken: a }).id).toBe(id);
    expect(store.db.prepare('SELECT count(*) AS n FROM rounds').get().n).toBe(1);
  });
  it('陌生憑證或其他回合的憑證不能讀寫此回合', () => {
    const other = token();
    store.create({ quizId: 'core-values-example', nickname: '其他人', consent: true, privateToken: other });
    for (const unknown of [token(), other, undefined]) {
      expect(() => store.status(id, unknown)).toThrow();
      expect(() => store.save(id, unknown, { answers: {}, revision: 0 })).toThrow();
      expect(() => store.results(id, unknown)).toThrow();
    }
  });
  it('驗證選項與題目屬於本輪快照，保存部分答案可恢復', () => {
    expect(() => store.save(id, a, { answers: { missing: 'yes' }, revision: 0 })).toThrow('不屬於');
    expect(() => store.save(id, a, { answers: { 'values-work-choice': 'fairness' }, revision: 0 })).toThrow('不屬於');
    store.save(id, a, { answers: { 'values-work-choice': 'autonomy' }, revision: 0 });
    expect(store.status(id, a).own.answers).toEqual({ 'values-work-choice': 'autonomy' });
    expect(() => store.submit(id, a)).toThrow('所有題目');
  });
  it('不同分頁的過時答案不覆蓋新內容，同一資料的網路重試可成功', () => {
    const answers = { 'values-work-choice': 'security' };
    expect(store.save(id, a, { answers, revision: 0 })).toEqual({ revision: 1 });
    expect(store.save(id, a, { answers, revision: 0 })).toEqual({ revision: 1 });
    expect(() => store.save(id, a, { answers: {}, revision: 0 })).toThrow('另一個分頁');
    expect(store.status(id, a).own.answers).toEqual(answers);
  });
  it('題庫更新不改既有回合', () => {
    const catalog = structuredClone(roundQuizzes);
    const isolated = new RoundStore(':memory:', { catalog });
    try {
      const key = token();
      const created = isolated.create({ quizId: 'core-values-example', nickname: '人', consent: true, privateToken: key });
      const example = catalog.find((quiz) => quiz.id === 'core-values-example');
      example.title = '新版'; example.questions[0].prompt = '新版題目';
      expect(isolated.status(created.id, key).quiz.title).toBe('核心價值・3 題示例');
      expect(isolated.status(created.id, key).quiz.questions[0].prompt).not.toBe('新版題目');
    } finally { isolated.close(); }
  });
  it('資料庫不保存原始私人／邀請憑證', () => {
    const invite = submitA();
    expect(JSON.stringify(store.db.prepare('SELECT * FROM participants').all())).not.toContain(a);
    expect(JSON.stringify(store.db.prepare('SELECT * FROM rounds').all())).not.toContain(invite);
  });
  it('重啟後可恢復草稿與同一邀請', () => {
    const file = resolve(`.local/store-test-${randomUUID()}.sqlite`);
    const key = token();
    let persistent = new RoundStore(file);
    try {
      const round = persistent.create({ quizId: 'core-values-example', nickname: '人', consent: true, privateToken: key });
      persistent.save(round.id, key, { answers: fullAnswers(persistent.status(round.id, key).quiz), revision: 0 });
      const invite = persistent.submit(round.id, key).invitationToken;
      persistent.close(); persistent = new RoundStore(file);
      expect(persistent.status(round.id, key).invitationToken).toBe(invite);
      expect(persistent.status(round.id, key).own.answers).toEqual(fullAnswers(coreValuesExample));
    } finally {
      persistent.close();
      for (const path of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(path)) rmSync(path);
    }
  });
});

describe('雙人授權與解鎖', () => {
  it('A 提交前沒有邀請，提交後鎖定；重複提交保持同一完成時間', () => {
    expect(store.status(id, a).invitationToken).toBeNull();
    submitA();
    const first = store.status(id, a);
    expect(store.submit(id, a).own.submittedAt).toBe(first.own.submittedAt);
    expect(() => store.save(id, a, { answers: {}, revision: 1 })).toThrow('已鎖定');
  });
  it('邀請預覽不包含 A 答案，邀請憑證不能當參與者憑證', () => {
    const invite = submitA();
    const preview = store.invitationPreview(invite);
    expect(preview).not.toHaveProperty('answers');
    expect(preview).not.toHaveProperty('privateToken');
    expect(() => store.status(id, invite)).toThrow();
    expect(() => store.results(id, invite)).toThrow();
  });
  it('B 須同意分享，僅有一席；相同 B 的重試可恢復，第三人不能加入', () => {
    const invite = submitA(); const b = token();
    const request = { invitationToken: invite, privateToken: b, nickname: '測試 B', consent: true };
    expect(() => store.claim({ ...request, consent: false })).toThrow('同意');
    expect(store.claim(request).id).toBe(id);
    expect(store.claim(request).id).toBe(id);
    expect(() => store.claim({ ...request, privateToken: token(), nickname: '第三人' })).toThrow('已有人加入');
  });
  it('B 完成前禁止共同結果，兩人狀態 API 都不帶對方答案', () => {
    const invite = submitA(); const b = token();
    store.claim({ invitationToken: invite, privateToken: b, nickname: '測試 B', consent: true });
    expect(() => store.results(id, a)).toThrow('雙方完成');
    expect(() => store.results(id, b)).toThrow('雙方完成');
    expect(store.status(id, a).peer).toEqual({ nickname: '測試 B', submitted: false });
    expect(store.status(id, b).own.answers).toEqual({});
    expect(store.status(id, b).peer).not.toHaveProperty('answers');
    expect(store.status(id, b).invitationToken).toBeNull();
  });
  it('兩人完成才解鎖，雙方可讀相同結果；B 提交後也不能修改', () => {
    const invite = submitA(); const b = token();
    store.claim({ invitationToken: invite, privateToken: b, nickname: '測試 B', consent: true });
    const answers = fullAnswers(coreValuesExample); answers['values-work-choice'] = 'security';
    store.save(id, b, { answers, revision: 0 }); store.submit(id, b);
    expect(store.status(id, a).state).toBe('unlocked');
    expect(store.results(id, a)).toEqual(store.results(id, b));
    expect(store.results(id, a).participants[1].answers['values-work-choice']).toBe('security');
    expect(() => store.save(id, b, { answers: {}, revision: 1 })).toThrow('已鎖定');
  });
});


it('57 題完整保存、保密與 snapshot 計分；新題庫變動不追改結果', () => {
  const catalog = structuredClone(roundQuizzes);
  const isolated = new RoundStore(':memory:', { catalog });
  try {
    const a = token(); const b = token();
    const { id } = isolated.create({ quizId: 'core-values', nickname: '工程 A', consent: true, privateToken: a });
    const quiz = isolated.status(id, a).quiz;
    expect(quiz.questions).toHaveLength(57);
    expect(quiz.version).toBe('0.3.0');
    expect(isolated.status(id, a)).not.toHaveProperty('comparison');
    const answers = Object.fromEntries(quiz.questions.map((q, i) => [q.id, q.options[i % 6].id]));
    const partial = { ...answers }; delete partial['pvqrr-57'];
    isolated.save(id, a, { answers: partial, revision: 0 });
    expect(() => isolated.submit(id, a)).toThrow('所有題目');
    isolated.save(id, a, { answers, revision: 1 });
    const invite = isolated.submit(id, a).invitationToken;
    expect(isolated.invitationPreview(invite)).toMatchObject({ questionCount: 57, hasValueScore: true });
    isolated.claim({ invitationToken: invite, nickname: '工程 B', consent: true, privateToken: b });
    expect(isolated.status(id, b).peer).not.toHaveProperty('answers');
    expect(() => isolated.results(id, b)).toThrow('雙方完成');
    isolated.save(id, b, { answers, revision: 0 }); isolated.submit(id, b);
    catalog[0].scoring.version = 'future'; catalog[0].questions[0].prompt = 'future';
    const result = isolated.results(id, a);
    expect(result).toEqual(isolated.results(id, b));
    expect(result.comparison.score).toBe(100);
    expect(result.comparison.values).toHaveLength(19);
    expect(result.quiz.scoring.version).toBe('1.0.0');
    expect(() => isolated.save(id, a, { answers, revision: 2 })).toThrow('鎖定');
  } finally { isolated.close(); }
});


it('舊 core-values 三題快照在新版服務仍是三題且沒有相近度', () => {
  const legacy = { ...structuredClone(coreValuesExample), id: 'core-values', title: '三觀與核心價值' };
  const catalog = [legacy]; const isolated = new RoundStore(':memory:', { catalog });
  try {
    const a = token(); const b = token();
    const { id } = isolated.create({ quizId: 'core-values', nickname: '舊回合 A', consent: true, privateToken: a });
    const answers = fullAnswers(legacy);
    catalog[0] = structuredClone(roundQuizzes[0]);
    isolated.save(id, a, { answers, revision: 0 });
    const invitationToken = isolated.submit(id, a).invitationToken;
    isolated.claim({ invitationToken, nickname: '舊回合 B', consent: true, privateToken: b });
    isolated.save(id, b, { answers, revision: 0 }); isolated.submit(id, b);
    expect(isolated.results(id, a).quiz.questions).toHaveLength(3);
    expect(isolated.results(id, a).quiz.version).toBe('0.1.0');
    expect(isolated.results(id, a)).not.toHaveProperty('comparison');
  } finally { isolated.close(); }
});
