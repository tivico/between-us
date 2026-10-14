import { createHash, createHmac, randomUUID } from 'node:crypto';
import { roundQuizzes } from '../src/content/quizzes.ts';
import { compareValues } from '../src/domain/compatibility.ts';
import { compareConversation } from '../src/domain/conversation.ts';
import { analyzeDailyValues, normalizeDailyAnswers } from '../src/domain/daily-values.ts';
import { analyzeDistance } from '../src/domain/long-distance.ts';
import { analyzeCommunication } from '../src/domain/communication.ts';
import { analyzeMoneyLife } from '../src/domain/money-life.ts';
import { buildValueFeedback } from '../src/domain/value-feedback.ts';
import { buildResultOpening } from '../src/domain/result-opening.ts';
import { expiryFrom } from '../src/domain/retention.ts';

export class RoundError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new RoundError(code, message, status); };
const digest = (token) => createHash('sha256').update(token).digest('hex');
const requireToken = (token) => {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail('UNAUTHORIZED', '私人連結不完整或已失效。', 401);
};
const invitationFor = (token, id) => createHmac('sha256', token).update(`between-us:invite:v1:${id}`).digest('hex');
const nicknameFor = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24) fail('INVALID_NAME', '請填寫 1–24 字的暱稱。');
  return value.trim();
};

