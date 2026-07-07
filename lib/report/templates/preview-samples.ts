/** Inline SVG placeholders — safe for iframe srcDoc without external requests. */
export function placeholderPhotoDataUri(options: {
  label: string;
  hue?: number;
  index?: number;
}): string {
  const { label, hue = 210, index = 1 } = options;
  const h = (hue + index * 24) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${h},55%,72%)"/>
      <stop offset="100%" stop-color="hsl(${(h + 40) % 360},45%,58%)"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <circle cx="520" cy="80" r="48" fill="rgba(255,255,255,0.25)"/>
  <circle cx="120" cy="280" r="72" fill="rgba(255,255,255,0.15)"/>
  <text x="320" y="188" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,0.92)">${escapeXml(label)}</text>
  <text x="320" y="228" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="16" fill="rgba(255,255,255,0.7)">占位照片 ${index}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function placeholderPhotoSrc(label: string, index: number, hue?: number): string {
  return placeholderPhotoDataUri({ label, index, hue });
}

function photoClassic(label: string, index: number, hue: number): string {
  const src = placeholderPhotoSrc(label, index, hue);
  return `<div class="photo-item"><img src="${src}" alt=""></div>`;
}

function photoShape(
  shapeClass: string,
  label: string,
  index: number,
  hue: number,
): string {
  const src = placeholderPhotoSrc(label, index, hue);
  return `<div class="photo-item ${shapeClass}"><img src="${src}" alt=""></div>`;
}

/** Classic card layout — cream-soft & ocean-fresh */
export function buildClassicPreviewBody(hue: number): string {
  const p = (i: number) => photoClassic("活动", i, hue);
  return `
<div class="section" style="background: var(--color-bg);">
  <div class="section-header">
    <div class="section-icon">🌱</div>
    <div>
      <div class="section-title">情绪与适应</div>
      <div class="section-subtitle">Emotional Growth</div>
    </div>
  </div>
  <div class="content-box">
    <p>本周宝贝们逐渐熟悉了教室环境，<strong>分离焦虑</strong>明显减轻，更多孩子能在晨间自主探索玩具角。</p>
    <p>老师观察到：微笑和挥手告别的人数比上周增加了不少。</p>
  </div>
  <div class="photo-grid grid-3">
    ${p(1)}${p(2)}${p(3)}
  </div>
</div>
<div class="section" style="background: #fff;">
  <div class="section-header">
    <div class="section-icon">🎨</div>
    <div>
      <div class="section-title">快乐活动</div>
      <div class="section-subtitle">Fun Activities</div>
    </div>
  </div>
  <div class="content-box">
    <p>手指画、撕贴画和音乐律动是本周最受欢迎的三项活动，孩子们专注时长稳步提升。</p>
  </div>
  <div class="highlight-box"><p>「第一次独立完成一幅作品」—— 这是本周最让老师们惊喜的瞬间。</p></div>
  <div class="photo-grid grid-3">
    ${p(4)}${p(5)}${p(6)}
  </div>
</div>
<div class="tips-section">
  <div class="tips-title">给家长的小提示</div>
  <div class="tips-grid">
    <div class="tip-card"><h4>规律作息</h4><p>尽量保持与园所相近的午睡时间，帮助孩子平稳过渡。</p></div>
    <div class="tip-card"><h4>积极告别</h4><p>简短、温暖地告别，避免悄悄离开，建立信任感。</p></div>
  </div>
  <div class="closing-section">
    <h3>感谢家长们的信任与配合</h3>
    <p>每一个小进步都值得庆祝，我们下周见！</p>
  </div>
</div>`;
}

