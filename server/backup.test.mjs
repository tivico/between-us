import { expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { RoundStore } from './store.mjs';
import { createEncryptedBackup, restoreEncryptedBackup } from './backup.mjs';

it('一致性加密備份可還原原答案，最新退出／連結撤銷與清理狀態不復活',async()=>{
  const root=resolve('.local');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'backup-drill-'));
  const current=join(directory,'current.sqlite'), archive=join(directory,'data.bubak'), restored=join(directory,'review.sqlite');
  const key=randomBytes(32).toString('base64'), a=randomBytes(32).toString('hex'), b=randomBytes(32).toString('hex');
  let store=new RoundStore(current);
  try {
    const {id}=store.create({quizId:'core-values-example',nickname:'明示備份QA A',consent:true,privateToken:a});
    const quiz=store.status(id,a).quiz, answers=Object.fromEntries(quiz.questions.map((q)=>[q.id,q.options[0].id]));
    store.save(id,a,{answers,revision:0});const {invitationToken}=store.submit(id,a);
    store.claim({invitationToken,privateToken:b,nickname:'明示備份QA B',consent:true});store.save(id,b,{answers,revision:0});store.submit(id,b);
    await createEncryptedBackup(current,archive,key);
    const encrypted=await readFile(archive,'utf8');expect(encrypted).not.toContain('明示備份QA');expect(encrypted).not.toContain('autonomy');expect(encrypted).not.toContain(a);
    await expect(createEncryptedBackup(current,archive,key)).rejects.toMatchObject({code:'EEXIST'});
    const next=randomBytes(32).toString('hex');store.rotate(id,b,{privateToken:next});store.withdraw(id,a,{confirm:'withdraw'});store.close();store=null;
    await expect(restoreEncryptedBackup(archive,restored,key,{})).rejects.toThrow('CURRENT_OFFLINE_STATE_REQUIRED');
    await expect(restoreEncryptedBackup(archive,restored,randomBytes(32).toString('base64'),{currentStatePath:current,confirmOffline:true})).rejects.toThrow('BACKUP_DECRYPT_FAILED');
    expect(await restoreEncryptedBackup(archive,restored,key,{currentStatePath:current,confirmOffline:true})).toMatchObject({quarantined:true,schema:2});
    const review=new RoundStore(restored);
    try {
      expect(review.status(id,next).state).toBe('closed');expect(review.status(id,next).own.answers).toEqual(answers);
      expect(()=>review.status(id,b)).toThrow();expect(()=>review.status(id,a)).toThrow();expect(()=>review.results(id,next)).toThrow();expect(()=>review.invitationPreview(invitationToken)).toThrow();
      expect(review.db.prepare("SELECT answers FROM participants WHERE round_id=? AND slot='A'").get(id).answers).toBe('{}');
    } finally {review.close();}
    await expect(restoreEncryptedBackup(archive,current,key,{currentStatePath:current,confirmOffline:true})).rejects.toThrow('BACKUP_PATH_CONFLICT');
  } finally {
    store?.close();const child=relative(root,resolve(directory));if(child.startsWith('..')||isAbsolute(child))throw new Error('Unsafe QA cleanup');await rm(directory,{recursive:true});
  }
});

it('被竄改的備份不還原；拒絕公開／已存在輸出，最新已移除回合不復活',async()=>{
  const root=resolve('.local');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'backup-drill-'));
  const current=join(directory,'current.sqlite'), archive=join(directory,'data.bubak'), output=join(directory,'review.sqlite'), altered=join(directory,'tampered.bubak');
  const key=randomBytes(32).toString('base64'), token=randomBytes(32).toString('hex');
  const store=new RoundStore(current);
  try {
    const {id}=store.create({quizId:'core-values-example',nickname:'明示移除QA',consent:true,privateToken:token});
    const expired=store.create({quizId:'core-values-example',nickname:'明示到期QA',consent:true,privateToken:randomBytes(32).toString('hex')});
    await createEncryptedBackup(current,archive,key);
    await expect(createEncryptedBackup(current,resolve('public','bad.bubak'),key)).rejects.toThrow('UNSAFE_BACKUP_DESTINATION');
    const data=JSON.parse(await readFile(archive,'utf8'));const bytes=Buffer.from(data.ciphertext,'base64');bytes[0]^=1;data.ciphertext=bytes.toString('base64');await writeFile(altered,JSON.stringify(data));
    await expect(restoreEncryptedBackup(altered,output,key,{currentStatePath:current,confirmOffline:true})).rejects.toThrow('BACKUP_DECRYPT_FAILED');
    store.transaction(()=>{store.db.prepare('DELETE FROM participants WHERE round_id=?').run(id);store.db.prepare('DELETE FROM rounds WHERE id=?').run(id);});
    store.db.prepare('UPDATE rounds SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',expired.id);
    await restoreEncryptedBackup(archive,output,key,{currentStatePath:current,confirmOffline:true});
    const restored=new RoundStore(output);try{expect(restored.db.prepare('SELECT count(*) AS n FROM rounds').get().n).toBe(0);}finally{restored.close();}
    await expect(restoreEncryptedBackup(archive,output,key,{currentStatePath:current,confirmOffline:true})).rejects.toMatchObject({code:'EEXIST'});
  } finally {store.close();const child=relative(root,resolve(directory));if(child.startsWith('..')||isAbsolute(child))throw new Error('Unsafe QA cleanup');await rm(directory,{recursive:true});}
});
