import { createHash, createHmac, randomUUID } from 'node:crypto';
import { roundQuizzes } from '../src/content/quizzes.ts';
import { compareValues } from '../src/domain/compatibility.ts';

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
    const own = await this.one('SELECT * FROM participants WHERE round_id = ? AND token_hash = ?', id, digest(token));
    if (!own) fail('UNAUTHORIZED', '這個私人連結無法開啟此回合。', 401);
    return own;
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
        this.statement('INSERT INTO rounds(id,quiz_id,snapshot,created_at) VALUES(?,?,?,?)', id, quiz.id, JSON.stringify(quiz), stamp),
        this.statement('INSERT INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,?,?,?,?)', id, 'A', hash, name, stamp),
      ]);
    } catch (error) {
      const retry = await existingResult(); if (retry) return retry; throw error;
    }
    return { id };
  }
  async status(id, token) {
    const own = await this.authenticate(id, token);
    const round = await this.one('SELECT * FROM rounds WHERE id=?', id);
    const peer = await this.one('SELECT nickname,submitted_at FROM participants WHERE round_id=? AND slot!=?', id, own.slot);
    return {
      id, quiz: JSON.parse(round.snapshot), createdAt: round.created_at,
      state: own.submitted_at && peer?.submitted_at ? 'unlocked' : own.submitted_at ? 'waiting' : 'answering',
      own: { nickname: own.nickname, slot: own.slot, answers: JSON.parse(own.answers), revision: own.revision, submittedAt: own.submitted_at },
      peer: peer ? { nickname: peer.nickname, submitted: Boolean(peer.submitted_at) } : null,
      invitationToken: own.slot === 'A' && own.submitted_at ? invitationFor(token, id) : null,
    };
  }
  async save(id, token, { answers, revision }) {
    const own = await this.authenticate(id, token);
    if (own.submitted_at) fail('ROUND_LOCKED', '本輪已提交，答案已鎖定。', 409);
    const quiz = JSON.parse((await this.one('SELECT snapshot FROM rounds WHERE id=?', id)).snapshot);
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || !Number.isInteger(revision) || revision < 0) fail('INVALID_ANSWERS', '答案格式不正確。');
    for (const key of Object.keys(answers)) {
      const q = quiz.questions.find((item) => item.id === key);
      if (!q || !q.options.some((item) => item.id === answers[key])) fail('INVALID_ANSWERS', '答案包含不屬於本輪的題目或選項。');
    }
    const encoded = JSON.stringify(Object.fromEntries(quiz.questions.filter((q) => Object.hasOwn(answers, q.id)).map((q) => [q.id, answers[q.id]])));
    const result = await this.statement('UPDATE participants SET answers=?,revision=revision+1 WHERE round_id=? AND slot=? AND revision=? AND submitted_at IS NULL', encoded, id, own.slot, revision).run();
    if (result.meta.changes === 1) return { revision: revision + 1 };
    const fresh = await this.authenticate(id, token);
    if (fresh.submitted_at) fail('ROUND_LOCKED', '本輪已提交，答案已鎖定。', 409);
    if (fresh.answers === encoded) return { revision: fresh.revision };
    fail('STALE_REVISION', '另一個分頁已更新答案，請重新載入最新紀錄。', 409);
  }
  async submit(id, token) {
    const own = await this.authenticate(id, token);
    if (own.submitted_at) return this.status(id, token);
    const quiz = JSON.parse((await this.one('SELECT snapshot FROM rounds WHERE id=?', id)).snapshot);
    const answers = JSON.parse(own.answers);
    if (!quiz.questions.every((q) => q.options.some((o) => o.id === answers[q.id]))) fail('INCOMPLETE', '請完成本輪所有題目再提交。');
    const statements = [this.statement('UPDATE participants SET submitted_at=? WHERE round_id=? AND slot=? AND revision=? AND submitted_at IS NULL', this.stamp(), id, own.slot, own.revision)];
    if (own.slot === 'A') statements.push(this.statement("UPDATE rounds SET invite_hash=? WHERE id=? AND EXISTS(SELECT 1 FROM participants WHERE round_id=? AND slot='A' AND submitted_at IS NOT NULL)", digest(invitationFor(token, id)), id, id));
    await this.db.batch(statements);
    const status = await this.status(id, token);
    if (!status.own.submittedAt) fail('STALE_REVISION', '另一個分頁已更新答案，請重新載入最新紀錄。', 409);
    return status;
  }
  async invitation(token) {
    requireToken(token);
    const round = await this.one('SELECT * FROM rounds WHERE invite_hash=?', digest(token));
    if (!round) fail('INVITATION_INVALID', '邀請連結不完整或不存在。', 404);
    return round;
  }
  async invitationPreview(token) {
    const round = await this.invitation(token);
    const a = await this.one("SELECT nickname FROM participants WHERE round_id=? AND slot='A'", round.id);
    const b = await this.one("SELECT 1 FROM participants WHERE round_id=? AND slot='B'", round.id);
    const quiz = JSON.parse(round.snapshot);
    return { id: round.id, hostName: a.nickname, title: quiz.title, questionCount: quiz.questions.length, hasValueScore: Boolean(quiz.scoring), claimed: Boolean(b) };
  }
  async claim({ invitationToken, nickname, consent, privateToken }) {
    requireToken(privateToken); const name = nicknameFor(nickname);
    if (consent !== true) fail('CONSENT_REQUIRED', '請先同意雙方完成後分享本輪答案。');
    const round = await this.invitation(invitationToken); const hash = digest(privateToken);
    // INSERT OR IGNORE 同時由 slot 主鍵與 token 唯一鍵阻擋競爭；再檢查誰取得邀請。
    await this.statement("INSERT OR IGNORE INTO participants(round_id,slot,token_hash,nickname,consent_at) VALUES(?,'B',?,?,?)", round.id, hash, name, this.stamp()).run();
    const existing = await this.one("SELECT * FROM participants WHERE round_id=? AND slot='B'", round.id);
    if (existing?.token_hash === hash && existing.nickname === name) return { id: round.id };
    if (existing) fail('INVITATION_CLAIMED', '這個邀請已有人加入。請使用自己的私人返回連結。', 409);
    fail('REQUEST_CONFLICT', '請使用另一個私人返回憑證。', 409);
  }
  async results(id, token) {
    await this.authenticate(id, token);
    const { results: participants } = await this.statement('SELECT slot,nickname,answers,submitted_at FROM participants WHERE round_id=? ORDER BY slot', id).all();
    if (participants.length !== 2 || !participants.every((p) => p.submitted_at)) fail('RESULTS_LOCKED', '雙方完成後才能查看共同結果。', 423);
    const round = await this.one('SELECT snapshot,created_at FROM rounds WHERE id=?', id);
    const quiz = JSON.parse(round.snapshot);
    const comparison = compareValues(quiz, JSON.parse(participants[0].answers), JSON.parse(participants[1].answers));
    return { quiz, ...(comparison ? { comparison } : {}), createdAt: round.created_at, participants: participants.map((p) => ({ slot: p.slot, nickname: p.nickname, answers: JSON.parse(p.answers), submittedAt: p.submitted_at })) };
  }
}
