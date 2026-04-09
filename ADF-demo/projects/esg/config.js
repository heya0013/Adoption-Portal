// projects/esg/config.js
// ESG Platform – module cards with REAL mini line charts (used by app-core extension)

const fmt = (v) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : Number(v).toLocaleString("en-US");

// 用于判断时间先后（2025 / FY2526 Q3 等）
const rankLabel = (label) => {
  if (!label) return 0;
  const s = String(label);

  const fyq = s.match(/FY\s*(\d{4})\s*Q(\d)/i);
  if (fyq) return Number(fyq[1]) * 10 + Number(fyq[2]);

  const fy = s.match(/FY\s*(\d{4})/i);
  if (fy) return Number(fy[1]) * 10;

  const y = s.match(/(20\d{2})/);
  if (y) return Number(y[1]) * 10;

  return 0;
};

export default {
  id: "esg",
  name: "ESG Platform – Usage Adoption",
  description: "ESG platform usage adoption by functional module.",

  dataUrl: "./projects/esg/data.json",

  // ✅ 模块化视图（不会显示 KPI / Detail）
  viewMode: "module",

  hideFilters: true,

  // ✅ 开启 module 卡片内 mini 折线图（app-core 会识别这个字段）
  moduleMiniCharts: true,

  // ✅ mini 折线图颜色（按 base metric 名称）
  moduleChartPalette: {
    "Vendor Group Amount": "#26c6da",
    "ESG Scorecard Indicator Amount": "#f6c343",
    "Part Data Collect Amount": "#7c5cff",
    "MAU Amount": "#ff5c5c"
  },

  // ✅ 控制卡片内文本行的展示顺序
  metrics: [
    // ESG Platform
    "Vendor Group Amount (2026)",
    "Vendor Group Amount (2025)",
    "ESG Scorecard Indicator Amount (2026)",
    "ESG Scorecard Indicator Amount (2025)",

    // LCA
    "Part Data Collect Amount (FY2526)",
    "Part Data Collect Amount (FY2425)",

    // GDM
    "MAU Amount (FY2526 Q3)",
    "MAU Amount (FY2526 Q1)"
  ],

  valueFormatter: fmt,

  // ✅ adapter：只做一件事 —— 规范化数据
  // mini 折线图的数据聚合 & 渲染全部由 app-core 处理
  adapter: (raw) =>
    (raw ?? []).map(r => ({
      geo: r.geo ?? "All",
      brand: r.brand,           // ESG Platform / LCA / GDM
      metric: r.metric,         // e.g. "Vendor Group Amount (2026)"
      value: typeof r.value === "string" ? Number(r.value) : r.value
    }))
};

