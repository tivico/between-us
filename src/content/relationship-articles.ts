import type { QuizDefinition } from '../domain/quiz';

export type ArticleSection = {
  id: string;
  heading: string;
  kind: 'context' | 'research' | 'application' | 'limits';
  paragraphs: string[];
  sourceIds?: string[];
};
export type RelationshipArticle = {
  id: string;
  version: string;
  title: string;
  subtitle: string;
  category: string;
  readMinutes: number;
  updated: string;
  theme: QuizDefinition['theme'];
  motif: QuizDefinition['motif'];
  takeaway: string;
  sections: ArticleSection[];
  conversation: string[];
  sources: { id: string; title: string; authors: string; year: number; url: string; readUrl: string; method: string; scope: string }[];
};

export const relationshipArticles: RelationshipArticle[] = [
  {
    id: 'values-and-understanding', version: '1.0.0',
    title: '價值觀測驗，能告訴我們什麼？',
    subtitle: '從「我們像不像」，走向「你為什麼在意」。',
    category: '核心價值', readMinutes: 4, updated: '2026-10-08', theme: 'sage', motif: 'arches',
    takeaway: '把測驗當成認識優先順序的入口，再用生活經驗補上答案背後的理由。',
    sections: [
      { id: 'everyday', heading: '同一個選擇，可能有不同的理由', kind: 'context', paragraphs: [
        '假設你們都希望週末待在家裡。一個人想省錢，另一個人想休息；選擇相同，背後在意的事情卻不同。反過來，一個人想出去走走，另一個人想一起煮飯，也可能都希望好好陪伴彼此。這些是生活例子，提醒我們：選項提供線索，還需要本人說明理由。',
        '因此，閱讀彼此答案時，可以先留下一點好奇。比起急著把對方歸成某種人，更值得問的是：你當時想到什麼情境？這件事對你有什麼意義？',
      ] },
      { id: 'instrument', heading: '研究裡的核心價值，是怎麼被測量的？', kind: 'research', sourceIds: ['pvqrr'], paragraphs: [
        '本站核心價值探索依 PVQ-RR 改寫。原工具用 57 段人物描述，測量 19 個價值方向，每個方向有三題。作答者判斷描述中的人物有多像自己，讓研究者從回答理解個人的價值取向。',
        'Schwartz 與 Cieciuch 的研究分析 49 個文化群體、32 種語言的資料，檢查這個工具的測量表現。研究提供了核心價值測量的證據；它並沒有驗證本站的中文中性措辭，也沒有建立我們的雙人相近度或關係成功率。',
      ] },
      { id: 'reading', heading: '在本站，怎麼把結果讀回生活？', kind: 'application', paragraphs: [
        '結果中的「相對重視程度」，是每個價值方向的平均回答，減去你全部回答的平均。它以你自己的整體回答為基準：正值表示相對較高，負值表示相對較低。負值並不表示你討厭這個價值，也不是道德評分。',
        '雙人的 0–100 相近度，是本站依 19 個相對分數的差距設計的摘要。它幫你們找到可討論的方向，沒有經驗證的高低門檻。即使相近度很高，仍值得回到逐題答案：同樣重視安全的人，也可能對什麼叫安全有不同想像。',
        '可以各選一個自己在意的方向，帶入最近一次真實選擇：當時有哪些選項？你保住了什麼，又放下了什麼？這是本站的聊天提案，並不是另一套心理量表。',
      ] },
      { id: 'boundaries', heading: '一份結果，還不能替你們回答哪些事？', kind: 'limits', paragraphs: [
        '核心價值探索沒有涵蓋你們全部的人生安排、相處經驗或具體承諾。本站也沒有把相近度換算成適不適合交往、是否該分手或未來成功的機率。要了解對方對某件事的期待，仍需要把那件事拿出來談。',
        '目前繁體中性改寫與本站雙人指標尚未完成測量驗證；第 49 題的原繁體譯法仍待核對。所有性向與性別認同都能使用網站，但這項使用規則不代表已證明各族群的測量表現相同。',
      ] },
    ],
    conversation: ['哪個答案最能代表你最近的一次選擇？', '我們選得一樣的地方，理由也一樣嗎？', '如果兩件重要的事撞在一起，你會怎麼取捨？'],
    sources: [{ id: 'pvqrr', title: 'Measuring the Refined Theory of Individual Values in 49 Cultural Groups: Psychometrics of the Revised Portrait Value Questionnaire', authors: 'Shalom H. Schwartz & Jan Cieciuch', year: 2022, url: 'https://doi.org/10.1177/1073191121998760', readUrl: 'https://journals.sagepub.com/doi/full/10.1177/1073191121998760', method: '跨文化測量研究；53,472 位參與者，49 個文化群體、32 種語言。', scope: '本文依據原研究的工具介紹與測量證據。本站的結果閱讀例子、雙人換算與聊天提示另外標示，不視為原研究驗證的介入方法。' }],
  },
  {
    id: 'feeling-understood', version: '1.0.0',
    title: '有回覆，為什麼還是覺得沒被理解？',
    subtitle: '親近的感受，也和你如何接住對方的分享有關。',
    category: '回應與理解', readMinutes: 4, updated: '2026-10-08', theme: 'clay', motif: 'conversation',
    takeaway: '先問對方希望收到什麼回應，再確認自己的理解。',
    sections: [
      { id: 'moment', heading: '一句「我今天好累」，可能在邀請什麼？', kind: 'context', paragraphs: [
        '對方說今天很累，你立刻幫忙想解法，卻發現對方更失落。也可能你想安慰，對方其實希望一起把問題拆開。這是本站舉的日常情境：同一句分享，可能需要不同的回應，單靠猜測很容易錯過彼此的意思。',
        '可以先把「我已經回覆了」和「對方感覺被理解了」分開看。這不是要求每次都答得完美，而是留一個確認的機會，讓對方告訴你目前最需要什麼。',
      ] },
      { id: 'process', heading: '研究把親密看成一段互動過程', kind: 'research', sourceIds: ['intimacy'], paragraphs: [
        'Laurenceau、Barrett 與 Pietromonaco 在兩項日記研究中，請大學生在日常互動後記錄分享、對方的分享、感受到的回應，以及親近程度。結果支持：分享自己與感受到對方回應，都與互動中的親密感有關。第二項研究中，情感的分享比事實資訊的分享更能預測當次親密感。',
        '這裡的「感受到的回應」，關注分享者是否覺得自己被理解、被接納、被關心。它不是單純計算回覆次數，也不等於對方必須贊同每一個判斷。這是對互動經驗的研究概念，不能直接從一次回覆診斷一段關係。',
      ] },
      { id: 'practice', heading: '把「接住」變成可以確認的事情', kind: 'application', paragraphs: [
        '下面是本站依概念設計的聊天提案。聽到一段分享時，可以先問：「你現在比較想要我聽你說，還是一起想辦法？」如果對方也不確定，可以先聽一小段，再確認。',
        '接著，用自己的話說出理解：「你最累的地方，好像是一直被打斷，對嗎？」把它說成可以修正的猜測，比替對方下結論更能保留對話空間。對方若說不是，就讓對方補充。',
        '你也可以說明當下的能力：「我想好好聽，但現在還在通勤；我們晚點聊，可以嗎？」約定一個雙方可行的時間，並問這樣的安排是否合適。這些句型沒有在原研究中被測試，不保證一定改善關係。',
      ] },
      { id: 'scope', heading: '理解一個人，不需要把自己拿掉', kind: 'limits', paragraphs: [
        '聊天提案可以配合你們的習慣調整，也可以拒絕此刻不想談的內容。接納對方的感受，不必等於接受所有要求；你自己的時間、感受與界線，也需要被說出來。這是本站對使用方式的建議。',
        '原研究分析的是大學生的日常雙人互動，並不限於戀愛伴侶。日記資料呈現關聯，不能把它當成已證明某一句話會造成關係改善，也不能直接推定所有文化、性向與性別認同的伴侶都會有相同效果。',
      ] },
    ],
    conversation: ['當你心情不好時，你比較想被聽見，還是一起找方法？', '我做過什麼，曾讓你覺得我有理解你？', '如果我當下沒辦法聊，你希望我怎麼告訴你？'],
    sources: [{ id: 'intimacy', title: 'Intimacy as an Interpersonal Process: The Importance of Self-Disclosure, Partner Disclosure, and Perceived Partner Responsiveness in Interpersonal Exchanges', authors: 'Jean-Philippe Laurenceau, Lisa Feldman Barrett & Paula R. Pietromonaco', year: 1998, url: 'https://doi.org/10.1037/0022-3514.74.5.1238', readUrl: 'https://affective-science.org/pubs/1998/LaurenFBPl1998.pdf', method: '兩項互動日記研究；分析樣本分別為 69 與 89 名美國大學生，記錄一週與兩週的日常互動。', scope: '查閱摘要、互動模型與方法段落；支持分享、感受到的回應與親密感的關聯。本文的對話句型是本站提案，並未經該研究驗證。' }],
  },
  {
    id: 'distance-and-everyday-life', version: '1.0.0',
    title: '遠距離，怎麼分享彼此看不見的日常？',
    subtitle: '讓對方認識你的生活，也留意想像還缺了哪些細節。',
    category: '遠距相處', readMinutes: 4, updated: '2026-10-08', theme: 'blue', motif: 'distance',
    takeaway: '把日常情境、自己的感受與可行的聯絡安排，一起帶進對話。',
    sections: [
      { id: 'missing-context', heading: '有聊天，仍可能少了一些生活背景', kind: 'context', paragraphs: [
        '見不到面的日子裡，對方可能知道你今天加班，卻不知道你回家後還要處理什麼；知道你去見朋友，卻沒看過你在朋友面前的樣子。這些是本站舉的情境，說明「知道一件事發生了」與「理解它在生活裡的樣子」可以有距離。',
        '你們可以一起挑選願意分享的細節。目的在於讓對方更容易理解你的生活，分享多少由本人決定，不必把了解彼此變成隨時回報行蹤。',
      ] },
      { id: 'diary', heading: '研究看見了分享與理想化的作用', kind: 'research', sourceIds: ['distance'], paragraphs: [
        'Jiang 與 Hancock 的一週日記研究，分析 63 對約會伴侶，其中 30 對為遠距。研究探討遠距者如何透過不同溝通媒介調整自我揭露，以及較理想化的關係知覺如何與親密感有關。',
        '這項研究讓我們看見：地理距離與親密感之間，還有分享方式、關係知覺和媒介特性等因素。它沒有建立適用所有人的最佳聯絡次數，也不能用來保證遠距一定比較親密。',
      ] },
      { id: 'sharing', heading: '可以從一個小場景開始', kind: 'application', paragraphs: [
        '以下是本站的聊天提案。試著選一件普通的小事：今天哪個時刻讓你鬆了一口氣？除了事件，也說說你當時的感受，或補上一個對方不知道的背景。想不到時不必勉強，也可以換成一起做一件簡單的事。',
        '對方分享後，可以問：「如果我在現場，還會看到什麼？」這個問題用來邀請補充，不是要求照片、定位或證明。對於自己腦中已經形成的想像，也可以溫和確認：「我以為你最近很喜歡這個安排，實際上是這樣嗎？」',
        '再把期待與現實放在同一段對話裡：你想多久聯絡？哪些時段真的有空？文字、語音或視訊，哪種比較適合這次要聊的事？可以試一個雙方同意的安排，再一起回顧。這是可調整的生活提案，不是經研究驗證的遠距處方。',
      ] },
      { id: 'limits', heading: '保留對人的了解，也保留研究的邊界', kind: 'limits', paragraphs: [
        '原研究主要是美國大學生中的異性約會伴侶，且屬於觀察性的日記研究。它的結果不能直接代表台灣、所有年齡或所有性向與性別認同的伴侶，也無法證明特定媒介本身造成親密感。',
        '本站不從訊息速度判定在不在乎，也不把視訊或見面頻率當成合格門檻。你們可以把未被談過的期待說清楚，再由雙方決定可接受的安排。遠距測驗目前仍在籌備；閱讀本文不需要先完成任何測驗。',
      ] },
    ],
    conversation: ['你生活裡有哪些小事，是我還不太知道的？', '我們對彼此的哪個想像，值得重新確認？', '這週有哪些時間與聯絡方式，是我們都舒服的？'],
    sources: [{ id: 'distance', title: 'Absence Makes the Communication Grow Fonder: Geographic Separation, Interpersonal Media, and Intimacy in Dating Relationships', authors: 'L. Crystal Jiang & Jeffrey T. Hancock', year: 2013, url: 'https://doi.org/10.1111/jcom.12029', readUrl: 'https://socialmedialab.sites.stanford.edu/sites/g/files/sbiybj22976/files/media/file/jiang-jc-absence.pdf', method: '一週伴侶互動日記；分析 63 對異性約會伴侶，其中 30 對遠距，主要為美國大學生。', scope: '查閱摘要與方法段落；介紹自我揭露、理想化關係知覺與媒介差異的研究方向。本文的日常分享問題與聯絡安排是本站提案。' }],
  },
];

export function getRelationshipArticle(id: string) {
  return relationshipArticles.find((article) => article.id === id);
}
