/** 正文流中的插图（图文混排）。仅对按段落排版的页面生效：散文页、扉页、章节页 */
export interface PageFigure {
  url: string;
  /** 插在第几段之前：0 = 第一段前；缺省或超出段数 = 全部正文之后 */
  beforeParagraph?: number;
  /** 图片高度（页面画布像素，页宽 1440），默认 480；宽度始终撑满版心 */
  height?: number;
  /** cover 铺满裁切（默认），contain 完整显示并留白 */
  fit?: 'cover' | 'contain';
  /** 图注，居中显示在图片下方 */
  caption?: string;
}

export interface PageContent {
  type: 'cover' | 'frontispiece' | 'toc' | 'chapter' | 'spread' | 'poetry' | 'colophon';
  sideIndex: number;
  title: string;
  subtitle?: string;
  author?: string;
  chapterNumber?: string;
  headerText?: string;
  dropCap?: string;
  paragraphs?: string[];
  poetryLines?: string[];
  notes?: string[];
  tocItems?: { title: string; author: string; page: string }[];
  colophonDetails?: { key: string; value: string }[];
  sealText?: string;
  themeColor?: string;
  /**
   * 整页图片（对应原版 paper.design/mono 的整页位图）。设置后该页以图片为页面内容，
   * 其余文字字段不再绘制、也不可选中/编辑；图片加载完成前显示纸面底色。
   * 跨域图片需服务端允许 CORS。
   */
  imageUrl?: string;
  /** 图文混排：嵌在正文流中的插图 */
  figures?: PageFigure[];
  /** 图片铺放方式：cover 铺满裁切（默认），contain 完整显示并留白 */
  imageFit?: 'cover' | 'contain';
}

