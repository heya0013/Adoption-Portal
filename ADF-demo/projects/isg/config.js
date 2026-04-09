// projects/isg/config.js

const count = (v) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : Math.round(v).toLocaleString();

export default {
  id: "isg",
  name: "ISG Integration – Usage Adoption",
  description: "ISG integration usage adoption by functional module.",

  dataUrl: "./projects/isg/data.json",

  // ✅ 告诉 app-core：这是模块化项目
  viewMode: "module",

  hideFilters: true,

  // Usage 指标
  metrics: ["Active Users", "PV/Day"],

  primaryMetric: "Active Users",

  palette: {
    "Active Users": "#7c5cff",
    "PV/Day": "#26c6da"
  },

  valueFormatter: count,

  adapter: (raw) => {
    return (raw || []).map(r => ({
      geo: r.geo,
      brand: r.brand,     // 模块名
      metric: r.metric,
      date: r.date,
      value: r.value,
      status: r.status    // ✅ need track after business go live
    }));
  }
};