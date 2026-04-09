// app-core.v2.js — multi-project portal (timeseries + module view)
// - Timeseries view: line chart + KPI cards + Selection Details
// - Module view (cfg.viewMode === "module"): hides KPI & Selection Details; shows module cards only

export function initPortal({ projects, defaultProjectId }) {
  const $ = (id) => document.getElementById(id);

  const chartEl = $("chart");
  const moduleEl = $("moduleContainer");
  const projectListEl = $("projectList");
  const kpiSection = $("kpiSection");
  const detailSection = $("detailSection");
  const controlsSection = document.querySelector(".controls");

  // ---- state ----
  let currentProjectId = defaultProjectId;
  let cfg = projects[currentProjectId];
  // ---------- Schema-driven dimension support (E2E: Function) ----------
  function getSchemaDims() {
    const dims = cfg?.schema?.dimensions;
    return Array.isArray(dims) ? dims : null;
  }

  // 让筛选器 UI 从 geo/brand 变成 Function（或其他维度）
  // 说明：当前 HTML 固定只有两个下拉（#geo/#brand），这里用“复用”的方式适配
  function applyDimensionUI() {
    const dims = getSchemaDims();

    const geoSelect = document.getElementById("geo");
    const brandSelect = document.getElementById("brand");

    const geoControl = geoSelect?.closest(".control");
    const brandControl = brandSelect?.closest(".control");

    const geoLabelEl = geoControl?.querySelector("label");
    const brandLabelEl = brandControl?.querySelector("label");

    // Selection Details 的 key（左列）
    const kvKeys = Array.from(document.querySelectorAll("#detailSection .kv .k"));
    const keyGeo = kvKeys[1];
    const keyBrand = kvKeys[2];

    // Selection Details 的 value（右列）
    const valBrand = document.getElementById("sBrand");

    // --- 没有 schema：回到默认 GEO/Brand ---
    if (!dims || dims.length === 0) {
      if (geoLabelEl) geoLabelEl.textContent = "GEO";
      if (brandLabelEl) brandLabelEl.textContent = "Brand";
      if (brandControl) brandControl.style.display = "";
      if (keyGeo) { keyGeo.textContent = "GEO"; keyGeo.style.display = ""; }
      if (keyBrand) { keyBrand.textContent = "Brand"; keyBrand.style.display = ""; }
      if (valBrand) valBrand.style.display = "";
      return;
    }

    // --- dims[0] 复用 geo 下拉 ---
    const label1 = dims[0].label || dims[0].field || "Dimension";
    if (geoLabelEl) geoLabelEl.textContent = label1;
    if (keyGeo) { keyGeo.textContent = label1; keyGeo.style.display = ""; }

    // --- 只有 1 个维度：隐藏 brand 控件 + 详情中的 Brand 行 ---
    if (dims.length === 1) {
      if (brandControl) brandControl.style.display = "none";
      if (keyBrand) keyBrand.style.display = "none";
      if (valBrand) valBrand.style.display = "none";
      return; // ✅ 关键：别再执行后面 dims[1] 的逻辑
    }

    // --- dims >=2：显示 brand 并设置 label ---
    const label2 = dims[1].label || dims[1].field || "Dimension 2";
    if (brandControl) brandControl.style.display = "";
    if (brandLabelEl) brandLabelEl.textContent = label2;
    if (keyBrand) { keyBrand.textContent = label2; keyBrand.style.display = ""; }
    if (valBrand) valBrand.style.display = "";
  }
  let RAW = [];
  let currentDates = [];
  let currentSeries = [];
  
     // ---- mini charts for module cards ----
  let miniChartInstances = [];

  function disposeMiniCharts() {
    miniChartInstances.forEach(ins => { try { ins.dispose(); } catch(e) {} });
    miniChartInstances = [];
  }

  function parseMetric(metric) {
    // "Vendor Group Amount (2026)" -> { base:"Vendor Group Amount", label:"2026" }
    const m = String(metric).match(/^(.*)\s*\(([^)]+)\)\s*$/);
    if (!m) return null;
    return { base: m[1].trim(), label: m[2].trim() };
  }

  function rankLabel(label) {
    if (!label) return 0;
    const s = String(label);

    const fyq = s.match(/FY\s*(\d{4})\s*Q(\d)/i);
    if (fyq) return Number(fyq[1]) * 10 + Number(fyq[2]);

    const fy = s.match(/FY\s*(\d{4})/i);
    if (fy) return Number(fy[1]) * 10;

    const y = s.match(/(20\d{2})/);
    if (y) return Number(y[1]) * 10;

    return 0;
  }

  // ---- helpers ----
  const uniq = (arr) => [...new Set(arr)];
  const isNum = (v) => v !== null && v !== undefined && !Number.isNaN(v);
  const fmt = (v) => (cfg?.valueFormatter ? cfg.valueFormatter(v) : (v ?? "—"));

  const toTime = (d) => {
    if (!d || d === "NA") return NaN;
    const t = Date.parse(d);
    return Number.isNaN(t) ? NaN : t;
  };

  /* ---------- KPI visibility (hide extra cards) ---------- */
  function applyKpiVisibility() {
    const count = (cfg?.metrics || []).length;

    const cards = [
      $("k1")?.closest(".kpiCard"),
      $("k2")?.closest(".kpiCard"),
      $("k3")?.closest(".kpiCard"),
      $("k4")?.closest(".kpiCard"),
    ];

    cards.forEach((card, idx) => {
      if (!card) return;
      // 只显示需要的 KPI，其余直接隐藏
      card.style.display = idx < count ? "" : "none";
    });
  }

  // ---- chart ----
  const chart = echarts.init(chartEl);
  window.addEventListener("resize", () => chart.resize());

  /* ---------- View mode ---------- */
  function applyViewMode() {
    const isModule = cfg?.viewMode === "module";

    // KPI / Detail（你之前已经有）
    if (kpiSection) kpiSection.style.display = isModule ? "none" : "";
    if (detailSection) detailSection.style.display = isModule ? "none" : "";

    // ✅ 新增：是否隐藏筛选条（GEO / Brand / Start / End）
    if (controlsSection) {
      controlsSection.style.display = cfg?.hideFilters ? "none" : "";
    }
  }

  /* ---------- Trend rendering ---------- */
  function trendHTML(delta) {
    if (!isNum(delta)) return '<span class="trendFlat">—</span>';
    if (delta > 0) return `<span class="trendUp">▲ ${(delta * 100).toFixed(1)}%</span>`;
    if (delta < 0) return `<span class="trendDown">▼ ${(-delta * 100).toFixed(1)}%</span>`;
    return '<span class="trendFlat">—</span>';
  }

  /* ---------- Header & KPI ---------- */
  function setHeader() {
    $("pageTitle").textContent = cfg?.name ?? currentProjectId;
    $("pageDesc").textContent = cfg?.description ?? "";
    $("sProject").textContent = cfg?.name ?? currentProjectId;
  }

  function setKpiTitles() {
    const m = cfg?.metrics ?? [];
    $("k1t").textContent = m[0] ?? "—";
    $("k2t").textContent = m[1] ?? "—";
    $("k3t").textContent = m[2] ?? "—";
    $("k4t").textContent = m[3] ?? "—";
  }

  function setKpisAtIndex(idx) {
    if (cfg?.viewMode === "module") return;
    $("k1").textContent = fmt(currentSeries[0]?.data?.[idx]);
    $("k2").textContent = fmt(currentSeries[1]?.data?.[idx]);
    $("k3").textContent = fmt(currentSeries[2]?.data?.[idx]);
    $("k4").textContent = fmt(currentSeries[3]?.data?.[idx]);
  }

  function setSelection(idx, metricName) {
    if (cfg?.viewMode === "module") return;

    const s = currentSeries.find((x) => x.name === metricName);
    if (!s) return;

    const value = s.data[idx];
    const prev = idx > 0 ? s.data[idx - 1] : null;

    // ✅ Trend: 本月相对上月的百分比变化
    let deltaPct = null;
    if (isNum(value) && isNum(prev) && prev !== 0) {
      deltaPct = (value - prev) / prev;
    }

    const brandControl = document.getElementById("brand")?.closest(".control");
    const brandHidden = brandControl && brandControl.style.display === "none";

    $("sGeo").textContent = $("geo").value || "All";
    $("sBrand").textContent = brandHidden ? "—" : ($("brand").value || "All");
    $("sMetric").textContent = metricName;
    $("sDate").textContent = currentDates[idx] ?? "—";
    $("sValue").textContent = fmt(value);

    // ✅ 这里必须用 deltaPct（你原来写成了 delta）
    $("sTrend").innerHTML = trendHTML(deltaPct);
  }


  /* ---------- Timeseries view ---------- */
  
  function renderTimeseries(points) {
    chartEl.style.display = "block";
    if (moduleEl) moduleEl.style.display = "none";

    const dates = uniq(points.map(p => p.date)).sort();
    currentDates = dates;

    /* ========== splitCharts：一个 metric 一个子图 ========== */
    if (cfg.splitCharts) {
      chart.clear();

      const seriesByMetric = {};
      cfg.metrics.forEach(m => seriesByMetric[m] = []);
      points.forEach(p => {
        if (seriesByMetric[p.metric]) {
          seriesByMetric[p.metric].push(p);
        }
      });

      const grids = [];
      const xAxes = [];
      const yAxes = [];
      const series = [];

      cfg.metrics.forEach((m, idx) => {
        grids.push({
          left: 60,
          right: 20,
          top: idx * 240 + 40,
          height: 160
        });

        xAxes.push({
          type: "category",
          gridIndex: idx,
          data: dates
        });

        yAxes.push({
          type: "value",
          gridIndex: idx
        });

        const map = {};
        seriesByMetric[m].forEach(p => map[p.date] = p.value);

        const s = {
          name: m,
          type: "line",
          xAxisIndex: idx,
          yAxisIndex: idx,
          data: dates.map(d => map[d] ?? null),
          smooth: true,
          lineStyle: { width: 3 },
          itemStyle: { color: cfg.palette?.[m] }
        };

        series.push(s);
      });

      currentSeries = series;

      chart.setOption({
        tooltip: { trigger: "axis" },
        title: cfg.metrics.map((m, idx) => ({
          text: m,                 // ✅ 显示 UV / PV
          left: "center",
          top: idx * 240 + 10,     // ✅ 对应每个子图
          textStyle: {
            fontSize: 12,
            fontWeight: 700,
            color: "#fff"
          }
        })),
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series
      }, true);

    } else {
      /* ========== 单图（ADF 默认） ========== */
      const map = {};
      cfg.metrics.forEach(m => map[m] = {});
      points.forEach(p => {
        if (map[p.metric]) map[p.metric][p.date] = p.value;
      });

      const series = cfg.metrics.map(m => ({
        name: m,
        type: "line",
        data: dates.map(d => map[m][d] ?? null),
        smooth: true,
        lineStyle: { width: 3 },
        itemStyle: { color: cfg.palette?.[m] }
      }));

      currentSeries = series;

      chart.setOption({
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: dates },
        yAxis: { type: "value" },
        series
      }, true);
    }

    /* ========== ⭐ 关键：点击交互（你之前缺的部分） ========== */
    chart.off("click");
    chart.on("click", (params) => {
      // params.seriesName: metric
      // params.dataIndex: 日期索引
      const idx = params.dataIndex;
      const metric = params.seriesName;

      setKpisAtIndex(idx);
      setSelection(idx, metric);
    });

    /* ========== ⭐ 默认选中：主指标 + 最后一天 ========== */
    const lastIdx = dates.length - 1;
    const defaultMetric = cfg.primaryMetric || cfg.metrics[0];

    if (lastIdx >= 0 && defaultMetric) {
      setKpisAtIndex(lastIdx);
      setSelection(lastIdx, defaultMetric);
    }
  }



