import { useId } from 'react';
import type { QuizDefinition } from '../domain/quiz';

export function Motif({ kind, hero = false }: { kind: QuizDefinition['motif']; hero?: boolean }) {
  const id = useId();
  return (
    <svg className={`motif ${hero ? 'motif-hero' : ''}`} viewBox="0 0 320 220" fill="none" aria-hidden="true">
      <defs><pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.65" fill="currentColor" opacity=".14" /></pattern></defs>
      <ellipse cx="160" cy="197" rx="105" ry="8" fill="currentColor" opacity=".06" />
      {kind === 'arches' && <>
        <path d="M82 188V102a58 58 0 0 1 116 0v86Z" fill="var(--art-main)" />
        <path d="M126 188v-62a49 49 0 0 1 98 0v62Z" fill="var(--art-second)" />
        <path d="M108 188v-84a32 32 0 0 1 64 0v84" stroke="var(--art-light)" strokeWidth="2" />
        <path d="M151 188v-60a24 24 0 0 1 48 0v60" stroke="var(--art-light)" strokeWidth="2" />
        <path d="M82 188V102a58 58 0 0 1 116 0v86Z" fill={`url(#${id})`} />
        <circle cx="239" cy="48" r="17" fill="var(--art-sun)" />
        <path d="M61 177c-16-18-16-39-6-50 10 17 13 32 6 50Z" fill="var(--art-main)" opacity=".7" />
        <path d="m61 188-5-34" stroke="currentColor" opacity=".3" />
      </>}
      {kind === 'distance' && <>
        <path d="M67 186v-61a35 35 0 0 1 70 0v61Z" fill="var(--art-main)" />
        <path d="M187 186V93a35 35 0 0 1 70 0v93Z" fill="var(--art-second)" />
        <path d="M109 82c38-58 81-55 113-41" stroke="currentColor" strokeDasharray="4 7" opacity=".45" />
        <circle cx="107" cy="79" r="6" fill="var(--art-sun)" /><circle cx="221" cy="40" r="6" fill="var(--art-sun)" />
        <path d="M101 186v-56m122 56V98" stroke="var(--art-light)" strokeWidth="2" />
      </>}
      {kind === 'conversation' && <>
        <path d="M66 63h99a28 28 0 0 1 28 28v25a28 28 0 0 1-28 28H97l-30 23v-26a28 28 0 0 1-29-25V91a28 28 0 0 1 28-28Z" fill="var(--art-main)" />
        <path d="M173 97h65a27 27 0 0 1 27 27v30a27 27 0 0 1-27 27v17l-26-17h-39a27 27 0 0 1-27-27v-30a27 27 0 0 1 27-27Z" fill="var(--art-second)" />
        <path d="M70 91h84m-84 19h60m103 23h-58m58 19h-39" stroke="var(--art-light)" strokeWidth="3" strokeLinecap="round" />
      </>}
      {kind === 'balance' && <>
        <path d="M158 69v116m-62 2h124M82 89h154" stroke="var(--art-main)" strokeWidth="9" strokeLinecap="round" />
        <path d="m84 93-34 58h68L84 93Zm151 0-34 58h68l-34-58Z" stroke="var(--art-second)" strokeWidth="2" />
        <path d="M49 152a35 35 0 0 0 70 0H49Zm151 0a35 35 0 0 0 70 0h-70Z" fill="var(--art-second)" />
        <circle cx="158" cy="53" r="19" fill="var(--art-sun)" />
      </>}
      {kind === 'space' && <>
        <circle cx="125" cy="118" r="67" fill="var(--art-main)" />
        <circle cx="200" cy="118" r="67" fill="var(--art-second)" opacity=".78" />
        <path d="M167 66a67 67 0 0 1 0 104 67 67 0 0 1 0-104Z" fill="var(--art-light)" opacity=".65" />
        <circle cx="253" cy="41" r="12" fill="var(--art-sun)" />
      </>}
    </svg>
  );
}
