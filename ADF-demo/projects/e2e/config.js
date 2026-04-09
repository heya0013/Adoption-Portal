// projects/e2e/config.js

const fmt = (v) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : Number(v).toLocaleString("en-US");

export default {
  id: "e2e",
  name: "E2E Buy Ahead – Usage",
  description: "E2E Buy Ahead usage by Function.",

  dataUrl: "./projects/e2e/data.json",

  // ✅ schema-driven（Function 是唯一维度）
  schema: {
    dimensions: [
      {
        field: "Function",   // ✅ 数据列名
        label: "Function",    // ✅ UI 显示名
        default: "Total"      // ✅ 默认选中
      }
    ]
  },

  metrics: ["UV", "PV"],
  primaryMetric: "UV",

  // ✅ UV / PV 两个图
  splitCharts: true,

  palette: {
    "UV": "#26c6da",
    "PV": "#7c5cff"
  },

  valueFormatter: fmt,

  // ✅ 不再做 geo / brand 映射，数据按原列名走
  adapter: (raw) => raw
};