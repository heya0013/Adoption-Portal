const pct = (v) => (v == null || Number.isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";

export default {
  id: "adf",
  name: "Advanced Demand Forecast User Adoption",
  description: "ADF adoption tracking (Proposed/Adopted + FA metrics).",
  dataUrl: "./projects/adf/data.json",

  // ✅ KPI/曲线指标定义（决定 KPI 标题 & 曲线图系列）
  metrics: ["Proposed %", "Adopted %", "Planner FA", "ADF FA"],

  // ✅ 默认选中（筛选后右侧详情默认显示哪个指标）
  primaryMetric: "ADF FA",

  // ✅ 每个指标的颜色（可选）
  palette: {
    "Proposed %": "#7c5cff",
    "Adopted %": "#26c6da",
    "Planner FA": "#f6c343",
    "ADF FA": "#ff5c5c"
  },

  // ✅ KPI/详情的格式化
  valueFormatter: pct,

  // ✅ 适配器：把你的 data.json 转成 app-core 需要的统一结构
  // 统一结构：{ geo, brand, date:'YYYY-MM-DD', metric, value }
  adapter: (raw) => {
    return (raw || []).map(r => ({
      geo: r.geo ?? r.GEO ?? r.Geo,
      brand: r.brand ?? r.Brand,
      date: r.date ?? r.Date,
      metric: r.metric ?? r.Metric,
      value: typeof r.value === "string" ? Number(r.value) : r.value
    })).filter(p => p.geo && p.brand && p.date && p.metric);
  }
};