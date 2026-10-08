export interface App {
  id: 'waripon' | 'kondate' | 'capysteps';
  name: string;
  tagline: string;
  description: string;
  url: string;
  icon: string;
  /** What or who the app is for, shown as a badge. */
  audience: string;
  /** Detail page on this site, when there is one. */
  page?: string;
}

/** Order matters: the first two are the current focus. */
export const apps: App[] = [
  {
    id: 'waripon',
    name: 'わりぽん',
    tagline: '家族の生活費を、月ごとに折半。',
    description:
      '生活費を書き留めていくと、月末に「どちらがいくら渡せば折半になるか」を計算します。家賃のような定期項目は毎月自動で載り、給付金のような受け取りにも対応しています。',
    url: 'https://waripon.afterai.dev',
    icon: '/img/apps/waripon.png',
    audience: '家計を折半',
    page: '/apps/waripon/',
  },
  {
    id: 'kondate',
    name: 'kondate',
    tagline: '毎日の夕飯を、献立から買い物までいっぺんに。',
    description:
      '家族の夕飯のための献立アプリです。AI が一週間の献立を提案し、レシピ、前もってできる下拵え、買い物リストまで用意します。離乳食・幼児食の子どもがいれば、大人用と子ども用に取り分けで分岐する手順をフローチャートで表示します。',
    url: 'https://kondate.afterai.dev',
    icon: '/img/apps/kondate.png',
    audience: '毎日の夕飯づくり',
    page: '/apps/kondate/',
  },
  {
    id: 'capysteps',
    name: 'CapySteps',
    tagline: '1 日 5 分、カピバラと学ぶ。',
    description:
      '気になるテーマを入れると AI がレッスンを生成し、クイズで理解度を確かめるマイクロラーニングアプリです。毎日 5 分のレッスンを積み重ねます。',
    url: 'https://capysteps.afterai.dev',
    icon: '/img/apps/capysteps.png',
    audience: '学びを習慣にしたい人',
    page: '/apps/capysteps/',
  },
];
