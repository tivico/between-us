import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
const validToken = (token) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
const requireToken = (token) => { if (!validToken(token)) fail('UNAUTHORIZED', '私人連結不完整或已失效。', 401); };
const invitationFor = (token, id) => createHmac('sha256', token).update(`between-us:invite:v1:${id}`).digest('hex');
const nicknameFor = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24) fail('INVALID_NAME', '請填寫 1–24 字的暱稱。');
  return value.trim();
};

export class RoundStore {
  constructor(path = ':memory:', { catalog = roundQuizzes, now = () => Date.now() } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.catalog = catalog;
    this.now = now;
    const schemaVersion = this.db.prepare('PRAGMA user_version').get().user_version;
    if (schemaVersion > 2) { this.db.close(); throw new Error('資料庫版本比此程式新，請先確認版本，不要覆寫資料。'); }
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, snapshot TEXT NOT NULL,
        created_at TEXT NOT NULL, invite_hash TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS participants (
        round_id TEXT NOT NULL REFERENCES rounds(id), slot TEXT NOT NULL CHECK(slot IN ('A','B')),
        token_hash TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, consent_at TEXT NOT NULL,
        submitted_at TEXT, answers TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(round_id, slot)
      );
    `);
    if (schemaVersion < 2) this.transaction(() => this.db.exec(`
      ALTER TABLE rounds ADD COLUMN expires_at TEXT;
      ALTER TABLE participants ADD COLUMN withdrawn_at TEXT;
      ALTER TABLE participants ADD COLUMN previous_token_hash TEXT;
      CREATE INDEX rounds_expiry ON rounds(expires_at);
      PRAGMA user_version = 2;
    `));
    this.cleanupExpired();
    this.cleanupTimer = setInterval(() => {
      try { this.cleanupExpired(); } catch { console.error('RETENTION_CLEANUP_FAILED'); }
    }, 86400000);
    this.cleanupTimer.unref();
  }
  close() { clearInterval(this.cleanupTimer); this.db.close(); }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  stamp() { return new Date(this.now()).toISOString(); }
  authenticate(id, token) {
    requireToken(token);
    const own = this.db.prepare('SELECT * FROM participants WHERE round_id = ? AND token_hash = ?').get(id, digest(token));
    if (!own) fail('UNAUTHORIZED', '這個私人連結無法開啟此回合。', 401);
    this.available(this.db.prepare('SELECT * FROM rounds WHERE id=?').get(id));
    if (own.withdrawn_at) fail('PARTICIPANT_WITHDRAWN', '你已刪除答案並退出這一輪。', 410);
    return own;
  }
  available(round) {
    if (round.expires_at && round.expires_at <= this.stamp()) fail('ROUND_EXPIRED', '這一輪已到保存期限，無法再開啟。', 410);
    return round;
  }
  requireOpen(id) {
    if (this.db.prepare('SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL').get(id)) fail('ROUND_CLOSED', '有人已退出，共同結果已關閉；你仍可查看或刪除自己的答案。', 410);
  }
  cleanupExpired() {
    return this.transaction(() => {
      const cutoff = this.stamp();
      this.db.prepare('DELETE FROM participants WHERE round_id IN (SELECT id FROM rounds WHERE expires_at IS NOT NULL AND expires_at<=?)').run(cutoff);
      return this.db.prepare('DELETE FROM rounds WHERE expires_at IS NOT NULL AND expires_at<=?').run(cutoff).changes;
    });
  }
  withdraw(id, token, { confirm } = {}) {
    if (confirm !== 'withdraw') fail('CONFIRMATION_REQUIRED', '請確認刪除本人答案並退出。');
    return this.transaction(() => {
      requireToken(token);
      const own = this.db.prepare('SELECT * FROM participants WHERE round_id=? AND token_hash=?').get(id, digest(token));
      if (!own) fail('UNAUTHORIZED', '這個私人連結無法開啟此回合。', 401);
      this.available(this.db.prepare('SELECT * FROM rounds WHERE id=?').get(id));
      this.db.prepare("UPDATE participants SET answers='{}',nickname='已退出',submitted_at=NULL,withdrawn_at=COALESCE(withdrawn_at,?),revision=revision+1,previous_token_hash=NULL WHERE round_id=? AND slot=?").run(this.stamp(), id, own.slot);
      this.db.prepare('UPDATE rounds SET invite_hash=NULL WHERE id=?').run(id);
      return { withdrawn: true };
    });
  }
  rotate(id, token, { privateToken } = {}) {
    requireToken(token); requireToken(privateToken);
    if (token === privateToken) fail('REQUEST_CONFLICT', '請使用新的私人返回憑證。', 409);
    return this.transaction(() => {
      const retry = this.db.prepare('SELECT * FROM participants WHERE round_id=? AND token_hash=? AND previous_token_hash=?').get(id, digest(privateToken), digest(token));
      if (retry) { this.authenticate(id, privateToken); return { rotated: true }; }
      const own = this.authenticate(id, token);
      if (this.db.prepare('SELECT 1 FROM participants WHERE token_hash=?').get(digest(privateToken))) fail('REQUEST_CONFLICT', '請使用新的私人返回憑證。', 409);
      this.db.prepare('UPDATE participants SET token_hash=?,previous_token_hash=? WHERE round_id=? AND slot=?').run(digest(privateToken), digest(token), id, own.slot);
      if (own.slot === 'A') this.db.prepare('UPDATE rounds SET invite_hash=? WHERE id=?').run(own.submitted_at && !this.db.prepare('SELECT 1 FROM participants WHERE round_id=? AND withdrawn_at IS NOT NULL').get(id) ? digest(invitationFor(privateToken, id)) : null, id);
      return { rotated: true };
    });
  }
  create({ quizId, nickname, consent, privateToken }) {
    requireToken(privateToken);
    const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    const quiz = this.catalog.find((item) => item.id === quizId);
    // 此階段只允許已有題目的草案／正式主題建立本機測試回合。
    if (!quiz || !quiz.questions.length || quiz.status === 'planned') fail('TOPIC_UNAVAILABLE', '這個主題還沒有可填答的題目。');
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM participants WHERE token_hash = ?').get(digest(privateToken));
      if (existing) {
        const round = this.db.prepare('SELECT * FROM rounds WHERE id = ?').get(existing.round_id);
        if (existing.slot !== 'A' || round.quiz_id !== quizId || existing.nickname !== name) fail('REQUEST_CONFLICT', '這次建立請求與原回合不同。', 409);
        return { id: round.id };
      }
      const id = randomUUID();
      const createdAt = this.stamp();
      this.db.prepare('INSERT INTO rounds(id,quiz_id,snapshot,created_at,expires_at) VALUES(?,?,?,?,?)').run(id, quiz.id, JSON.stringify(quiz), createdAt, expiryFrom(this.now()));
      this.db.prepare('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,?,?,?,?)').run(id, 'A', digest(privateToken), name, createdAt);
      return { id };
    });
  }
  status(id, token) {
    const own = this.authenticate(id, token);
    const round = this.db.prepare('SELECT * FROM rounds WHERE id = ?').get(id);
    const peer = this.db.prepare('SELECT nickname,submitted_at,withdrawn_at FROM participants WHERE round_id = ? AND slot != ?').get(id, own.slot);
    const unlocked = Boolean(own.submitted_at && peer?.submitted_at);
    const state = peer?.withdrawn_at ? 'closed' : unlocked ? 'unlocked' : own.submitted_at ? 'waiting' : 'answering';
    return {
      id, quiz: JSON.parse(round.snapshot), createdAt: round.created_at, expiresAt: round.expires_at, state,
      own: { nickname: own.nickname, slot: own.slot, answers: JSON.parse(own.answers), revision: own.revision, submittedAt: own.submitted_at },
      peer: peer ? { nickname: peer.nickname, submitted: Boolean(peer.submitted_at) } : null,
      invitationToken: state !== 'closed' && own.slot === 'A' && own.submitted_at ? invitationFor(token, id) : null,
    };
  }
  save(id, token, { answers, revision }) {
    return this.transaction(() => {
      const own = this.authenticate(id, token);
      this.requireOpen(id);
      if (own.submitted_at) fail('ROUND_LOCKED', '本輪已提交，答案已鎖定。', 409);
      const quiz = JSON.parse(this.db.prepare('SELECT snapshot FROM rounds WHERE id = ?').get(id).snapshot);
      if (!answers || typeof answers !== 'object' || Array.isArray(answers) || !Number.isInteger(revision) || revision < 0) fail('INVALID_ANSWERS', '答案格式不正確。');
      const normalized = {};
      for (const key of Object.keys(answers)) {
        const question = quiz.questions.find((item) => item.id === key);
        if (!question || !question.options.some((item) => item.id === answers[key])) fail('INVALID_ANSWERS', '答案包含不屬於本輪的題目或選項。');
      }
      for (const question of quiz.questions) if (Object.hasOwn(answers, question.id)) normalized[question.id] = answers[question.id];
      const encoded = JSON.stringify(normalizeDailyAnswers(quiz, normalized));
      if (revision !== own.revision) {
        // 回應遺失後重試同一份答案可安全成功；其他分頁的不同更新需明確處理。
        if (encoded === own.answers) return { revision: own.revision };
        fail('STALE_REVISION', '另一個分頁已更新答案，請重新載入最新紀錄。', 409);
      }
      this.db.prepare('UPDATE participants SET answers = ?, revision = revision + 1 WHERE round_id = ? AND slot = ?').run(encoded, id, own.slot);
      return { revision: own.revision + 1 };
    });
  }
  submit(id, token) {
    this.transaction(() => {
      const own = this.authenticate(id, token);
      this.requireOpen(id);
      if (own.submitted_at) return;
      const quiz = JSON.parse(this.db.prepare('SELECT snapshot FROM rounds WHERE id = ?').get(id).snapshot);
      const answers = JSON.parse(own.answers);
      if (!quiz.questions.every((question) => question.options.some((option) => option.id === answers[question.id]))) fail('INCOMPLETE', '請完成本輪所有題目再提交。');
      this.db.prepare('UPDATE participants SET submitted_at = ? WHERE round_id = ? AND slot = ?').run(this.stamp(), id, own.slot);
      if (own.slot === 'A') this.db.prepare('UPDATE rounds SET invite_hash = ? WHERE id = ?').run(digest(invitationFor(token, id)), id);
    });
    return this.status(id, token);
  }
  invitation(token) {
    requireToken(token);
    const round = this.db.prepare('SELECT * FROM rounds WHERE invite_hash = ?').get(digest(token));
    if (!round) fail('INVITATION_INVALID', '邀請連結不完整或不存在。', 404);
    this.available(round); this.requireOpen(round.id);
    return round;
  }
  invitationPreview(token) {
    const round = this.invitation(token);
    const a = this.db.prepare("SELECT nickname FROM participants WHERE round_id = ? AND slot = 'A'").get(round.id);
    const b = this.db.prepare("SELECT 1 FROM participants WHERE round_id = ? AND slot = 'B'").get(round.id);
    const quiz = JSON.parse(round.snapshot);
    return { id: round.id, hostName: a.nickname, title: quiz.title, expiresAt: round.expires_at, questionCount: quiz.questions.length, hasValueScore: Boolean(quiz.scoring), isQuestionnaire: Boolean(quiz.questionnaire), hasPairAnalysis: Boolean(quiz.analysis), hasDailyValues: Boolean(quiz.dailyValues), hasCommunicationAnalysis: Boolean(quiz.communication), hasMoneyLifeAnalysis: Boolean(quiz.moneyLife), claimed: Boolean(b) };
  }
  claim({ invitationToken, nickname, consent, privateToken }) {
    requireToken(privateToken);
    const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    return this.transaction(() => {
      const round = this.invitation(invitationToken);
      const existing = this.db.prepare("SELECT * FROM participants WHERE round_id = ? AND slot = 'B'").get(round.id);
      if (existing) {
        if (existing.token_hash === digest(privateToken) && existing.nickname === name) return { id: round.id };
        fail('INVITATION_CLAIMED', '這個邀請已有人加入。請使用自己的私人返回連結。', 409);
      }
      if (this.db.prepare('SELECT 1 FROM participants WHERE token_hash = ?').get(digest(privateToken))) fail('REQUEST_CONFLICT', '請使用另一個私人返回憑證。', 409);
      this.db.prepare('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,?,?,?,?)').run(round.id, 'B', digest(privateToken), name, this.stamp());
      return { id: round.id };
    });
  }
  results(id, token) {
    this.authenticate(id, token);
    this.requireOpen(id);
    const participants = this.db.prepare('SELECT slot,nickname,answers,submitted_at FROM participants WHERE round_id = ? ORDER BY slot').all(id);
    if (participants.length !== 2 || !participants.every((person) => person.submitted_at)) fail('RESULTS_LOCKED', '雙方完成後才能查看共同結果。', 423);
    const round = this.db.prepare('SELECT snapshot,created_at FROM rounds WHERE id = ?').get(id);
    const quiz = JSON.parse(round.snapshot);
    const comparison = compareValues(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const valueFeedback = buildValueFeedback(quiz, comparison);
    const communicationAnalysis = analyzeCommunication(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const moneyLifeAnalysis = analyzeMoneyLife(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const pairAnalysis = analyzeDistance(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const conversation = compareConversation(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const dailyComparison = analyzeDailyValues(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    const result = { quiz, ...(moneyLifeAnalysis ? { moneyLifeAnalysis } : {}), ...(communicationAnalysis ? { communicationAnalysis } : {}), ...(dailyComparison ? { dailyComparison } : {}), ...(comparison ? { comparison } : {}), ...(valueFeedback ? { valueFeedback } : {}), ...(conversation ? { conversation } : {}), ...(pairAnalysis ? { pairAnalysis } : {}), createdAt: round.created_at, participants: participants.map((person) => ({ slot: person.slot, nickname: person.nickname, answers: JSON.parse(person.answers), submittedAt: person.submitted_at })) };
    return { ...result, resultOpening: buildResultOpening(result) };
  }
}
