import type { CatalogSku } from "@repo/catalog";
import type { ChinaCatalogItem, ChinaOfferCard } from "./catalog";
import { formatCny, getChinaOfferCards } from "./catalog";
import type { ReceiptState } from "./receipt";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  );
}

const CURRENT_YEAR = new Date().getFullYear();

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#6d28d9"/><text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#fff">EX</text></svg>'
)}`;

const FAMILY_ORDER: CatalogSku["family"][] = ["course", "book", "template"];

const FAMILY_LABELS: Record<CatalogSku["family"], string> = {
  course: "课程",
  book: "电子书",
  template: "模板",
};

const FAMILY_INTROS: Record<CatalogSku["family"], string> = {
  course: "系统课程与实战路线，适合想把一个方向真正做完的人。",
  book: "短小、直接、可执行的电子书，适合先补齐一个具体问题。",
  template: "可直接改造的模板与 Agent 工具包，适合马上开工。",
};

const FAMILY_PATHS: Record<CatalogSku["family"], string> = {
  course: "/courses",
  book: "/books",
  template: "/templates",
};

const FAMILY_HEADLINES: Record<CatalogSku["family"], string> = {
  course: "系统学完，再动手做。",
  book: "先补齐一个问题，再往前走。",
  template: "少搭一遍，直接开始做。",
};

const FORMAT_LABELS: Record<CatalogSku["format"], string> = {
  course: "课程",
  ebook: "电子书",
  ecourse: "视频课",
  template: "模板",
  agent: "Agent",
  bundle: "合集",
};

const DEFAULT_DESCRIPTION: Record<CatalogSku["family"], string> = {
  course: "按步骤推进的实战内容，购买后通过邮箱接收访问方式。",
  book: "聚焦一个主题的数字读物，适合快速查阅和反复使用。",
  template: "可复用的模板与配置，购买后通过邮箱接收下载链接。",
};

const STYLES = `
  :root {
    color-scheme: light;
    --ink: #17131f;
    --ink-soft: #3f394c;
    --muted: #6e687a;
    --line: #e7e1ef;
    --line-strong: #d6cde3;
    --paper: #fbfafc;
    --card: #ffffff;
    --primary: #6d28d9;
    --primary-strong: #5b21b6;
    --primary-soft: #f2ebff;
    --primary-wash: #faf7ff;
    --accent: #f59e0b;
    --success: #087a55;
    --danger: #b42318;
    --radius: 20px;
    --radius-sm: 12px;
    --shadow: 0 18px 50px rgba(46, 16, 101, 0.09);
    --font-sans: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
    --font-display: "Noto Serif SC", "Songti SC", "STSong", "SimSun", Georgia, serif;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    color: var(--ink);
    background:
      radial-gradient(1100px 500px at 85% -10%, rgba(109, 40, 217, 0.10), transparent 65%),
      radial-gradient(800px 420px at -10% 20%, rgba(245, 158, 11, 0.08), transparent 60%),
      var(--paper);
    font: 16px/1.7 var(--font-sans);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  a { color: var(--primary); text-underline-offset: 3px; }
  a:hover { color: var(--primary-strong); }
  img, svg { max-width: 100%; }
  .skip {
    position: absolute;
    left: -999px;
    top: 12px;
    z-index: 20;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--ink);
    color: #fff;
  }
  .skip:focus { left: 12px; }

  .shell { width: min(1120px, 100%); margin: 0 auto; padding: 0 20px; }
  .site-header {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid rgba(231, 225, 239, 0.9);
    background: rgba(251, 250, 252, 0.88);
    backdrop-filter: blur(18px);
  }
  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-height: 72px;
    flex-wrap: wrap;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    color: var(--ink);
    text-decoration: none;
  }
  .brand-mark {
    display: inline-grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: linear-gradient(135deg, var(--primary), #8b5cf6);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.04em;
    box-shadow: 0 8px 20px rgba(109, 40, 217, 0.24);
  }
  .brand-copy { display: grid; line-height: 1.1; }
  .brand-copy strong { font-size: 17px; letter-spacing: -0.03em; }
  .brand-copy span { color: var(--muted); font-size: 11px; letter-spacing: 0.12em; }
  .site-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .site-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 999px;
    color: var(--ink-soft);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .site-nav a:hover { background: var(--primary-soft); color: var(--primary-strong); }
  .site-nav .nav-pay {
    color: var(--primary-strong);
    background: var(--primary-soft);
  }

  main { padding: 0 0 72px; }
  h1, h2, h3 { margin: 0; color: var(--ink); letter-spacing: -0.025em; }
  h1, h2 { font-family: var(--font-display); font-weight: 700; }
  h1 { font-size: clamp(2.1rem, 5vw, 4rem); line-height: 1.12; }
  h2 { font-size: clamp(1.55rem, 3.4vw, 2.45rem); line-height: 1.2; }
  h3 { font-size: 1.13rem; line-height: 1.4; }
  p { margin: 0; }
  .eyebrow {
    margin: 0 0 10px;
    color: var(--primary);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .lede { color: var(--muted); font-size: clamp(1rem, 1.8vw, 1.16rem); line-height: 1.8; }
  .section { padding-top: 72px; }
  .section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 26px;
    flex-wrap: wrap;
  }
  .section-head .lede { max-width: 58ch; margin-top: 10px; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 22px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--primary), #7c3aed);
    color: #fff;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(109, 40, 217, 0.20);
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }
  .btn:hover {
    color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(109, 40, 217, 0.26);
  }
  .btn-ghost {
    background: rgba(255, 255, 255, 0.72);
    border-color: var(--line-strong);
    color: var(--ink);
    box-shadow: none;
  }
  .btn-ghost:hover { color: var(--primary-strong); background: #fff; }
  .btn-secondary {
    background: transparent;
    border-color: var(--primary);
    color: var(--primary-strong);
    box-shadow: none;
  }
  .btn-secondary:hover { background: var(--primary-soft); }
  .btn-wechat { background: linear-gradient(135deg, #0a8f5b, #087a55); }
  .btn-block { width: 100%; }
  .btn:focus-visible, a:focus-visible, summary:focus-visible, input:focus-visible {
    outline: 3px solid rgba(109, 40, 217, 0.28);
    outline-offset: 2px;
  }

  .hero { padding: 64px 0 18px; }
  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(280px, 0.92fr);
    align-items: center;
    gap: 46px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 7px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.75);
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 4px rgba(8, 122, 85, 0.10);
  }
  .hero h1 .accent {
    display: inline;
    background: linear-gradient(120deg, var(--primary), #a855f7 55%, #f59e0b);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    white-space: nowrap;
  }

  .hero-lede { max-width: 58ch; margin-top: 20px; color: var(--ink-soft); font-size: 1.08rem; line-height: 1.85; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
  .hero-points {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin: 24px 0 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
  .hero-points li { display: inline-flex; align-items: center; gap: 7px; }
  .hero-points li::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary);
  }

  .vault-stack { position: relative; min-height: 370px; }
  .vault-card {
    position: absolute;
    display: grid;
    gap: 8px;
    width: min(330px, 86%);
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 22px;
    box-shadow: var(--shadow);
    text-decoration: none;
    transition: transform 180ms ease;
  }
  .vault-card:hover { transform: translateY(-4px) rotate(0deg); }
  .vault-free {
    top: 12px;
    left: 0;
    z-index: 2;
    background:
      radial-gradient(320px 200px at 100% 0%, rgba(255, 255, 255, 0.32), transparent 70%),
      linear-gradient(145deg, #2e1065, #6d28d9 58%, #a855f7);
    color: #fff;
    transform: rotate(-2deg);
  }
  .vault-paid {
    right: 0;
    bottom: 18px;
    z-index: 3;
    background: rgba(255, 255, 255, 0.94);
    color: var(--ink);
    transform: rotate(2deg);
  }
  .vault-label {
    width: fit-content;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .vault-paid .vault-label { background: var(--primary-soft); color: var(--primary-strong); }
  .vault-card strong { font-size: 1.2rem; line-height: 1.35; }
  .vault-price { font-family: var(--font-display); font-size: 2rem; font-weight: 700; }
  .vault-link { font-size: 13px; font-weight: 700; opacity: 0.9; }
  .vault-meta {
    position: absolute;
    left: 50%;
    bottom: -12px;
    z-index: 4;
    transform: translateX(-50%);
    width: max-content;
    max-width: 90%;
    padding: 9px 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(46, 16, 101, 0.08);
  }

  .trust-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    margin-top: 54px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--line);
  }
  .trust-item { padding: 20px; background: rgba(255, 255, 255, 0.86); }
  .trust-item strong { display: block; color: var(--ink); font-size: 14px; }
  .trust-item span { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
  .product-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--card);
    box-shadow: 0 1px 0 rgba(23, 19, 31, 0.02);
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
  }
  .product-card:hover {
    transform: translateY(-3px);
    border-color: var(--line-strong);
    box-shadow: 0 16px 34px rgba(46, 16, 101, 0.08);
  }
  .cover-link { display: block; color: inherit; text-decoration: none; }
  .cover {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    aspect-ratio: 4 / 3;
    padding: 18px;
    overflow: hidden;
    color: #fff;
    isolation: isolate;
  }
  .cover::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(280px 200px at 100% 0%, rgba(255, 255, 255, 0.30), transparent 68%),
      radial-gradient(220px 180px at 0% 100%, rgba(255, 255, 255, 0.16), transparent 70%);
  }
  .cover-course { background: linear-gradient(145deg, #2e1065, #6d28d9 56%, #a855f7); }
  .cover-book { background: linear-gradient(145deg, #7c2d12, #ea580c 56%, #fbbf24); }
  .cover-template { background: linear-gradient(145deg, #134e4a, #0f766e 56%, #2dd4bf); }
  .cover-kicker {
    width: fit-content;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .cover-glyph {
    align-self: center;
    font-family: var(--font-display);
    font-size: clamp(3.5rem, 8vw, 5.6rem);
    font-weight: 700;
    line-height: 1;
    opacity: 0.92;
    text-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
  }
  .cover-brand { font-size: 10px; font-weight: 800; letter-spacing: 0.18em; opacity: 0.7; }
  .product-card-body { display: flex; flex: 1; flex-direction: column; padding: 20px; }
  .product-kicker {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .product-kicker span + span::before { content: "·"; margin-right: 8px; color: var(--line-strong); }
  .product-card h3 a { color: var(--ink); text-decoration: none; }
  .product-card h3 a:hover { color: var(--primary-strong); }
  .product-desc { margin-top: 9px; color: var(--muted); font-size: 13px; line-height: 1.65; }
  .product-card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
    padding-top: 18px;
  }
  .price { color: var(--ink); font-family: var(--font-display); font-size: 1.32rem; font-weight: 700; }
  .price-free { color: var(--success); }
  .text-link { color: var(--primary); font-size: 13px; font-weight: 700; text-decoration: none; }
  .text-link:hover { text-decoration: underline; }
  .offer-list {
    display: grid;
    gap: 9px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
  }
  .offer-list li {
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 9px;
    padding-top: 9px;
    border-top: 1px solid var(--line);
    font-size: 13px;
  }
  .offer-list .offer-label { color: var(--muted); font-weight: 700; }
  .offer-list a { color: var(--ink-soft); font-weight: 600; text-decoration: none; }
  .offer-list a:hover { color: var(--primary-strong); text-decoration: underline; }
  .offer-list .offer-price { color: var(--ink); font-weight: 700; }

  .catalog-groups { display: grid; gap: 56px; }
  .catalog-group { scroll-margin-top: 96px; }
  .group-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .group-head .lede { max-width: 62ch; margin-top: 7px; font-size: 14px; }
  .count {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 12px;
    font-weight: 700;
  }
  .home-family-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }
  .home-family-card {
    display: flex;
    flex-direction: column;
    padding: 26px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: linear-gradient(165deg, #fff 35%, var(--primary-wash));
    box-shadow: 0 12px 32px rgba(46, 16, 101, 0.05);
  }
  .home-family-icon {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 16px;
    color: #fff;
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 700;
    box-shadow: 0 10px 22px rgba(46, 16, 101, 0.18);
  }
  .home-family-icon-course { background: linear-gradient(145deg, #2e1065, #6d28d9 56%, #a855f7); }
  .home-family-icon-book { background: linear-gradient(145deg, #7c2d12, #ea580c 56%, #fbbf24); }
  .home-family-icon-template { background: linear-gradient(145deg, #134e4a, #0f766e 56%, #2dd4bf); }
  .home-family-card h3 { margin: 18px 0 4px; font-size: 1.4rem; }
  .family-card-meta { margin: 0; color: var(--muted); font-size: 12px; font-weight: 700; }
  .family-intro { margin: 14px 0 0; color: var(--ink-soft); font-size: 14px; line-height: 1.75; }
  .family-entry-list { display: grid; gap: 10px; margin: 20px 0 24px; padding: 0; list-style: none; }
  .family-entry {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fff;
  }
  .family-entry .entry-label {
    display: block;
    margin-bottom: 4px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .family-entry a {
    display: block;
    color: var(--ink);
    font-weight: 700;
    line-height: 1.45;
    text-decoration: none;
  }
  .family-entry a:hover { color: var(--primary-strong); }
  .family-entry .entry-price { display: inline-block; margin-top: 6px; color: var(--muted); font-size: 12px; }
  .family-entry .entry-muted { color: var(--muted); font-size: 13px; font-weight: 600; }
  .home-family-card .btn { margin-top: auto; }
  .family-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 38px; }
  .family-nav a {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 38px;
    padding: 0 13px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--ink-soft);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }
  .family-nav a:hover { border-color: var(--primary); color: var(--primary-strong); }
  .family-nav a.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-strong); }
  .family-nav span { color: var(--muted); font-weight: 600; }

  .steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    counter-reset: step;
  }
  .step {
    position: relative;
    padding: 26px 22px 22px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.78);
  }
  .step::before {
    counter-increment: step;
    content: "0" counter(step);
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    margin-bottom: 16px;
    border-radius: 10px;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 12px;
    font-weight: 800;
  }
  .step h3 { margin-bottom: 7px; }
  .step p { color: var(--muted); font-size: 14px; line-height: 1.7; }

  .trust-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .trust-card {
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.78);
  }
  .trust-card h3 { margin-bottom: 7px; }
  .trust-card p { color: var(--muted); font-size: 14px; line-height: 1.7; }

  .faq { display: grid; gap: 10px; max-width: 860px; }
  .faq details {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.84);
  }
  .faq summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 58px;
    padding: 14px 18px;
    color: var(--ink);
    font-weight: 700;
    cursor: pointer;
    list-style: none;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after {
    content: "+";
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--primary-soft);
    color: var(--primary-strong);
    font-size: 18px;
    font-weight: 600;
  }
  .faq details[open] summary::after { content: "−"; }
  .faq .answer { padding: 0 18px 18px; color: var(--muted); font-size: 14px; line-height: 1.8; }

  .cta-panel {
    display: grid;
    justify-items: center;
    gap: 14px;
    margin-top: 72px;
    padding: 58px 24px;
    border-radius: 28px;
    background:
      radial-gradient(520px 260px at 50% 0%, rgba(255, 255, 255, 0.18), transparent 70%),
      linear-gradient(135deg, #2e1065, #6d28d9 62%, #a855f7);
    color: #fff;
    text-align: center;
    box-shadow: var(--shadow);
  }
  .cta-panel .eyebrow { color: #ddd0ff; }
  .cta-panel h2 { color: #fff; }
  .cta-panel p { max-width: 58ch; color: rgba(255, 255, 255, 0.78); }
  .cta-panel .btn { margin-top: 8px; background: #fff; color: var(--primary-strong); box-shadow: none; }
  .cta-panel .btn:hover { color: var(--primary-strong); background: #f7f2ff; }

  .breadcrumb { display: flex; flex-wrap: wrap; gap: 8px; margin: 26px 0 18px; color: var(--muted); font-size: 13px; }
  .breadcrumb a { color: var(--muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--primary); }
  .product-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.22fr) minmax(310px, 0.78fr);
    align-items: start;
    gap: 34px;
  }
  .product-cover .cover { aspect-ratio: 16 / 10; border-radius: var(--radius); }
  .product-cover .cover-glyph { font-size: clamp(4.4rem, 12vw, 8rem); }
  .product-info { margin-top: 28px; }
  .product-info h1 { font-size: clamp(2rem, 4vw, 3.35rem); }
  .product-info .lede { margin-top: 16px; }
  .spec-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
  .spec {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 600;
  }
  .spec strong { color: var(--muted); font-weight: 600; }
  .panel {
    margin-top: 18px;
    padding: 22px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.78);
  }
  .panel h2 { margin-bottom: 12px; font-family: var(--font-sans); font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; }
  .panel ul { margin: 0; padding-left: 20px; color: var(--muted); font-size: 14px; line-height: 1.85; }
  .panel p { color: var(--muted); font-size: 14px; line-height: 1.8; }
  .panel p + p { margin-top: 10px; }

  .buy-panel {
    position: sticky;
    top: 96px;
    padding: 24px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: #fff;
    box-shadow: var(--shadow);
  }
  .buy-panel .price { font-size: clamp(1.8rem, 4vw, 2.5rem); }
  .buy-price-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .buy-price-row span { color: var(--muted); font-size: 12px; }
  .buy-panel .btn { margin-top: 18px; }
  .checkout-form { margin-top: 18px; }
  .field { display: grid; gap: 7px; margin-bottom: 14px; }
  .field label { color: var(--ink); font-size: 13px; font-weight: 700; }
  .field input {
    width: 100%;
    min-height: 46px;
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    background: #fff;
    color: var(--ink);
    font: inherit;
  }
  .field input::placeholder { color: #9c95aa; }
  .checkout-actions { display: grid; gap: 9px; }
  .buy-note { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  .legal-note { margin-top: 12px; color: var(--muted); font-size: 12px; line-height: 1.7; }
  .alert {
    margin-bottom: 16px;
    padding: 11px 13px;
    border: 1px solid #f3b7b2;
    border-radius: 10px;
    background: #fff2f1;
    color: var(--danger);
    font-size: 13px;
    font-weight: 600;
  }
  .notice {
    margin-top: 18px;
    padding: 13px 15px;
    border: 1px solid #f0d49a;
    border-radius: 10px;
    background: #fff9ec;
    color: #7a4d00;
    font-size: 13px;
    line-height: 1.7;
  }
  .delivery-facts { display: grid; gap: 12px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
  .delivery-fact { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 13px; }
  .delivery-fact strong { color: var(--ink-soft); font-weight: 700; text-align: right; }

  .pay-page { max-width: 720px; margin: 0 auto; padding-top: 34px; }
  .pay-card {
    margin-top: 24px;
    padding: 28px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
    box-shadow: var(--shadow);
    text-align: center;
  }
  .qr-wrap {
    display: inline-grid;
    place-items: center;
    margin: 8px 0 18px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
  }
  .qr-wrap svg { display: block; width: min(264px, 68vw); height: auto; }
  .pay-steps { display: grid; gap: 8px; max-width: 460px; margin: 18px auto 0; padding: 0; list-style: none; color: var(--muted); font-size: 13px; text-align: left; }
  .pay-steps li { display: flex; gap: 9px; }
  .pay-steps li::before { content: "•"; color: var(--primary); font-weight: 800; }
  .code-box {
    display: block;
    margin-top: 5px;
    padding: 9px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--primary-wash);
    color: var(--ink-soft);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .receipt { max-width: 760px; margin: 0 auto; padding-top: 34px; }
  .receipt-card {
    margin-top: 22px;
    padding: clamp(24px, 5vw, 42px);
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
    box-shadow: var(--shadow);
  }
  .receipt-card h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); }
  .receipt-card .lede { margin-top: 14px; }
  .receipt-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 24px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--primary-wash);
    flex-wrap: wrap;
  }
  .receipt-meta span { color: var(--muted); font-size: 12px; font-weight: 600; }
  .receipt-meta code { color: var(--ink); font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
  .receipt-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }

  .legal-wrap { max-width: 880px; margin: 0 auto; padding-top: 34px; }
  .legal-card {
    margin-top: 18px;
    padding: clamp(24px, 5vw, 46px);
    border: 1px solid var(--line);
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 12px 36px rgba(46, 16, 101, 0.05);
  }
  .legal-card h1 { margin-bottom: 22px; }
  .legal-card h2 {
    margin: 30px 0 8px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .legal-card h2:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; }
  .legal-card p { color: var(--muted); font-size: 14px; line-height: 1.9; }
  .legal-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--muted); font-size: 12px; }

  .not-found { display: grid; justify-items: center; gap: 14px; padding: 84px 0; text-align: center; }
  .not-found .lede { max-width: 48ch; }

  .site-footer {
    border-top: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.62);
  }
  .footer-grid {
    display: grid;
    grid-template-columns: 1.5fr repeat(3, 1fr);
    gap: 34px;
    padding: 48px 0 34px;
  }
  .footer-brand p { max-width: 34ch; margin-top: 14px; color: var(--muted); font-size: 13px; line-height: 1.8; }
  .footer-note { margin-top: 10px; color: var(--muted); font-size: 12px; }
  .footer-col h2 { margin-bottom: 12px; color: var(--ink); font-family: var(--font-sans); font-size: 12px; font-weight: 800; letter-spacing: 0.08em; }
  .footer-col ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .footer-col a { color: var(--muted); font-size: 13px; text-decoration: none; }
  .footer-col a:hover { color: var(--primary-strong); }
  .order-lookup { margin-top: 16px; }
  .order-lookup label { display: block; margin-bottom: 6px; color: var(--ink-soft); font-size: 12px; font-weight: 700; }
  .lookup-row { display: flex; gap: 6px; }
  .lookup-row input {
    min-width: 0;
    flex: 1;
    min-height: 38px;
    padding: 7px 9px;
    border: 1px solid var(--line-strong);
    border-radius: 9px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
  }
  .lookup-row button {
    min-height: 38px;
    padding: 0 11px;
    border: 0;
    border-radius: 9px;
    background: var(--primary);
    color: #fff;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .footer-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 18px 0 30px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    .hero-grid, .product-layout, .home-family-grid { grid-template-columns: 1fr; }
    .hero { padding-top: 44px; }
    .vault-stack {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      min-height: 0;
      max-width: 520px;
      margin: 0 auto;
    }
    .vault-card {
      position: relative;
      inset: auto;
      width: auto;
      transform: none;
    }
    .vault-card:hover { transform: translateY(-3px); }
    .vault-meta {
      position: static;
      grid-column: 1 / -1;
      justify-self: center;
      transform: none;
      width: auto;
      max-width: 100%;
      text-align: center;
    }
    .product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .trust-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .steps { grid-template-columns: 1fr; }
    .footer-grid { grid-template-columns: 1.4fr 1fr 1fr; }
    .footer-brand { grid-column: 1 / -1; }
    .buy-panel { position: static; }
  }
  @media (max-width: 620px) {
    .shell { padding: 0 16px; }
    .header-inner { min-height: 64px; }
    .brand-copy strong { font-size: 15px; }
    .site-nav { width: 100%; overflow-x: auto; padding-bottom: 9px; }
    .site-nav a { min-height: 36px; padding: 0 10px; font-size: 13px; }
    .site-nav .nav-pay { display: none; }
    .hero { padding-top: 34px; }
    .hero-actions .btn { width: 100%; }
    .vault-stack { grid-template-columns: 1fr; }
    .vault-card { padding: 20px; }
    .vault-card strong { font-size: 1.05rem; }
    .vault-price { font-size: 1.7rem; }
    .trust-strip { margin-top: 40px; }
    .trust-item { padding: 16px; }
    .product-grid, .trust-grid { grid-template-columns: 1fr; }
    .section { padding-top: 52px; }
    .catalog-groups { gap: 44px; }
    .cta-panel { margin-top: 52px; padding: 44px 20px; border-radius: 22px; }
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
    .footer-col:last-child { grid-column: 1 / -1; }
    .footer-bottom { justify-content: flex-start; }
    .receipt, .legal-wrap, .pay-page { padding-top: 22px; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after { transition: none !important; }
  }
`;

type LayoutInput = {
  title: string;
  description: string;
  body: string;
};

function layout({ title, description, body }: LayoutInput): string {
  const pageTitle = `${title} · 示例商店`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(description)}">
<meta name="theme-color" content="#6d28d9">
<meta property="og:locale" content="zh_CN">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(pageTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="示例商店">
<meta name="twitter:card" content="summary">
<title>${escapeHtml(pageTitle)}</title>
<link rel="icon" href="${FAVICON}">
<style>${STYLES}</style>
</head>
<body>
<a class="skip" href="#main">跳到主要内容</a>
<header class="site-header">
  <div class="shell header-inner">
    <a class="brand" href="/" aria-label="示例商店首页">
      <span class="brand-mark" aria-hidden="true">SB</span>
      <span class="brand-copy"><strong>Example Store</strong><span>中国店</span></span>
    </a>
    <nav class="site-nav" aria-label="主导航">
      <a href="/courses">课程</a>
      <a href="/books">电子书</a>
      <a href="/templates">模板</a>
      <a href="/store">全部商品</a>
      <a class="nav-pay" href="/store">支付宝结算</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="shell">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/" aria-label="示例商店首页">
          <span class="brand-mark" aria-hidden="true">SB</span>
          <span class="brand-copy"><strong>Example Store</strong><span>中国店</span></span>
        </a>
        <p>面向中文创作者的实战课程、电子书与模板。人民币标价，数字文件通过境内私有存储交付。</p>
        <p class="footer-note">中国大陆 · 人民币结算</p>
      </div>
      <div class="footer-col">
        <h2>商品</h2>
        <ul>
          <li><a href="/courses">课程</a></li>
          <li><a href="/books">电子书</a></li>
          <li><a href="/templates">模板</a></li>
          <li><a href="/store">全部商品</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2>支持</h2>
        <ul>
          <li><a href="/#delivery">交付说明</a></li>
          <li><a href="/refund">退款政策</a></li>
        </ul>
        <form class="order-lookup" action="/thanks" method="get">
          <label for="order-lookup">查询订单</label>
          <div class="lookup-row">
            <input id="order-lookup" name="order" autocomplete="off" placeholder="输入订单号">
            <button type="submit">查询</button>
          </div>
        </form>
      </div>
      <div class="footer-col">
        <h2>法律</h2>
        <ul>
          <li><a href="/terms">服务条款</a></li>
          <li><a href="/privacy">隐私政策</a></li>
          <li><a href="/refund">退款政策</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${CURRENT_YEAR} 示例商店。保留所有权利。</p>
      <p>数字商品 · 邮箱交付 · 支付宝结算</p>
    </div>
  </div>
</footer>
</body>
</html>`;
}

function familyLabel(family: CatalogSku["family"]): string {
  return FAMILY_LABELS[family];
}

function formatLabel(format: CatalogSku["format"]): string {
  return FORMAT_LABELS[format];
}

function typeLabels(sku: CatalogSku): string[] {
  const family = familyLabel(sku.family);
  const format = formatLabel(sku.format);
  return family === format ? [family] : [family, format];
}

function cover(item: ChinaCatalogItem): string {
  const glyph = [...familyLabel(item.sku.family)][0] ?? "M";
  return `<div class="cover cover-${item.sku.family}">
  <span class="cover-kicker">${escapeHtml(formatLabel(item.format))}</span>
  <span class="cover-glyph" aria-hidden="true">${escapeHtml(glyph)}</span>
  <span class="cover-brand">EXAMPLE STORE</span>
</div>`;
}

function productCard(item: ChinaCatalogItem): string {
  const href = `/product/${encodeURIComponent(item.sku.id)}`;
  const description = item.description ?? DEFAULT_DESCRIPTION[item.sku.family];
  const priceClass = item.free ? "price price-free" : "price";
  return `<article class="product-card">
  <a class="cover-link" href="${href}" tabindex="-1" aria-hidden="true">${cover(item)}</a>
  <div class="product-card-body">
    <div class="product-kicker">
      ${typeLabels(item.sku)
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("")}
    </div>
    <h3><a href="${href}">${escapeHtml(item.title)}</a></h3>
    <p class="product-desc">${escapeHtml(description)}</p>
    <div class="product-card-foot">
      <span class="${priceClass}">${escapeHtml(item.priceLabel)}</span>
      <a class="text-link" href="${href}">查看详情 <span aria-hidden="true">→</span></a>
    </div>
  </div>
</article>`;
}

function offerCard(offer: ChinaOfferCard): string {
  const href = `/product/${encodeURIComponent(offer.representative.sku.id)}`;
  const description =
    offer.description ?? DEFAULT_DESCRIPTION[offer.representative.sku.family];
  const paidItems = offer.paidItems.slice(0, 2);
  const entries = [
    offer.freeItem
      ? `<li><span class="offer-label">免费入口</span><a href="/product/${encodeURIComponent(offer.freeItem.sku.id)}">${escapeHtml(offer.freeItem.title)}</a><span class="offer-price">免费</span></li>`
      : "",
    ...paidItems.map(
      (item) =>
        `<li><span class="offer-label">付费版本</span><a href="/product/${encodeURIComponent(item.sku.id)}">${escapeHtml(item.title)}</a><span class="offer-price">${escapeHtml(item.priceLabel)}</span></li>`
    ),
  ]
    .filter(Boolean)
    .join("\n");
  return `<article class="product-card offer-card">
  <a class="cover-link" href="${href}" tabindex="-1" aria-hidden="true">${cover(offer.representative)}</a>
  <div class="product-card-body">
    <div class="product-kicker">
      ${typeLabels(offer.representative.sku)
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("")}
    </div>
    <h3><a href="${href}">${escapeHtml(offer.title)}</a></h3>
    <p class="product-desc">${escapeHtml(description)}</p>
    <ul class="offer-list">${entries}</ul>
    <div class="product-card-foot">
      <span class="${offer.paidItems.length ? "price" : "price price-free"}">${escapeHtml(offer.priceLabel)}</span>
      <a class="text-link" href="${href}">查看详情 <span aria-hidden="true">→</span></a>
    </div>
  </div>
</article>`;
}

function offerGrid(items: ChinaCatalogItem[]): string {
  return `<div class="product-grid">${getChinaOfferCards(items)
    .map(offerCard)
    .join("\n")}</div>`;
}

function productGrid(items: ChinaCatalogItem[]): string {
  return `<div class="product-grid">${items.map(productCard).join("\n")}</div>`;
}

function groupedCatalog(items: ChinaCatalogItem[]): string {
  return `<div class="catalog-groups">${FAMILY_ORDER.map((family) => {
    const familyItems = items.filter((item) => item.sku.family === family);
    if (familyItems.length === 0) return "";
    return `<section class="catalog-group" id="${family}">
  <div class="group-head">
    <div>
      <p class="eyebrow">${escapeHtml(familyLabel(family))}</p>
      <h2>${escapeHtml(familyLabel(family))}</h2>
      <p class="lede">${escapeHtml(FAMILY_INTROS[family])}</p>
    </div>
    <span class="count">${familyItems.length} 件</span>
  </div>
  ${productGrid(familyItems)}
</section>`;
  })
    .filter(Boolean)
    .join("\n")}</div>`;
}

function homeFamilySection(items: ChinaCatalogItem[]): string {
  const cards = FAMILY_ORDER.map((family) => {
    const familyItems = items.filter((item) => item.sku.family === family);
    if (familyItems.length === 0) return "";
    const freeItem = familyItems.find((item) => item.free);
    const paidItems = familyItems
      .filter((item) => !item.free)
      .sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0));
    const paidItem = paidItems[0];
    const paidCount = paidItems.length;
    const freeCount = familyItems.length - paidCount;
    const entries = [
      freeItem
        ? `<li class="family-entry">
  <span class="entry-label">免费入口</span>
  <a href="/product/${encodeURIComponent(freeItem.sku.id)}">${escapeHtml(freeItem.title)}</a>
</li>`
        : "",
      paidItem
        ? `<li class="family-entry">
  <span class="entry-label">付费版本</span>
  <a href="/product/${encodeURIComponent(paidItem.sku.id)}">${escapeHtml(paidItem.title)}</a>
  <span class="entry-price">${escapeHtml(paidItem.priceLabel)}</span>
</li>`
        : `<li class="family-entry">
  <span class="entry-label">付费版本</span>
  <span class="entry-muted">准备中</span>
</li>`,
    ].join("\n");
    return `<article class="home-family-card">
  <span class="home-family-icon home-family-icon-${family}" aria-hidden="true">${escapeHtml(familyLabel(family)[0] ?? "M")}</span>
  <h3>${escapeHtml(familyLabel(family))}</h3>
  <p class="family-card-meta">${freeCount} 个免费 · ${paidCount} 个付费</p>
  <p class="family-intro">${escapeHtml(FAMILY_INTROS[family])}</p>
  <ul class="family-entry-list">${entries}</ul>
  <a class="btn btn-ghost" href="${FAMILY_PATHS[family]}">查看全部${escapeHtml(familyLabel(family))} <span aria-hidden="true">→</span></a>
</article>`;
  })
    .filter(Boolean)
    .join("\n");

  return `<section class="shell section" id="catalog">
  <div class="section-head">
    <div>
      <p class="eyebrow">商品目录</p>
      <h2>先选类型，再选深度。</h2>
      <p class="lede">课程系统推进，电子书快速补齐，模板直接复用。每类都从免费入口开始。</p>
    </div>
    <a class="btn btn-ghost" href="/store">查看全部商品</a>
  </div>
  <div class="home-family-grid">${cards}</div>
</section>`;
}

function familyNav(
  items: ChinaCatalogItem[],
  active?: CatalogSku["family"]
): string {
  const all = `<a class="${active ? "" : "active"}" href="/store"${active ? "" : ' aria-current="page"'}>全部 <span>${items.length}</span></a>`;
  const links = FAMILY_ORDER.map((family) => {
    const count = items.filter((item) => item.sku.family === family).length;
    if (count === 0) return "";
    const current = family === active;
    return `<a class="${current ? "active" : ""}" href="${FAMILY_PATHS[family]}"${current ? ' aria-current="page"' : ""}>${escapeHtml(familyLabel(family))} <span>${count}</span></a>`;
  })
    .filter(Boolean)
    .join("\n");
  return `<nav class="family-nav" aria-label="商品分类">${all}${links}</nav>`;
}

function hero(items: ChinaCatalogItem[]): string {
  const freeItems = items.filter((item) => item.free);
  const paidItems = items.filter((item) => !item.free);
  const featuredFree = freeItems[0];
  const featuredPaid = paidItems[0];
  const freeTitle = featuredFree?.title ?? "免费入门资源";
  const paidTitle = featuredPaid?.title ?? "完整课程与模板";
  const paidPrice = featuredPaid?.priceLabel ?? "人民币计价";
  return `<section class="shell hero">
  <div class="hero-grid">
    <div>
      <span class="badge"><span class="badge-dot" aria-hidden="true"></span>EXAMPLE STORE · 中国店</span>
      <h1>把 AI 做出来，<span class="accent">真正交付出去。</span></h1>
      <p class="hero-lede">面向中文创作者的实战课程、电子书与模板。先从免费资源开始，需要时再购买完整版本。人民币标价，支付宝付款，下载链接发送到结账邮箱。</p>
      <div class="hero-actions">
        <a class="btn" href="/store">浏览全部商品 <span aria-hidden="true">→</span></a>
        <a class="btn btn-ghost" href="#delivery">了解交付方式</a>
      </div>
      <ul class="hero-points">
        <li>人民币标价</li>
        <li>支付宝付款</li>
        <li>邮箱接收下载链接</li>
      </ul>
    </div>
    <div class="vault-stack" aria-label="商品示例">
      <a class="vault-card vault-free" href="${featuredFree ? `/product/${encodeURIComponent(featuredFree.sku.id)}` : "/store"}">
        <span class="vault-label">免费入门</span>
        <strong>${escapeHtml(freeTitle)}</strong>
        <span class="vault-price">¥0</span>
        <span class="vault-link">先从这里开始 →</span>
      </a>
      <a class="vault-card vault-paid" href="${featuredPaid ? `/product/${encodeURIComponent(featuredPaid.sku.id)}` : "/store"}">
        <span class="vault-label">完整版本</span>
        <strong>${escapeHtml(paidTitle)}</strong>
        <span class="vault-price">${escapeHtml(paidPrice)}</span>
        <span class="vault-link">查看详情 →</span>
      </a>
      <span class="vault-meta">${freeItems.length} 个免费资源 · ${paidItems.length} 个付费商品</span>
    </div>
  </div>
  <div class="trust-strip">
    <div class="trust-item"><strong>人民币结算</strong><span>价格与实际支付一致</span></div>
    <div class="trust-item"><strong>支付宝付款</strong><span>结账页显示可用方式</span></div>
    <div class="trust-item"><strong>邮箱交付</strong><span>付款后发送下载链接</span></div>
    <div class="trust-item"><strong>规则透明</strong><span>退款与隐私政策可查</span></div>
  </div>
</section>`;
}

function deliverySection(): string {
  return `<section class="shell section" id="delivery">
  <div class="section-head">
    <div>
      <p class="eyebrow">交付方式</p>
      <h2>付款之后，链接会到你邮箱。</h2>
      <p class="lede">不需要注册账号。填写可用邮箱，完成支付宝付款，支付服务商确认后自动发送下载链接。</p>
    </div>
  </div>
  <div class="steps">
    <article class="step">
      <h3>选择商品</h3>
      <p>课程、电子书、模板都使用人民币标价。免费资源可以直接领取。</p>
    </article>
    <article class="step">
      <h3>支付宝付款</h3>
      <p>在商品页填写接收链接的邮箱，然后按结账页显示的付款方式完成支付。</p>
    </article>
    <article class="step">
      <h3>查收下载链接</h3>
      <p>付款确认后，链接会发送到邮箱。链接有有效期和下载次数限制，请及时保存。</p>
    </article>
  </div>
  <div class="panel">
    <h2>没有收到邮件？</h2>
    <p>先检查垃圾邮件目录，再用订单号在页脚查询订单状态。如果订单已付款但链接仍不可用，请携带订单号和付款邮箱联系支持。</p>
    <p>数字商品的退款规则见 <a href="/refund">退款政策</a>。付款即表示你同意 <a href="/terms">服务条款</a> 和 <a href="/privacy">隐私政策</a>。</p>
  </div>
</section>`;
}

function trustSection(): string {
  return `<section class="shell section">
  <div class="section-head">
    <div>
      <p class="eyebrow">放心购买</p>
      <h2>信息清楚，交付可追踪。</h2>
      <p class="lede">不制造虚假倒计时，不隐藏付款条件。商品页会写明价格、交付方式和退款规则。</p>
    </div>
  </div>
  <div class="trust-grid">
    <article class="trust-card">
      <h3>境内私有存储</h3>
      <p>数字文件存放在境内私有对象存储中，通过有期限的下载链接交付，不公开文件地址。</p>
    </article>
    <article class="trust-card">
      <h3>订单可查询</h3>
      <p>付款后使用订单号查询状态。重复支付通知不会生成第二份订单，也不会重复发送链接。</p>
    </article>
    <article class="trust-card">
      <h3>退款规则前置</h3>
      <p>数字文件交付后的退款限制写在购买前可见的退款政策里。未交付、文件损坏或重复扣款会单独处理。</p>
    </article>
    <article class="trust-card">
      <h3>本地化支持</h3>
      <p>中文页面、人民币价格、中国大陆交付说明。发票或批量采购需求可携带订单号联系支持。</p>
    </article>
  </div>
</section>`;
}

function faqSection(): string {
  const faqs = [
    {
      question: "付款后多久能收到下载链接？",
      answer:
        "支付服务商确认付款后会自动发送，通常在几分钟内到达。请同时检查垃圾邮件目录。如果长时间未收到，请用订单号查询状态或联系支持。",
    },
    {
      question: "需要注册账号吗？",
      answer:
        "不需要。结账时只需填写接收下载链接的邮箱。请使用你能长期访问的邮箱，订单查询也需要这个邮箱配合。",
    },
    {
      question: "支持哪些付款方式？",
      answer:
        "目前以支付宝为主。结账页只显示当前实际可用的付款方式。如果某个方式暂未开通，页面不会显示对应按钮。",
    },
    {
      question: "下载链接会一直有效吗？",
      answer:
        "不会。链接有有效期和下载次数限制，具体限制会在支付说明中提示。请付款后及时下载并自行备份。",
    },
    {
      question: "数字商品可以退款吗？",
      answer:
        "数字文件成功交付后通常不支持退款。未交付、文件损坏或重复扣款等情形按退款政策处理。购买前请阅读退款政策。",
    },
    {
      question: "美元商品在哪里购买？",
      answer:
        `本站只销售人民币商品。美元商品请前往国际站。`,
    },
  ];
  const items = faqs
    .map(
      (faq) => `<details>
  <summary>${escapeHtml(faq.question)}</summary>
  <p class="answer">${escapeHtml(faq.answer)}</p>
</details>`
    )
    .join("\n");
  return `<section class="shell section" id="faq">
  <div class="section-head">
    <div>
      <p class="eyebrow">常见问题</p>
      <h2>购买前先看清楚。</h2>
    </div>
  </div>
  <div class="faq">${items}</div>
</section>`;
}

function finalCta(): string {
  return `<section class="shell">
  <div class="cta-panel">
    <p class="eyebrow">先免费，再决定</p>
    <h2>从免费资源开始。</h2>
    <p>先领取一个免费 Agent、清单或课程片段，确认适合你的方向，再购买完整版本。</p>
    <a class="btn" href="/store">查看全部商品 <span aria-hidden="true">→</span></a>
  </div>
</section>`;
}

export function renderHome(items: ChinaCatalogItem[]): string {
  return layout({
    title: "首页",
    description:
      "示例商店：面向中文创作者的实战课程、电子书与模板。人民币标价，支付宝付款，邮箱交付下载链接。",
    body: `${hero(items)}
${homeFamilySection(items)}
${deliverySection()}
${trustSection()}
${faqSection()}
${finalCta()}`,
  });
}

export function renderStore(items: ChinaCatalogItem[]): string {
  return layout({
    title: "商品目录",
    description:
      "按课程、电子书和模板浏览 示例商店。人民币标价，支付宝付款，数字文件通过邮箱交付。",
    body: `<section class="shell">
  <div class="hero" style="padding-bottom:0">
    <span class="badge"><span class="badge-dot" aria-hidden="true"></span>全部商品</span>
    <h1>按你现在的需要，选一个入口。</h1>
    <p class="hero-lede">课程适合系统推进，电子书适合快速补齐一个主题，模板适合马上开始做。所有价格均为人民币。</p>
  </div>
  ${familyNav(items)}
  ${groupedCatalog(items)}
  <div class="cta-panel">
    <p class="eyebrow">不确定选哪个？</p>
    <h2>先从免费资源开始。</h2>
    <p>免费内容可以直接领取。确认方向后，再购买完整课程、电子书或模板。</p>
    <a class="btn" href="/#catalog">查看免费入口</a>
  </div>
</section>`,
  });
}

export function renderFamily(
  family: CatalogSku["family"],
  items: ChinaCatalogItem[]
): string {
  const familyItems = items.filter((item) => item.sku.family === family);
  const label = familyLabel(family);
  const offerCount = getChinaOfferCards(familyItems).length;
  return layout({
    title: label,
    description: `${label}：${FAMILY_INTROS[family]} 示例商店，人民币标价，支付宝付款，邮箱交付。`,
    body: `<section class="shell">
  <div class="hero" style="padding-bottom:0">
    <span class="badge"><span class="badge-dot" aria-hidden="true"></span>${escapeHtml(label)}</span>
    <h1>${escapeHtml(FAMILY_HEADLINES[family])}</h1>
    <p class="hero-lede">${escapeHtml(FAMILY_INTROS[family])}</p>
  </div>
  ${familyNav(items, family)}
  <div class="section-head">
    <div>
      <p class="eyebrow">${escapeHtml(label)}目录</p>
      <h2>${offerCount} 个主题，从免费入口开始。</h2>
      <p class="lede">每个主题都把免费入口和付费版本放在一起。先确认方向，再决定是否购买完整版本。</p>
    </div>
    <a class="btn btn-ghost" href="/store">查看全部商品</a>
  </div>
  ${offerGrid(familyItems)}
  <div class="cta-panel">
    <p class="eyebrow">还没决定？</p>
    <h2>先看免费入口。</h2>
    <p>免费资源可以直接领取。确认适合你的方向后，再购买完整版本。</p>
    <a class="btn" href="/">回到首页 <span aria-hidden="true">→</span></a>
  </div>
</section>`,
  });
}

function fulfillmentLabel(sku: CatalogSku): string {
  switch (sku.fulfillment) {
    case "external_access":
      return "外部访问";
    case "file_download":
      return "邮箱下载链接";
    case "email_delivery":
      return "邮箱交付";
    case "none":
      return "页面说明";
  }
}

function productSpecs(sku: CatalogSku): string {
  return `<div class="spec-list">
  <span class="spec"><strong>类型</strong>${typeLabels(sku)
    .map(escapeHtml)
    .join(" · ")}</span>
  <span class="spec"><strong>交付</strong>${escapeHtml(fulfillmentLabel(sku))}</span>
</div>`;
}

export function renderProduct({
  sku,
  error,
  payments = { alipay: true, wechat: false },
}: {
  sku: CatalogSku;
  error?: string;
  payments?: { alipay: boolean; wechat: boolean };
}): string {
  const free = sku.priceCents == null;
  const price = free ? "免费" : formatCny(sku.priceCents ?? null);
  const description = sku.description ?? DEFAULT_DESCRIPTION[sku.family];
  const item: ChinaCatalogItem = {
    groupId: sku.id,
    title: sku.title,
    description,
    format: sku.format,
    free,
    priceCents: sku.priceCents ?? null,
    priceLabel: price,
    sku,
  };
  const buttons = [
    payments.alipay
      ? `<button class="btn btn-block" type="submit" name="provider" value="alipay">使用支付宝支付 ${escapeHtml(price)}</button>`
      : "",
    payments.wechat
      ? `<button class="btn btn-block btn-wechat" type="submit" name="provider" value="wechat">使用微信支付 ${escapeHtml(price)}</button>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const action = free
    ? sku.externalUrl
      ? `<a class="btn btn-block" href="${escapeHtml(sku.externalUrl)}" rel="noopener">获取免费资源 <span aria-hidden="true">→</span></a>`
      : `<p class="notice">这是免费资源，无需付款。领取方式请以页面说明为准。</p>`
    : buttons
      ? `<form class="checkout-form" method="post" action="/checkout">
  <input type="hidden" name="productId" value="${escapeHtml(sku.id)}">
  <div class="field">
    <label for="email">接收下载链接的邮箱</label>
    <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="输入你常用的邮箱">
  </div>
  <div class="checkout-actions">${buttons}</div>
  <p class="buy-note">付款成功后，下载链接会发送到该邮箱。链接有有效期和下载次数限制。</p>
</form>`
      : `<p class="notice">该商品暂不可购买。</p>`;

  const deliveryCopy = free
    ? sku.fulfillment === "external_access"
      ? "免费资源无需付款；点击后会在外部页面打开。"
      : "免费资源无需付款；领取方式以页面说明为准。"
    : sku.fulfillment === "file_download"
      ? "付款确认后，系统会发送有期限的下载链接到结账邮箱。"
      : sku.fulfillment === "email_delivery"
        ? "付款确认后，访问方式会发送到结账邮箱。"
        : "该商品的交付方式以页面说明为准。";

  return layout({
    title: sku.title,
    description,
    body: `<div class="shell">
  <nav class="breadcrumb" aria-label="面包屑">
    <a href="/">首页</a><span aria-hidden="true">/</span>
    <a href="/store#${sku.family}">${escapeHtml(familyLabel(sku.family))}</a><span aria-hidden="true">/</span>
    <span>${escapeHtml(sku.title)}</span>
  </nav>
  <div class="product-layout">
    <div>
      <div class="product-cover">${cover(item)}</div>
      <div class="product-info">
        <p class="eyebrow">${typeLabels(sku)
          .map(escapeHtml)
          .join(" · ")}</p>
        <h1>${escapeHtml(sku.title)}</h1>
        <p class="lede">${escapeHtml(description)}</p>
        ${productSpecs(sku)}
      </div>
      <section class="panel">
        <h2>你将获得</h2>
        <ul>
          <li>${free ? "可直接领取的免费资源" : "完整的数字商品访问或下载权限"}</li>
          <li>付款后通过邮箱接收交付信息</li>
          <li>订单状态可凭订单号查询</li>
          <li>清晰的退款与隐私规则</li>
        </ul>
      </section>
      <section class="panel">
        <h2>交付说明</h2>
        <p>${escapeHtml(deliveryCopy)}</p>
        <p>请使用可长期访问的邮箱。若付款后未收到邮件，请先检查垃圾邮件目录，再用订单号查询订单状态，或携带订单号和付款邮箱联系支持。</p>
      </section>
    </div>
    <aside class="buy-panel" aria-label="购买信息">
      ${error ? `<div class="alert" role="alert">${escapeHtml(error)}</div>` : ""}
      <div class="buy-price-row">
        <strong class="price${free ? " price-free" : ""}">${escapeHtml(price)}</strong>
        <span>${free ? "免费资源" : "人民币含税价"}</span>
      </div>
      ${action}
      <div class="delivery-facts">
        <div class="delivery-fact"><span>交付方式</span><strong>${escapeHtml(fulfillmentLabel(sku))}</strong></div>
        <div class="delivery-fact"><span>是否需要账号</span><strong>不需要</strong></div>
        <div class="delivery-fact"><span>付款方式</span><strong>以结账页为准</strong></div>
      </div>
      <p class="legal-note">继续即表示你同意 <a href="/terms">服务条款</a>、<a href="/privacy">隐私政策</a> 和 <a href="/refund">退款政策</a>。</p>
    </aside>
  </div>
</div>`,
  });
}

export function renderWechatPay({
  orderId,
  codeUrl,
  qrSvg,
}: {
  orderId: string;
  codeUrl: string;
  qrSvg: string;
}): string {
  return layout({
    title: "微信支付",
    description: "使用微信扫描二维码完成付款。付款成功后，下载链接会发送到结账邮箱。",
    body: `<div class="shell pay-page">
  <p class="eyebrow">微信支付</p>
  <h1>打开微信，扫一扫。</h1>
  <p class="lede">付款成功后，下载链接会发送到结账邮箱。扫码后请不要关闭本页。</p>
  <div class="pay-card">
    <div class="qr-wrap">${qrSvg}</div>
    <p class="lede">请使用微信扫描二维码完成付款。</p>
    <ul class="pay-steps">
      <li>打开微信，点击右上角“扫一扫”。</li>
      <li>确认商品金额并完成付款。</li>
      <li>付款后回到本页查看订单状态。</li>
    </ul>
    <p class="buy-note">无法扫码？请复制此链接在微信中打开：</p>
    <code class="code-box">${escapeHtml(codeUrl)}</code>
    <p style="margin-top:20px"><a class="btn btn-secondary" href="/thanks?order=${encodeURIComponent(orderId)}">付款后查看订单状态</a></p>
  </div>
</div>`,
  });
}

export function renderReceipt(state: ReceiptState, orderId: string): string {
  return layout({
    title: "订单状态",
    description: "查询 示例商店订单状态和数字商品交付信息。",
    body: `<div class="shell receipt">
  <p class="eyebrow">${escapeHtml(state.eyebrow)}</p>
  <div class="receipt-card">
    <h1>${escapeHtml(state.heading)}</h1>
    <p class="lede">${escapeHtml(state.message)}</p>
    <div class="receipt-meta">
      <span>订单号</span>
      <code>${escapeHtml(orderId)}</code>
    </div>
    <div class="receipt-actions">
      <a class="btn" href="/store">返回商品目录</a>
      <a class="btn btn-secondary" href="/refund">查看退款政策</a>
    </div>
  </div>
</div>`,
  });
}

export function renderNotFound(message = "页面不存在。"): string {
  return layout({
    title: "未找到",
    description: "你访问的页面不存在。返回 示例商店继续浏览商品。",
    body: `<div class="shell not-found">
  <p class="eyebrow">404</p>
  <h1>这个页面不在了。</h1>
  <p class="lede">${escapeHtml(message)}</p>
  <div class="hero-actions">
    <a class="btn" href="/store">返回商品目录</a>
    <a class="btn btn-ghost" href="/">回到首页</a>
  </div>
</div>`,
  });
}

const LEGAL: Record<"terms" | "privacy" | "refund", { title: string; body: string }> = {
  terms: {
    title: "服务条款",
    body: `
<h2>适用范围</h2>
<p>本店面向中国大陆用户销售数字产品，价格以人民币显示。付款方式以结账页面显示的可用选项为准。</p>
<h2>订单与交付</h2>
<p>付款成功后，订单进入已付款状态。数字文件通过私有存储和有期限的下载链接交付。下载链接会发送到结账时填写的邮箱。请确保邮箱可用。</p>
<h2>使用许可</h2>
<p>购买行为授予你个人使用许可。未经书面许可，不得转售、公开发布或再次分发数字文件。</p>
<h2>价格与税费</h2>
<p>页面显示的价格为人民币含税价。支付服务商可能按其规则收取通道费用，本店不额外收取。</p>
<h2>联系</h2>
<p>订单问题请提供订单号和付款邮箱，通过主站支持渠道联系我们。</p>`,
  },
  privacy: {
    title: "隐私政策",
    body: `
<h2>我们收集什么</h2>
<p>结账时收集邮箱地址、订单金额、商品编号和支付交易号。我们不保存银行卡号或支付平台登录凭据。</p>
<h2>数据存放在哪里</h2>
<p>订单数据存放在位于中国大陆的腾讯云数据库。数字文件存放在腾讯云私有对象存储。邮件通过腾讯云邮件服务发送。</p>
<h2>数据用途</h2>
<p>我们使用这些数据完成付款确认、文件交付、退款处理、防止重复交付和满足法律要求。</p>
<h2>保留期限</h2>
<p>订单和税务记录按法律要求保留。下载令牌到期后失效。你可以通过支持渠道请求查询或更正邮箱信息。</p>
<h2>共享</h2>
<p>我们只向支付服务商、腾讯云等完成交易所必需的服务商提供最少信息，不出售个人信息。</p>`,
  },
  refund: {
    title: "退款政策",
    body: `
<h2>数字产品退款</h2>
<p>数字文件一经成功下载，通常不支持退款。若文件无法交付、文件损坏或重复扣款，请在付款后 7 天内联系我们。</p>
<h2>未交付</h2>
<p>如果付款成功但未收到下载链接，请先用订单号查询订单状态。确认未交付后，我们会补发链接或按原支付方式退款。</p>
<h2>重复付款</h2>
<p>同一订单重复扣款会全额退回重复部分。支付通知重复到达不会被当作新订单处理。</p>
<h2>处理时间</h2>
<p>退款审核通过后，款项由原支付渠道退回。到账时间以支付服务商和发卡机构为准。</p>`,
  },
};

export function renderLegal(kind: keyof typeof LEGAL): string {
  const page = LEGAL[kind];
  return layout({
    title: page.title,
    description: `示例商店${page.title}。人民币数字商品购买、交付、退款与隐私说明。`,
    body: `<div class="shell legal-wrap">
  <nav class="breadcrumb" aria-label="面包屑">
    <a href="/">首页</a><span aria-hidden="true">/</span><span>${escapeHtml(page.title)}</span>
  </nav>
  <article class="legal-card">
    <p class="eyebrow">法律信息</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p class="legal-meta"><span>最后更新：2026 年 11 月</span><span>适用站点：示例商店</span></p>
    ${page.body}
  </article>
</div>`,
  });
}