// 每次 HTTP 請求使用一個 session；更新使用條件 SQL，不能跨 await 持有 SQLite transaction。
export class D1RoundStore {
  constructor(db, { catalog = roundQuizzes, now = () => Date.now() } = {}) {
    this.db = db.withSession('first-primary'); this.catalog = catalog; this.now = now;
  }
  statement(sql, ...args) { return this.db.prepare(sql).bind(...args); }
  one(sql, ...args) { return this.statement(sql, ...args).first(); }
  stamp() { return new Date(this.now()).toISOString(); }
  async authenticate(id, token) {
    requireToken(token);
    const own = await this.one('SELECT p.*,r.expires_at,r.snapshot FROM participants p JOIN rounds r ON r.id=p.round_id WHERE round_id = ? AND token_hash = ?', id, digest(token));
    if (!own) fail('UNAUTHORIZED', '這個私人連結無法開啟此回合。', 401);
    this.available(own);
    if (own.withdrawn_at) fail('PARTICIPANT_WITHDRAWN', '你已刪除答案並退出這一輪。', 410);
    return own;
  }
  available(round) {
    if (round.expires_at && round.expires_at <= this.stamp()) fail('ROUND_EXPIRED', '這一輪已到保存期限，無法再開啟。', 410);
  }
  async requireOpen(id) {
    if (await this.one('SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL', id)) fail('ROUND_CLOSED', '有人已退出，共同結果已關閉；你仍可查看或刪除自己的答案。', 410);
  }
  // batch 的讀取在同一交易中：授權、退出與答案不會跨不同資料狀態。
  async readView(id, token) {
    requireToken(token);
    const [auth, round, people] = await this.db.batch([
      this.statement('SELECT * FROM participants WHERE round_id=? AND token_hash=?', id, digest(token)),
      this.statement('SELECT * FROM rounds WHERE id=?', id),
      this.statement('SELECT * FROM participants WHERE round_id=? ORDER BY slot', id),
    ]);
    const own = auth.results[0], saved = round.results[0];
    if (!own || !saved) fail('UNAUTHORIZED', '這個私人連結無法開啟此回合。', 401);
    this.available(saved);
    if (own.withdrawn_at) fail('PARTICIPANT_WITHDRAWN', '你已刪除答案並退出這一輪。', 410);
    return { own, round: saved, participants: people.results };
  }
  async cleanupExpired() {
    const cutoff = this.stamp();
    const results = await this.db.batch([
      this.statement('DELETE FROM participants WHERE round_id IN (SELECT id FROM rounds WHERE expires_at IS NOT NULL AND expires_at<=?)', cutoff),
      this.statement('DELETE FROM rounds WHERE expires_at IS NOT NULL AND expires_at<=?', cutoff),
    ]);
    return results[1].meta.changes;
  }
  async withdraw(id, token, { confirm } = {}) {
    requireToken(token);
    if (confirm !== 'withdraw') fail('CONFIRMATION_REQUIRED', '請確認刪除本人答案並退出。');
    const stamp = this.stamp();
    const result = await this.db.batch([
      this.statement("UPDATE participants SET answers='{}',nickname='已退出',submitted_at=NULL,withdrawn_at=COALESCE(withdrawn_at,?),revision=revision+1,previous_token_hash=NULL WHERE round_id=? AND token_hash=? AND EXISTS(SELECT 1 FROM rounds WHERE id=? AND (expires_at IS NULL OR expires_at>?))", stamp, id, digest(token), id, stamp),
      this.statement('UPDATE rounds SET invite_hash=NULL WHERE id=? AND EXISTS(SELECT 1 FROM participants WHERE round_id=? AND token_hash=? AND withdrawn_at IS NOT NULL)', id, id, digest(token)),
    ]);
    if (!result[0].meta.changes) { await this.authenticate(id, token); fail('REQUEST_CONFLICT', '紀錄已變更，請重新載入。', 409); }
    return { withdrawn: true };
  }
  async rotate(id, token, { privateToken } = {}) {
    requireToken(token); requireToken(privateToken);
    if (token === privateToken) fail('REQUEST_CONFLICT', '請使用新的私人返回憑證。', 409);
    const hash = digest(privateToken), oldHash = digest(token);
    const retry = async () => {
      const own = await this.one('SELECT * FROM participants WHERE round_id=? AND token_hash=? AND previous_token_hash=?', id, hash, oldHash);
      if (!own) return false;
      await this.authenticate(id, privateToken); return true;
    };
    if (await retry()) return { rotated: true };
    try { await this.authenticate(id, token); }
    catch (error) { if (await retry()) return { rotated: true }; throw error; }
    if (await this.one('SELECT 1 FROM participants WHERE token_hash=?', hash)) {
      if (await retry()) return { rotated: true };
      fail('REQUEST_CONFLICT', '請使用新的私人返回憑證。', 409);
    }
    let result;
    try {
      result = await this.db.batch([
        this.statement('UPDATE participants SET token_hash=?,previous_token_hash=? WHERE round_id=? AND token_hash=? AND withdrawn_at IS NULL AND EXISTS(SELECT 1 FROM rounds WHERE id=? AND (expires_at IS NULL OR expires_at>?))', hash, oldHash, id, oldHash, id, this.stamp()),
        this.statement("UPDATE rounds SET invite_hash=CASE WHEN NOT EXISTS(SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL) AND EXISTS(SELECT 1 FROM participants WHERE round_id=? AND slot='A' AND submitted_at IS NOT NULL) THEN ? ELSE NULL END WHERE id=? AND EXISTS(SELECT 1 FROM participants WHERE round_id=? AND slot='A' AND token_hash=? AND previous_token_hash=?)", id, id, digest(invitationFor(privateToken, id)), id, id, hash, oldHash),
      ]);
    } catch (error) {
      if (await retry()) return { rotated: true };
      if (await this.one('SELECT 1 FROM participants WHERE token_hash=?', hash)) fail('REQUEST_CONFLICT', '請使用新的私人返回憑證。', 409);
      throw error;
    }
    if (!result[0].meta.changes && !await retry()) { await this.authenticate(id, token); fail('REQUEST_CONFLICT', '紀錄已變更，請重新載入。', 409); }
    return { rotated: true };
  }
  async create({ quizId, nickname, consent, privateToken }) {
    requireToken(privateToken);
    const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    const quiz = this.catalog.find((item) => item.id === quizId);
    if (!quiz || !quiz.questions.length || quiz.status === 'planned') fail('TOPIC_UNAVAILABLE', '這個主題還沒有可填答的題目。');
    const hash = digest(privateToken);
    const existingResult = async () => {
      const existing = await this.one('SELECT p.*,r.quiz_id FROM participants p JOIN rounds r ON r.id=p.round_id WHERE token_hash=?', hash);
      if (!existing) return null;
      if (existing.slot !== 'A' || existing.quiz_id !== quizId || existing.nickname !== name) fail('REQUEST_CONFLICT', '這次建立請求與原回合不同。', 409);
      return { id: existing.round_id };
    };
    const existing = await existingResult();
    if (existing) return existing;
    const id = randomUUID(); const stamp = this.stamp();
    try {
      // batch 全部成功才提交；憑證撞到時 round 與 participant 一起回滾。
      await this.db.batch([
        this.statement('INSERT INTO rounds(id,quiz_id,snapshot,created_at,expires_at) VALUES(?,?,?,?,?)', id, quiz.id, JSON.stringify(quiz), stamp, expiryFrom(this.now())),
        this.statement('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,?,?,?,?)', id, 'A', hash, name, stamp),
      ]);
    } catch (error) {
      const retry = await existingResult(); if (retry) return retry; throw error;
    }
    return { id };
  }
  async status(id, token) {
    const { own, round, participants } = await this.readView(id, token);
    const peer = participants.find((p) => p.slot !== own.slot);
    return {
      id, quiz: JSON.parse(round.snapshot), createdAt: round.created_at, expiresAt: round.expires_at,
      state: peer?.withdrawn_at ? 'closed' : own.submitted_at && peer?.submitted_at ? 'unlocked' : own.submitted_at ? 'waiting' : 'answering',
      own: { nickname: own.nickname, slot: own.slot, answers: JSON.parse(own.answers), revision: own.revision, submittedAt: own.submitted_at },
      peer: peer ? { nickname: peer.nickname, submitted: Boolean(peer.submitted_at) } : null,
      invitationToken: !peer?.withdrawn_at && own.slot === 'A' && own.submitted_at ? invitationFor(token, id) : null,
    };
  }
  async save(id, token, { answers, revision }) {
    const own = await this.authenticate(id, token);
    await this.requireOpen(id);
    if (own.submitted_at) fail('ROUND_LOCKED', '本輪已提交，答案已鎖定。', 409);
    const quiz = JSON.parse(own.snapshot);
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || !Number.isInteger(revision) || revision < 0) fail('INVALID_ANSWERS', '答案格式不正確。');
    for (const key of Object.keys(answers)) {
      const q = quiz.questions.find((item) => item.id === key);
      if (!q || !q.options.some((item) => item.id === answers[key])) fail('INVALID_ANSWERS', '答案包含不屬於本輪的題目或選項。');
    }
    const encoded = JSON.stringify(normalizeDailyAnswers(quiz, Object.fromEntries(quiz.questions.filter((q) => Object.hasOwn(answers, q.id)).map((q) => [q.id, answers[q.id]]))));
    const result = await this.statement('UPDATE participants SET answers=?,revision=revision+1 WHERE round_id=? AND slot=? AND revision=? AND submitted_at IS NULL AND token_hash=? AND withdrawn_at IS NULL AND NOT EXISTS(SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL) AND EXISTS(SELECT 1 FROM rounds WHERE id=? AND (expires_at IS NULL OR expires_at>?))', encoded, id, own.slot, revision, digest(token), id, id, this.stamp()).run();
    if (result.meta.changes === 1) return { revision: revision + 1 };
    const fresh = await this.authenticate(id, token);
    await this.requireOpen(id);
    if (fresh.submitted_at) fail('ROUND_LOCKED', '本輪已提交，答案已鎖定。', 409);
    if (fresh.answers === encoded) return { revision: fresh.revision };
    fail('STALE_REVISION', '另一個分頁已更新答案，請重新載入最新紀錄。', 409);
  }
  async submit(id, token) {
    const own = await this.authenticate(id, token);
    await this.requireOpen(id);
    if (own.submitted_at) return this.status(id, token);
    const quiz = JSON.parse(own.snapshot);
    const answers = JSON.parse(own.answers);
    if (!quiz.questions.every((q) => q.options.some((o) => o.id === answers[q.id]))) fail('INCOMPLETE', '請完成本輪所有題目再提交。');
    const statements = [this.statement('UPDATE participants SET submitted_at=? WHERE round_id=? AND slot=? AND revision=? AND submitted_at IS NULL AND token_hash=? AND withdrawn_at IS NULL AND NOT EXISTS(SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL) AND EXISTS(SELECT 1 FROM rounds WHERE id=? AND (expires_at IS NULL OR expires_at>?))', this.stamp(), id, own.slot, own.revision, digest(token), id, id, this.stamp())];
    if (own.slot === 'A') statements.push(this.statement("UPDATE rounds SET invite_hash=? WHERE id=? AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS(SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL) AND EXISTS(SELECT 1 FROM participants WHERE round_id=? AND slot='A' AND token_hash=? AND submitted_at IS NOT NULL)", digest(invitationFor(token, id)), id, this.stamp(), id, id, digest(token)));
    await this.db.batch(statements);
    const status = await this.status(id, token);
    if (status.state === 'closed') fail('ROUND_CLOSED', '有人已退出，共同結果已關閉。', 410);
    if (!status.own.submittedAt) fail('STALE_REVISION', '另一個分頁已更新答案，請重新載入最新紀錄。', 409);
    return status;
  }
  async invitation(token) {
    requireToken(token);
    const round = await this.one('SELECT * FROM rounds WHERE invite_hash=?', digest(token));
    if (!round) fail('INVITATION_INVALID', '邀請連結不完整或不存在。', 404);
    this.available(round); await this.requireOpen(round.id);
    return round;
  }
  async invitationPreview(token) {
    const round = await this.invitation(token);
    const a = await this.one("SELECT nickname FROM participants WHERE round_id=? AND slot='A'", round.id);
    const b = await this.one("SELECT 1 FROM participants WHERE round_id=? AND slot='B'", round.id);
    const quiz = JSON.parse(round.snapshot);
    return { id: round.id, hostName: a.nickname, title: quiz.title, expiresAt: round.expires_at, questionCount: quiz.questions.length, hasValueScore: Boolean(quiz.scoring), isQuestionnaire: Boolean(quiz.questionnaire), hasPairAnalysis: Boolean(quiz.analysis), hasDailyValues: Boolean(quiz.dailyValues), hasCommunicationAnalysis: Boolean(quiz.communication), hasMoneyLifeAnalysis: Boolean(quiz.moneyLife), claimed: Boolean(b) };
  }
  async claim({ invitationToken, nickname, consent, privateToken }) {
    requireToken(privateToken); const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    const round = await this.invitation(invitationToken); const hash = digest(privateToken);
    // INSERT OR IGNORE 同時由 slot 主鍵與 token 唯一鍵阻擋競爭；再檢查誰取得邀請。
    await this.statement("INSERT OR IGNORE INTO participants(round_id,slot,token_hash,nickname,consent_at) SELECT id,'B',?,?,? FROM rounds WHERE id=? AND invite_hash=? AND (expires_at IS NULL OR expires_at>?) AND NOT EXISTS(SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL)", hash, name, this.stamp(), round.id, digest(invitationToken), this.stamp(), round.id).run();
    const existing = await this.one("SELECT * FROM participants WHERE round_id=? AND slot='B'", round.id);
    if (existing?.token_hash === hash && existing.nickname === name) { await this.authenticate(round.id, privateToken); return { id: round.id }; }
    await this.invitation(invitationToken);
    if (existing) fail('INVITATION_CLAIMED', '這個邀請已有人加入。請使用自己的私人返回連結。', 409);
    fail('REQUEST_CONFLICT', '請使用另一個私人返回憑證。', 409);
  }
  async results(id, token) {
    const { round, participants } = await this.readView(id, token);
    if (participants.some((p) => p.withdrawn_at)) fail('ROUND_CLOSED', '有人已退出，共同結果已關閉。', 410);
    if (participants.length !== 2 || !participants.every((p) => p.submitted_at)) fail('RESULTS_LOCKED', '雙方完成後才能查看共同結果。', 423);
    const quiz = JSON.parse(round.snapshot);
    const comparison = compareValues(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const valueFeedback = buildValueFeedback(quiz, comparison);
    const communicationAnalysis = analyzeCommunication(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const moneyLifeAnalysis = analyzeMoneyLife(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const pairAnalysis = analyzeDistance(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const conversation = compareConversation(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const dailyComparison = analyzeDailyValues(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const result = { quiz, ...(moneyLifeAnalysis ? { moneyLifeAnalysis } : {}), ...(communicationAnalysis ? { communicationAnalysis } : {}), ...(dailyComparison ? { dailyComparison } : {}), ...(comparison ? { comparison } : {}), ...(valueFeedback ? { valueFeedback } : {}), ...(conversation ? { conversation } : {}), ...(pairAnalysis ? { pairAnalysis } : {}), createdAt: round.created_at, participants: participants.map((p) => ({ slot: p.slot, nickname: p.nickname, answers: JSON.parse(p.answers), submittedAt: p.submitted_at })) };
    return { ...result, resultOpening: buildResultOpening(result) };
  }
}
