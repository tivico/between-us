import { normalizeApiBase } from './deployment-config';

// 這些設定會進入公開前端；只能放網址，不能放金鑰。
export const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
export const hostedApi = apiBase.startsWith('https://');
export const storageNote = hostedApi ? '答案會保存在網站的雲端服務' : '答案會保存在此電腦的本機服務';
export const invitationNote = hostedApi ? '可將邀請連結分享給另一個人，讓對方在自己的裝置填答。' : '目前連結供同一電腦的不同瀏覽器測試。網站與後端上線後，才能邀請遠方的人。';