export const CHINESE_PAGES: PageContent[] = [
  // Page 1: 封面
  {
    type: 'cover',
    sideIndex: 1,
    title: '文心雅集',
    subtitle: '名家散文与经典文论排印选粹',
    author: '文心排印学社 · 编',
    sealText: '文心典藏',
    themeColor: '#8E2822',
  },

  // Page 2: 扉页 / 题记
  {
    type: 'frontispiece',
    sideIndex: 2,
    title: '题 记',
    subtitle: '关于汉字排印与纸墨阅读的一册小书',
    author: '开卷引言',
    paragraphs: [
      '“字如其人，书似其心。铅字之落于素笺，犹良木之植于沃土。”',
      '一纸一册之间，文字不单是记录思想之符号，更自具风骨与气韵。自雕版、活字以迄今日数位排印，汉字方块结构中的虚实开合、行气流通，皆凝结着东方美学之沉潜与敬意。',
      '本书遴选苏轼、朱自清、林徽因等名家经典名篇，依照当代出版物严谨之网格版心排法，敬奉给每一位热爱纸上清风与笔墨余香之读者。',
    ],
    sealText: '雅趣',
  },

  // Page 3: 目录（壹）
  {
    type: 'toc',
    sideIndex: 3,
    title: '目 次',
    subtitle: 'TABLE OF CONTENTS · 卷上',
    headerText: '文心雅集 · 卷上',
    tocItems: [
      { title: '卷一 · 前赤壁赋（并笺注）', author: '〔宋〕苏 轼', page: '05' },
      { title: '苏子泛舟与古文笔法论析', author: '选本评注', page: '07' },
      { title: '卷二 · 荷塘月色', author: '朱自清', page: '08' },
      { title: '白话散文之声韵与意境', author: '排印评述', page: '10' },
    ],
  },

  // Page 4: 目录（贰）
  {
    type: 'toc',
    sideIndex: 4,
    title: '目 次',
    subtitle: 'TABLE OF CONTENTS · 卷下',
    headerText: '文心雅集 · 卷下',
    tocItems: [
      { title: '卷三 · 你是人间的四月天', author: '林徽因', page: '11' },
      { title: '新诗排印节律与留白美学', author: '诗学漫谈', page: '13' },
      { title: '卷四 · 汉字排印与书籍设计准则', author: '文心学社', page: '14' },
      { title: '出版物版心、字阶与网格法则', author: '设计指南', page: '15' },
      { title: '出版记录 · 版权与印张', author: '文心出版局', page: '16' },
    ],
  },

  // Page 5: 卷一 题扉
  {
    type: 'chapter',
    sideIndex: 5,
    chapterNumber: '卷 一',
    title: '前赤壁赋',
    subtitle: '宋 · 元丰五年壬戌之秋',
    author: '〔宋〕苏 轼',
    paragraphs: [
      '苏轼贬谪黄州期间所作之名赋。融叙事、写景、抒情、议论于一炉，借江上清风与山间明月，参悟天地消长变与不变之深理。文辞汪洋恣肆，音韵如歌。',
    ],
    sealText: '东坡居士',
  },

  // Page 6: 赤壁赋（正文一）
  {
    type: 'spread',
    sideIndex: 6,
    headerText: '文心雅集 · 卷一 前赤壁赋',
    title: '赤壁怀古 · 泛舟游于赤壁之下',
    dropCap: '壬',
    paragraphs: [
      '戌之秋，七月既望，苏子与客泛舟游于赤壁之下。清风徐来，水波不兴。举酒属客，诵明月之诗，歌窈窕之章。少焉，月出于东山之上，徘徊于斗牛之间。白露横江，水光接天。纵一苇之所如，凌万顷之茫然。浩浩乎如冯虚御风，而不知其所止；飘飘乎如遗世独立，羽化而登仙。',
      '于是饮酒乐甚，扣舷而歌之。歌曰：“桂棹兮兰桨，击空明兮溯流光。渺渺兮予怀，望美人兮天一方。”客有吹洞箫者，倚歌而和之。其声呜呜然，如怨如慕，如泣如诉；余音袅袅，不绝如缕。舞幽壑之潜蛟，泣孤舟之嫠妇。',
    ],
    notes: [
      '〔属客〕嘱托劝酒之意。',
      '〔冯虚御风〕凭空乘风而行。冯，同“凭”，乘也。',
    ],
  },

  // Page 7: 赤壁赋（正文二）
  {
    type: 'spread',
    sideIndex: 7,
    headerText: '文心雅集 · 卷一 前赤壁赋',
    title: '问客之叹 · 物与我皆无尽也',
    paragraphs: [
      '苏子愀然，正襟危坐，而问客曰：“何为其然也？”客曰：“‘月明星稀，乌鹊南飞’，此非曹孟德之诗乎？西望夏口，东望武昌，山川相缪，郁乎苍苍，此非孟德之困于周郎者乎？方其破荆州，下江陵，顺流而东也，舳舻千里，旌旗蔽空，酾酒临江，横槊赋诗，固一世之雄也，而今安在哉？况吾与子渔樵于江渚之上，侣鱼虾而友麋鹿，驾一叶之扁舟，举匏樽以相属。寄蜉蝣于天地，渺沧海之一粟。哀吾生之须臾，羡长江之无穷。挟飞仙以遨游，抱明月而长终。知不可乎骤得，托遗响于悲风。”',
      '苏子曰：“客亦知夫水与月乎？逝者如斯，而未尝往也；盈虚者如彼，而卒莫消长也。盖将自其变者而观之，则天地曾不能以一瞬；自其不变者而观之，则物与我皆无尽也，而又何羡乎？且夫天地之间，物各有主，苟非吾之所有，虽一毫而莫取。惟江上之清风，与山间之明月，耳得之而为声，目遇之而成色，取之无禁，用之不竭。是造物者之无尽藏也，而吾与子之所共适。”客喜而笑，洗盏更酌。肴核既尽，杯盘狼籍。相与枕藉乎舟中，不知东方之既白。',
    ],
    notes: [
      '〔造物者之无尽藏〕天地大自然无穷无尽之宝藏。',
    ],
  },

  // Page 8: 卷二 题扉
  {
    type: 'chapter',
    sideIndex: 8,
    chapterNumber: '卷 二',
    title: '荷塘月色',
    subtitle: '现代中国白话抒情散文典范',
    author: '朱 自 清',
    paragraphs: [
      '写于一九二七年七月清华园。全文以细腻委婉之笔触，描摹荷塘在月光掩映下之幽静景致，意境安谧素洁，情与景谐，为现代出版物选本中常读常新之名作。',
    ],
    sealText: '佩弦',
  },

  // Page 9: 荷塘月色（正文一）
  {
    type: 'spread',
    sideIndex: 9,
    headerText: '文心雅集 · 卷二 荷塘月色',
    title: '幽僻小径 · 月光如流水一般',
    dropCap: '这',
    paragraphs: [
      '几天心里颇不宁静。今晚在院子里坐着乘凉，忽然想起日日走过的荷塘，在这满月的光里，总该另有一番样子吧。月亮渐渐地升高了，墙外马路上孩子们的欢笑，已经听不见了；妻在屋里拍着闰儿，迷迷糊糊地哼着眠歌。我悄悄地披了大衫，带上门出去。',
      '沿着荷塘，是一条曲折的小煤屑路。这是一条幽僻的路；白天也少人走，夜晚更加寂寞。荷塘四面，长着许多树，蓊蓊郁郁的。路的一旁，是些杨柳，和一些不知道名字的树。没有月光的晚上，这路上阴森森的，有些怕人。今晚却很好，虽然月光也还是淡淡的。',
      '路上只我一个人，背着手踱着。这一片天地好像是我的；我也像超出了平常的自己，到了另一世界里。我爱热闹，也爱冷静；爱群居，也爱独处。像今晚上，一个人在这苍茫的月下，什么都可以想，什么都可以不想，便觉得是个自由的人。白天里一定要做的事，一定要说的话，现在都可不理。这是独处的妙处，我且受用这无边的荷香月色好了。',
    ],
  },

  // Page 10: 荷塘月色（正文二）
  {
    type: 'spread',
    sideIndex: 10,
    headerText: '文心雅集 · 卷二 荷塘月色',
    title: '荷叶亭亭 · 如梵婀玲上奏着的名曲',
    paragraphs: [
      '曲曲折折的荷塘上面，弥望的是田田的叶子。叶子出水很高，像亭亭的舞女的裙。层层的叶子中间，零星地点缀着些白花，有袅娜地开着的，有羞涩地打着朵儿的；正如一粒粒的明珠，又如碧天里的星星，又如刚出浴的美人。微风过处，送来缕缕清香，仿佛远处高楼上渺茫的歌声似的。这时候叶子与花也有一丝的颤动，像闪电般，霎时传过荷塘的那边去了。叶子本是肩并肩密密地挨着，这便宛然有了一道凝碧的波痕。叶子底下是脉脉的流水，遮住了，不能见一些颜色；而叶子却更见风致了。',
      '月光如流水一般，静静地泻在这一片叶子和花上。薄薄的青雾浮起在荷塘里。叶子和花仿佛在牛乳中洗过一样；又像笼着轻纱的梦。虽然是满月，天上却有一层淡淡的云，所以不能朗照；但我以为这恰是到了好处——酣眠固不可少，小睡也别有风味的。月光是隔了树照过来的，高处丛生的灌木，落下参差的斑驳的黑影，峭楞楞如鬼一般；弯弯的杨柳的稀疏的倩影，却又像是画在荷叶上。塘中的月色并不均匀；但光与影有着和谐的旋律，如梵婀玲上奏着的名曲。',
    ],
  },

  // Page 11: 卷三 题扉
  {
    type: 'chapter',
    sideIndex: 11,
    chapterNumber: '卷 三',
    title: '你是人间的四月天',
    subtitle: '一句爱的赞颂 · 新格律诗典范',
    author: '林 徽 因',
    paragraphs: [
      '写于一九三四年。诗作兼具新格律诗之音乐美、建筑美与绘画美，音韵轻灵婉转，色彩明朗温润，被誉为中国现代文学史上最为明澈纯净的抒情经典。',
    ],
    sealText: '徽因',
  },

  // Page 12: 诗歌选篇
  {
    type: 'poetry',
    sideIndex: 12,
    headerText: '文心雅集 · 卷三 你是人间的四月天',
    title: '你是人间的四月天',
    subtitle: '—— 一句爱的赞颂',
    author: '林徽因',
    poetryLines: [
      '我说 你是人间的四月天；',
      '笑响点亮了四面风；',
      '轻灵在春的光艳中交舞着。',
      '',
      '你是四月早天里的云烟，',
      '黄昏吹着风的软，',
      '星子在无意中闪，细雨点洒在花前。',
      '',
      '那轻，那娉婷，你是，',
      '鲜妍百花的冠冕你戴着，',
      '你是天真，庄严，你是夜夜的月圆。',
      '',
      '雪化后那片鹅黄，你像；',
      '新鲜初放芽的绿，你是；',
      '柔嫩喜悦，水光浮动着你梦期待中白莲。',
      '',
      '你是一树一树的花开，',
      '是燕在梁间呢喃，',
      '—— 你是爱，是暖，是希望，',
      '你是人间的四月天！',
    ],
  },

  // Page 13: 诗韵品评
  {
    type: 'spread',
    sideIndex: 13,
    headerText: '文心雅集 · 卷三 诗韵品评',
    title: '纸面建筑 · 现代格律诗之排版艺术',
    paragraphs: [
      '闻一多先生尝论新诗之美有三：曰音乐之美，曰绘画之美，曰建筑之美。',
      '所谓“建筑之美”，落实于书籍出版，即是诗行在纸面版心上的长短参差、节奏留白与节群分栏。汉字新诗不似古体诗之整齐五言七言，其节拍长短天然依循情感之起伏。故排印现代诗，天头需舒朗，地脚需深远，左右外边距务求宽广，使诗句犹如孤屿浮于澄澈湖心，留予读者目游神想之空灵境界。',
      '林徽因先生本为一代建筑大师，其构词造句间，字与音之承重、虚与实之勾连，皆具营造法式之精微平衡。',
    ],
  },

  // Page 14: 卷四 汉字排印美学
  {
    type: 'chapter',
    sideIndex: 14,
    chapterNumber: '卷 四',
    title: '汉字排印美学',
    subtitle: '现代出版物书籍设计规范与网格法则',
    author: '文 心 学 社',
    paragraphs: [
      '探讨正文宋体之结字风骨、行长字距黄金比例、天头地脚留白法度，以及避头尾标点符号挤压规范。',
    ],
    sealText: '出版之道',
  },

  // Page 15: 书籍排印规范准则
  {
    type: 'spread',
    sideIndex: 15,
    headerText: '文心雅集 · 卷四 汉字排印美学',
    title: '版心法度 · 纸张比例与字阶法则',
    paragraphs: [
      '〔版心与网格〕出版物之优劣，首重版心（Grid Area）。书籍开本之长宽比（如黄金比例 1:1.618 或标准书籍比 1:1.414、1:1.377），决定了阅读视野之安顿。通常天头（上边距）当宽于地脚，外切口边距当宽于订口，令持卷翻阅时双指不掩及正文字行。',
      '〔正文字号与行距〕经典中文图书正文多采用 10.5pt（五号字）或 11pt，行高一般设为字径之 1.75 至 2.0 倍。行距过逼则目力逼仄，过疏则行气涣散。段落首行缩进两全角汉字空间（2 em），行尾宜采避头尾两端对齐（Justified Alignment）。',
      '〔标点挤压与禁则〕逗号、句号、顿号等点号不可出现在行首；前引号、前书名号不可出现在行末。全角标点在连续出现时需进行半角挤压（Punctuation Kerning），方显版面紧致典雅。',
    ],
    notes: [
      '〔字阶准则〕标题一般按倍率递减，章名二号（22pt），节名小三（15pt），正文五号（10.5pt），注释小五号（9pt）。',
    ],
  },

  // Page 16: 封底 / 版权页
  {
    type: 'colophon',
    sideIndex: 16,
    title: '文心雅集',
    subtitle: 'CLASSICAL ESSAYS & TYPOGRAPHY SPECIMEN',
    colophonDetails: [
      { key: '作　　者', value: '苏轼 · 朱自清 · 林徽因 等' },
      { key: '出 版 人', value: '文心雅集编纂处' },
      { key: '正文字体', value: '霞鹜文楷（LXGW WenKai）' },
      { key: '字体设计', value: '落霞孤鹜 · 开源楷体典藏' },
      { key: '开　　本', value: '16开（1440 × 1983 典藏比例）' },
      { key: '印　　张', value: '1.0 印张 · 全书十六页双面' },
      { key: '字　　数', value: '一万二千言' },
      { key: '版　　次', value: '二〇二六年十月 第一版' },
      { key: '印　　次', value: '二〇二六年十月 第一次印刷' },
      { key: '定　　价', value: '肆拾捌元整' },
    ],
    sealText: '文心出版局',
  },
];

export function getAllBookText(source: PageContent[] = CHINESE_PAGES): string {
  const parts: string[] = [];
  for (const p of source) {
    if (p.title) parts.push(p.title);
    if (p.subtitle) parts.push(p.subtitle);
    if (p.author) parts.push(p.author);
    if (p.chapterNumber) parts.push(p.chapterNumber);
    if (p.headerText) parts.push(p.headerText);
    if (p.dropCap) parts.push(p.dropCap);
    if (p.paragraphs) parts.push(...p.paragraphs);
    if (p.poetryLines) parts.push(...p.poetryLines);
    if (p.notes) parts.push(...p.notes);
    if (p.tocItems) p.tocItems.forEach((t) => parts.push(t.title, t.author, t.page));
    if (p.colophonDetails) p.colophonDetails.forEach((c) => parts.push(c.key, c.value));
    if (p.sealText) parts.push(p.sealText);
  }
  return parts.join('');
}
