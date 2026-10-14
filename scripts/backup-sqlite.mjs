import { createEncryptedBackup, restoreEncryptedBackup } from '../server/backup.mjs';
const args = process.argv.slice(2);
const value = (name) => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
const source = value('--source'), output = value('--output');
try {
  if (!source || !output || !['backup', 'restore'].includes(args[0])) throw new Error('INVALID_BACKUP_ARGUMENTS');
  if (args[0] === 'backup') await createEncryptedBackup(source, output, process.env.BACKUP_PASSPHRASE);
  else await restoreEncryptedBackup(source, output, process.env.BACKUP_PASSPHRASE, { currentStatePath: value('--current-state'), confirmOffline: args.includes('--confirm-offline') });
  console.log(args[0] === 'backup' ? 'ENCRYPTED_BACKUP_OK' : 'RESTORE_QUARANTINE_OK: 尚未啟動API或替換原資料庫。');
} catch (error) {
  // 不輸出SQL錯誤、檔案內容、環境變數或密語。
  const codes = new Set(['INVALID_BACKUP_ARGUMENTS','INVALID_BACKUP_KEY','BACKUP_PATH_CONFLICT','CURRENT_OFFLINE_STATE_REQUIRED','UNSUPPORTED_BACKUP_SCHEMA','BACKUP_INTEGRITY_FAILED','BACKUP_DECRYPT_FAILED','RESTORE_SNAPSHOT_CONFLICT','UNSAFE_BACKUP_DESTINATION','INVALID_BACKUP_EXTENSION','DESTINATION_SIDECAR_EXISTS']);
  console.error(`BACKUP_OPERATION_FAILED code=${codes.has(error.message) ? error.message : error.code === 'EEXIST' ? 'DESTINATION_EXISTS' : 'OPERATION_FAILED'}`); process.exitCode = 1;
}