/** Garden story zigzag layout */
export function buildGardenStoryPreviewBody(): string {
  const hue = 120;
  const shapes = ["photo-item--circle", "photo-item--blob", "photo-item--leaf"];
  const mosaic = [1, 2, 3, 4, 5, 6]
    .map((i) => photoShape(shapes[(i - 1) % 3], "探索", i, hue))
    .join("");
  return `
<div class="section section--story" style="background: var(--color-bg);" data-flow="left">
  <div class="section-header section-header--story">
    <span class="section-marker"></span>
    <div>
      <div class="section-title">情绪与适应</div>
      <div class="section-subtitle">像绘本一样慢慢展开</div>
    </div>
  </div>
  <div class="story-body">
    <div class="content-box"><p>折页式排版让文字与照片<strong>左右交替</strong>，阅读动线更自然。这里是占位正文，展示真实周报中的段落样式。</p></div>
    <div class="highlight-box"><p>圆形、水滴形与叶片形相框会按顺序轮换出现。</p></div>
  </div>
  <div class="photo-mosaic mosaic-6">${mosaic}</div>
</div>
<div class="section section--story" style="background: #fff;" data-flow="right">
  <div class="section-header section-header--story">
    <span class="section-marker"></span>
    <div>
      <div class="section-title">快乐活动</div>
      <div class="section-subtitle">Photos on the other side</div>
    </div>
  </div>
  <div class="story-body">
    <div class="list-item"><span class="list-icon">✿</span><div class="list-content"><h4>感官探索</h4><p>触摸不同材质的感官袋，孩子们充满好奇。</p></div></div>
  </div>
  <div class="photo-mosaic mosaic-6">${mosaic}</div>
</div>
<div class="tips-section">
  <div class="tips-title">给家长的小提示</div>
  <div class="tips-grid">
    <div class="tip-card tip-card--leaf"><h4>共读时光</h4><p>睡前 10 分钟亲子阅读，延续园所绘本主题。</p></div>
    <div class="tip-card tip-card--leaf"><h4>户外散步</h4><p>观察树叶与云朵，激发自然好奇心。</p></div>
  </div>
  <div class="closing-section"><h3>感谢陪伴</h3><p>期待与宝贝们继续探索自然与故事。</p></div>
</div>`;
}

/** Candy pop bento layout */
export function buildCandyPopPreviewBody(): string {
  const hue = 330;
  const shapes = ["photo-item--hex", "photo-item--cloud", "photo-item--pill", "photo-item--round"];
  const cells = [1, 2, 3, 4]
    .map(
      (i) =>
        `<div class="bento-cell bento-cell--photo span-2"><div class="photo-item ${shapes[(i - 1) % 4]}"><img src="${placeholderPhotoSrc("游戏", i, hue)}" alt=""></div></div>`,
    )
    .join("");
  return `
<div class="section section--bento" style="background: var(--color-bg);">
  <div class="section-header section-header--bento">
    <span class="section-icon">🍬</span>
    <div>
      <div class="section-title">快乐活动</div>
      <div class="section-tagline">拼贴便当格 · 六边形云朵胶囊</div>
    </div>
  </div>
  <div class="bento-board">
    <div class="bento-cell bento-cell--text span-wide">
      <div class="content-box"><p>文字与照片<strong>混排在便当格</strong>中，打破传统横排网格。每个区块可有不同形状的照片容器。</p></div>
    </div>
    ${cells}
    <div class="bento-cell bento-cell--text">
      <div class="highlight-box"><p>占位高亮块：展示重点观察或温馨瞬间。</p></div>
    </div>
  </div>
</div>
<div class="section section--bento" style="background: #fff;">
  <div class="section-header section-header--bento">
    <span class="section-icon">🎈</span>
    <div><div class="section-title">社交与游戏</div></div>
  </div>
  <div class="bento-board">
    <div class="bento-cell bento-cell--text">
      <div class="list-item"><span class="list-icon">★</span><div class="list-content"><h4>合作搭建</h4><p>两三位小朋友一起完成积木塔。</p></div></div>
    </div>
    <div class="bento-cell bento-cell--photo span-3"><div class="photo-item photo-item--cloud"><img src="${placeholderPhotoSrc("合作", 1, hue)}" alt=""></div></div>
    <div class="bento-cell bento-cell--photo span-2"><div class="photo-item photo-item--hex"><img src="${placeholderPhotoSrc("合作", 2, hue)}" alt=""></div></div>
  </div>
</div>
<div class="tips-section">
  <div class="tips-title">给家长的小提示</div>
  <div class="tips-grid tips-grid--pop">
    <div class="tip-card tip-card--bubble"><h4>分享玩具</h4><p>在家练习轮流与交换，巩固社交技能。</p></div>
    <div class="tip-card tip-card--bubble"><h4>庆祝小成就</h4><p>用贴纸或拥抱记录每一个进步。</p></div>
  </div>
  <div class="closing-section"><h3>下周见</h3><p>继续一起玩耍、一起学习！</p></div>
</div>`;
}

export function buildPreviewBodyHtml(templateId: string): string {
  switch (templateId) {
    case "garden-story":
      return buildGardenStoryPreviewBody();
    case "candy-pop":
      return buildCandyPopPreviewBody();
    case "ocean-fresh":
      return buildClassicPreviewBody(200);
    case "cream-soft":
    default:
      return buildClassicPreviewBody(350);
  }
}
