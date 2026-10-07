export interface App {
  id: 'waripon' | 'kondate' | 'capysteps';
  name: string;
  tagline: string;
  description: string;
  url: string;
  icon: string;
  /** Who the app is for, shown as a badge. */
  audience: string;
}

/** Order matters: the first two are the current focus. */
export const apps: App[] = [
  {
    id: 'waripon',
    name: 'わりぽん',
    tagline: 'ふたりの家計を、月ごとに割り勘。',
    description:
      '夫婦・カップルのための割り勘アプリです。それぞれが払った生活費を書き留めていくと、月末に「どちらがいくら渡せば折半になるか」を計算します。金額を入れるのが面倒な自動引き落としは、項目だけ残しておけます。',
    url: 'https://waripon.afterai.dev',
    icon: '/img/apps/waripon.png',
    audience: 'ふたり暮らし',
  },
  {
    id: 'kondate',
    name: 'kondate',
    tagline: '大人と子どもの夕飯を、取り分けでいっぺんに。',
    description:
      '離乳食・幼児食の子どもがいる家庭のための献立アプリです。AI が一週間の献立を提案し、大人用と子ども用に分岐する手順をフローチャートで表示します。前もってできる下拵えと、当日にやることを分けて示します。',
    url: 'https://kondate.afterai.dev',
    icon: '/img/apps/kondate.png',
    audience: '小さな子どものいる家庭',
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
  },
];