/* ---------- Module view (cards + mini charts) ---------- */
  function renderModules(points) {
    // module view: show cards, hide main chart
    chartEl.style.display = "none";
    if (!moduleEl) return;

    // dispose previous mini charts
    disposeMiniCharts();

    moduleEl.style.display = "grid";
    moduleEl.innerHTML = "";

    const groups = uniq(points.map(p => p.brand)).filter(Boolean);

    if (groups.length === 0) {
      moduleEl.innerHTML = `<div style="color:rgba(255,255,255,.62); padding:12px;">No data.</div>`;
      return;
    }

    groups.forEach((name) => {
      const rows = points.filter(p => p.brand === name);

      const card = document.createElement("div");
      card.className = "moduleCard";
      card.style.cssText =
        "border:1px solid rgba(255,255,255,.10); border-radius:14px; padding:12px; background: rgba(255,255,255,.04); box-shadow: 0 6px 18px rgba(0,0,0,.22);";

      const title = document.createElement("div");
      title.style.cssText = "font-weight:800; margin-bottom:8px;";
      title.textContent = name;
      card.appendChild(title);

      const body = document.createElement("div");
      body.style.cssText = "font-size:12px; line-height:1.55; color: rgba(255,255,255,.92);";

      // 先按 cfg.metrics 排序，再补充数据里出现但未列入的 metric
      const metricOrder = uniq([...(cfg.metrics ?? []), ...rows.map(r => r.metric)]).filter(Boolean);

      metricOrder.forEach((mn) => {
        const r = rows.find(x => x.metric === mn);
        if (!r) return;

        const line = document.createElement("div");
        line.style.cssText =
          "display:flex; justify-content:space-between; gap:12px; padding:4px 0; border-bottom:1px dashed rgba(255,255,255,.08);";

        const k = document.createElement("span");
        k.style.color = "rgba(255,255,255,.62)";
        k.textContent = mn;

        const v = document.createElement("span");
        v.style.fontWeight = "750";
        v.textContent = (r.value != null) ? fmt(r.value) : (r.status ?? "—");

        line.appendChild(k);
        line.appendChild(v);
        body.appendChild(line);
      });

      card.appendChild(body);

      // ✅ mini charts: only if enabled in config
      if (cfg.moduleMiniCharts) {
        // group by base metric (strip "(...)" label)
        const byBase = {};
        rows.forEach(r => {
          const p = parseMetric(r.metric);
          if (!p) return;
          if (typeof r.value !== "number" || Number.isNaN(r.value)) return;

          (byBase[p.base] ||= []).push({ label: p.label, value: r.value });
        });

        // chart container
        const chartsWrap = document.createElement("div");
        chartsWrap.style.cssText = "margin-top:10px; display:flex; flex-direction:column; gap:10px;";

        Object.keys(byBase).forEach(base => {
          const arr = byBase[base];
          if (!arr || arr.length < 2) return;

          const sorted = [...arr].sort((a,b) => rankLabel(a.label) - rankLabel(b.label));
          const labels = sorted.map(x => x.label);
          const values = sorted.map(x => x.value);

          const rowWrap = document.createElement("div");
          rowWrap.style.cssText = "display:flex; flex-direction:column; gap:6px;";

          const cap = document.createElement("div");
          cap.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:11px; color:rgba(255,255,255,.62);";
          cap.innerHTML = `<span>${base}</span><span>${fmt(values[0])} → ${fmt(values[values.length-1])}</span>`;
          rowWrap.appendChild(cap);

          const cdiv = document.createElement("div");
          cdiv.style.cssText = "width:100%; height:56px; border:1px solid rgba(255,255,255,.08); border-radius:10px; background: rgba(0,0,0,.10);";
          rowWrap.appendChild(cdiv);

          chartsWrap.appendChild(rowWrap);

          // init echarts mini line
          const ins = echarts.init(cdiv);

          const color =
            (cfg.moduleChartPalette && cfg.moduleChartPalette[base]) ||
            (cfg.palette && cfg.palette[base]) ||
            "#7c5cff";

          ins.setOption({
            grid: { left: 8, right: 8, top: 6, bottom: 6 },
            xAxis: {
              type: "category",
              data: labels,
              boundaryGap: false,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: { show: false },
              splitLine: { show: false }
            },
            yAxis: {
              type: "value",
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: { show: false },
              splitLine: { show: false }
            },
            tooltip: { show: false },
            series: [{
              type: "line",
              data: values,
              smooth: true,
              symbol: "circle",
              symbolSize: 6,
              lineStyle: { width: 2, color },
              itemStyle: { color },
              areaStyle: { color, opacity: 0.12 }
            }]
          }, true);

          miniChartInstances.push(ins);
        });

        // only append if any charts created
        if (chartsWrap.childElementCount > 0) {
          card.appendChild(chartsWrap);
        }
      }

      moduleEl.appendChild(card);
    });
  }
  /* ---------- Filters / Apply ---------- */
  function apply() {
    const g = $("geo").value;
    const b = $("brand").value;
    const brandControl = document.getElementById("brand")?.closest(".control");
    const brandHidden = brandControl && brandControl.style.display === "none";
    const start = $("start").value;
    const end = $("end").value;

    const t0 = toTime(start);
    const t1 = toTime(end);

    const pts = RAW.filter((p) => {
      const okGeo = !g || p.geo === g;
      const okBrand = brandHidden ? true : (!b || p.brand === b);

      if (start || end) {
        const tp = toTime(p.date);
        if (!Number.isNaN(tp)) {
          const okStart = !start || tp >= t0;
          const okEnd = !end || tp <= t1;
          return okGeo && okBrand && okStart && okEnd;
        }
      }
      return okGeo && okBrand;
    });

    if (cfg.viewMode === "module") renderModules(pts);
    else renderTimeseries(pts);
  }

  /* ---------- Project list / switch ---------- */
  function renderProjectList() {
    if (!projectListEl) return;
    projectListEl.innerHTML = "";

    Object.keys(projects).forEach((pid) => {
      const p = projects[pid];
      const btn = document.createElement("button");
      btn.className = "projectBtn" + (pid === currentProjectId ? " active" : "");
      btn.innerHTML = `
        <span class="name">${p?.name ?? pid}</span>
        <span class="tag">${p?.tag ?? ""}</span>
      `;
      btn.onclick = () => switchProject(pid);
      projectListEl.appendChild(btn);
    });
  }

  async function switchProject(pid) {
    if (!projects[pid]) return;
    currentProjectId = pid;
    cfg = projects[currentProjectId];

    try { chart.clear(); } catch (e) {}

    applyViewMode();
    renderProjectList();
    await loadData();
  }

  /* ---------- Load ---------- */
  async function loadData() {
    applyViewMode();
    setHeader();
    setKpiTitles();
    applyDimensionUI();
    applyKpiVisibility();

    // lastUpdated (best-effort)
    const lu = $("lastUpdated");
    if (lu) {
      const tsText = new Date().toLocaleString("zh-CN", { hour12: false });
      lu.textContent = `lastUpdated: ${tsText}`;
    }

    try {
      const res = await fetch(cfg.dataUrl, { cache: "no-store" });
      const rawJson = await res.json();
      const adapted = cfg.adapter ? cfg.adapter(rawJson) : (rawJson ?? []);

// ✅ 先根据 schema 做标准化：把维度字段映射到 geo/brand（保持你现有 apply / setSelection / renderTimeseries 不用大改）
      const dims = getSchemaDims();
      const normalized = (adapted ?? []).map((row) => {
        // 已经是统一结构（比如 ADF/ESG/ISG）就直接用
        if (row && (row.geo || row.brand)) return row;

        // schema-driven：E2E 的 row 里是 Function/date/metric/value [1](https://lenovo-my.sharepoint.com/personal/heyx8_lenovo_com/Documents/Microsoft%20Copilot%20Chat%20%E6%96%87%E4%BB%B6/data.json)[2](https://lenovo-my.sharepoint.com/personal/heyx8_lenovo_com/Documents/Microsoft%20Copilot%20Chat%20%E6%96%87%E4%BB%B6/config.js)
        if (dims && dims.length >= 1) {
          const d1Field = dims[0].field;              // "Function"
          const d2Field = dims[1]?.field;             // 可能不存在
          return {
            ...row,
            geo: row?.[d1Field],                      // geo 复用成 Function
            brand: d2Field ? row?.[d2Field] : "__ALL__", // 只有1维时给个占位，后续会隐藏 brand UI
          };
        }

        return row;
      });

      // module view allows missing date
      if (cfg.viewMode === "module") {
        RAW = (normalized ?? []).filter((p) => p.geo && p.brand && p.metric);
      } else {
        RAW = (normalized ?? []).filter((p) => p.geo && p.brand && p.metric && p.date);
      }

      const geos = uniq(RAW.map((p) => p.geo)).filter(Boolean).sort();
      const brands = uniq(RAW.map((p) => p.brand)).filter(Boolean).sort();

      $("geo").innerHTML =
        `<option value="">All</option>` + geos.map((x) => `<option value="${x}">${x}</option>`).join("");
      $("brand").innerHTML =
        `<option value="">All</option>` + brands.map((x) => `<option value="${x}">${x}</option>`).join("");
      if (cfg.defaultBrand) {
        $("brand").value = cfg.defaultBrand;
      }
      const dates = uniq(RAW.map((p) => p.date)).filter((d) => !Number.isNaN(toTime(d))).sort();
      if (dates.length > 0) {
        $("start").value = dates[0];
        $("end").value = dates[dates.length - 1];
      } else {
        $("start").value = "";
        $("end").value = "";
      }

      apply();
    } catch (e) {
      chartEl.style.display = "none";
      if (moduleEl) {
        moduleEl.style.display = "block";
        moduleEl.innerHTML = `<div style="color:#ffb3b3; padding:12px;">Load failed: ${String(e)}</div>`;
      }
    }
  }

  // Bind events
  $("apply").onclick = apply;
  $("geo").onchange = apply;
  $("brand").onchange = apply;
  const resetBtn = $("reset");
  if (resetBtn) resetBtn.onclick = () => loadData();

  // init
  renderProjectList();
  applyViewMode();
  loadData();
}
