// AfterAI VPP — recorded-run player (vpp-repo ADR-089).
// Plays back recorded values only: no control computation runs here. Every
// run carries its provenance label; playback faster than 1× says so on screen.
(function () {
    "use strict";

    var BASE = window.VPP_DEMO_BASE || "/assets/vpp-demo/";
    var SPEEDS = [1, 10, 60];
    var SITE_COLORS = ["#2a78d6", "#008300", "#d55181", "#c98500"];
    var FLEET_COLOR = "#7a4fd1";
    var PHASES = {
        "baseline": "基準（50.00 Hz）",
        "abnormal-step": "異常時ステップ",
        "back-to-nominal": "基準へ復帰",
        "hold-both-healthy": "保持（両拠点正常）",
        "back-at-nominal-hold": "基準で保持"
    };
    var VERDICTS = {
        within: "2 秒以内",
        exceeds: "2 秒超",
        inconclusive: "判定不能（区間が 2 秒をまたぐ）",
        unmeasured: "遅れ時間を測定できず"
    };

    function verdictLabel(d) {
        if (d.verdict === "no-output-change") {
            return Math.abs(d.freq_mhz - 50000) <= 10 ? "出力変化なし（不感帯の内側）" : "出力変化なし";
        }
        return VERDICTS[d.verdict];
    }

    // Pattern b's phases are named for the step: over-30 / down-50 /
    // nominal-after-….
    function phaseLabel(phase) {
        if (PHASES[phase]) { return PHASES[phase]; }
        var m = /^(over|down)-(\d+)$/.exec(phase);
        if (m) { return (m[1] === "over" ? "+" : "−") + m[2] + " mHz"; }
        if (/^nominal-after-/.test(phase)) { return "基準へ復帰"; }
        return phase;
    }

    var state = { run: null, cursor: 0, playing: false, speed: 10, last: null, charts: [], generation: 0 };

    // ---- data access -------------------------------------------------------

    function fetchJson(path) {
        return fetch(BASE + path).then(function (r) {
            if (!r.ok) { throw new Error(path + ": " + r.status); }
            return r.json();
        });
    }

    // Index of the last element of sorted `arr` that is <= t, or -1.
    function floorIndex(arr, t) {
        var lo = 0, hi = arr.length - 1, ans = -1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (arr[mid] <= t) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        return ans;
    }

    function stepValue(steps, t) {
        var v = null;
        for (var i = 0; i < steps.length && steps[i][0] <= t; i++) { v = steps[i]; }
        return v;
    }

    // A site's recorded sample at the cursor, or null when there is none close
    // enough (a stopped EMS, or rows that never arrived).
    function sampleAt(site, t, tolDs) {
        var s = site.series;
        var i = floorIndex(s.t_ds, t);
        if (i < 0 || t - s.t_ds[i] > tolDs) { return null; }
        return {
            freq: s.freq_mhz[i], requested: s.requested_w[i], actual: s.actual_w[i],
            soc: s.soc_pml[i], avail: s.p_avail_w[i]
        };
    }

    function inDown(run, siteId, t) {
        return run.downs.some(function (d) { return d.site === siteId && d.start_ds < t && t < d.end_ds; });
    }

    // Recorded runs carry DERMS's published assignments; field runs carry
    // values read back from the curve, null where they cannot be told.
    // Field runs carry the inference as change points over every sample, so
    // a step holds exactly while its samples can be inferred; with no sample
    // at the cursor there is nothing to infer from.
    function assignmentAt(run, site, t) {
        if (run.assignment_source === "recorded") {
            var a = stepValue(site.assignment, t);
            return a ? { value: a[1], inferred: false } : null;
        }
        if (!sampleAt(site, t, 5)) { return { value: null, inferred: true }; }
        var step = stepValue(site.assignment_inferred, t);
        return { value: step ? step[1] : null, inferred: true };
    }

    function cutWindow(run, siteId) {
        if (!run.events) { return null; }
        var cut = null, restore = null;
        run.events.forEach(function (e) {
            if (e[1] === "cut " + siteId) { cut = e[0]; }
            if (e[1] === "restore " + siteId) { restore = e[0]; }
        });
        return cut === null ? null : [cut, restore === null ? Infinity : restore];
    }

    // ---- formatting --------------------------------------------------------

    function kw(w) { return w === null || w === undefined ? "—" : (w / 1000).toFixed(1) + " kW"; }
    function hz(mhz) { return (mhz / 1000).toFixed(2) + " Hz"; }
    function clock(ds) {
        var s = Math.max(0, Math.floor(ds / 10));
        return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }
    function el(tag, attrs, text) {
        var e = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
        if (text !== undefined) { e.textContent = text; }
        return e;
    }
    function css(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() || "#888"; }

    // ---- charts ------------------------------------------------------------

    function Chart(canvas, spec) {
        this.canvas = canvas;
        this.spec = spec;
        this.layer = document.createElement("canvas");
    }

    Chart.prototype.layout = function () {
        var ratio = window.devicePixelRatio || 1;
        var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        [this.canvas, this.layer].forEach(function (c) { c.width = w * ratio; c.height = h * ratio; });
        this.w = w; this.h = h; this.ratio = ratio;
        this.pad = { l: 56, r: 10, t: 8, b: 22 };
        this.drawStatic();
    };

    Chart.prototype.x = function (t) {
        var s = this.spec;
        return this.pad.l + (t / s.duration) * (this.w - this.pad.l - this.pad.r);
    };
    Chart.prototype.y = function (v) {
        var s = this.spec;
        return this.pad.t + (1 - (v - s.ymin) / (s.ymax - s.ymin)) * (this.h - this.pad.t - this.pad.b);
    };

    Chart.prototype.drawStatic = function () {
        var c = this.layer.getContext("2d"), s = this.spec, self = this;
        c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        c.clearRect(0, 0, this.w, this.h);
        var grid = css("--color-border"), text = css("--color-text-secondary");
        c.font = "11px Inter, system-ui, sans-serif";
        c.fillStyle = text;
        c.strokeStyle = grid;
        c.lineWidth = 1;
        niceTicks(s.ymin, s.ymax, 4).forEach(function (v) {
            var y = self.y(v);
            c.beginPath(); c.moveTo(self.pad.l, y); c.lineTo(self.w - self.pad.r, y); c.stroke();
            c.fillText(s.fmt(v), 4, y + 4);
        });
        niceTicks(0, s.duration / 600, 6).forEach(function (min) {
            var x = self.x(min * 600);
            c.fillText(clock(min * 600), x - 12, self.h - 6);
        });
        (s.shades || []).forEach(function (r) {
            c.fillStyle = "rgba(128,128,128,0.18)";
            c.fillRect(self.x(r[0]), self.pad.t, self.x(r[1]) - self.x(r[0]), self.h - self.pad.t - self.pad.b);
        });
        (s.bands || []).forEach(function (b) {
            if (b.lo === null) { return; }
            var x0 = self.x(b.t0), x1 = self.x(b.t1);
            var top = b.hi === null ? self.pad.t : self.y(b.hi);
            c.fillStyle = "rgba(122,79,209,0.13)";
            c.fillRect(x0, top, x1 - x0, self.y(b.lo) - top);
            c.strokeStyle = FLEET_COLOR; c.setLineDash([4, 3]);
            c.beginPath(); c.moveTo(x0, self.y(b.lo)); c.lineTo(x1, self.y(b.lo)); c.stroke();
            c.setLineDash([]);
        });
        (s.markers || []).forEach(function (m) {
            var x = self.x(m.t);
            c.strokeStyle = text; c.setLineDash([2, 3]);
            c.beginPath(); c.moveTo(x, self.pad.t); c.lineTo(x, self.h - self.pad.b); c.stroke();
            c.setLineDash([]);
            c.fillStyle = text; c.fillText(m.label, x + 3, self.pad.t + 10);
        });
        s.series.forEach(function (ser) {
            c.strokeStyle = ser.color; c.lineWidth = ser.width || 1.5;
            c.setLineDash(ser.dash || []);
            drawLine(c, self, ser.points, ser.step, ser.gapDs);
            c.setLineDash([]);
        });
    };

    Chart.prototype.draw = function (cursor) {
        var c = this.canvas.getContext("2d");
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        c.drawImage(this.layer, 0, 0);
        c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        var x = this.x(cursor);
        c.strokeStyle = css("--color-text"); c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, this.pad.t); c.lineTo(x, this.h - this.pad.b); c.stroke();
    };

    // One pixel column keeps its min and max, so 10 Hz series stay faithful
    // without drawing every sample; a gap longer than gapDs breaks the line.
    function drawLine(c, chart, pts, step, gapDs) {
        var started = false, lastX = null, lastT = null, colMin = 0, colMax = 0, prevY = null;
        c.beginPath();
        for (var i = 0; i < pts.length; i++) {
            var t = pts[i][0], v = pts[i][1];
            if (v === null) { started = false; continue; }
            var x = Math.round(chart.x(t)), y = chart.y(v);
            if (started && gapDs && t - lastT > gapDs) { started = false; }
            if (!started) { c.moveTo(x, y); started = true; lastX = x; colMin = colMax = y; prevY = y; lastT = t; continue; }
            if (x === lastX) { colMin = Math.min(colMin, y); colMax = Math.max(colMax, y); prevY = y; lastT = t; continue; }
            if (colMin !== colMax) { c.lineTo(lastX, colMin); c.lineTo(lastX, colMax); }
            if (step) { c.lineTo(x, prevY); }
            c.lineTo(x, y);
            lastX = x; colMin = colMax = y; prevY = y; lastT = t;
        }
        if (step && started) { c.lineTo(chart.x(chart.spec.duration), prevY); }
        c.stroke();
    }

    function niceTicks(min, max, n) {
        var span = max - min;
        if (span <= 0) { return [min]; }
        var raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
        var step = [1, 2, 5, 10].map(function (m) { return m * mag; }).find(function (s) { return s >= raw; });
        var out = [];
        for (var v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) { out.push(Math.round(v * 1e6) / 1e6); }
        return out;
    }

    function range(values, padFrac) {
        var finite = values.filter(function (v) { return v !== null && isFinite(v); });
        var lo = Math.min.apply(null, finite), hi = Math.max.apply(null, finite);
        var pad = (hi - lo || 1) * padFrac;
        return [lo - pad, hi + pad];
    }

    // ---- run view ----------------------------------------------------------

    function buildCharts(run, host) {
        var dur = run.duration_ds;
        var siteTol = run.kind === "field" ? 5 : 15;
        var stimulus = run.stimulus.map(function (s) { return [s[0], s[1]]; });

        var freqSeries = [{ points: stimulus, color: css("--color-text"), width: 1.6, step: true }];
        var freqVals = stimulus.map(function (s) { return s[1]; });
        var fr = range(freqVals.concat([50000]), 0.15);
        if (fr[1] - fr[0] < 60) { fr = [fr[0] - 30, fr[1] + 30]; }

        var outSeries = [], outVals = [];
        run.sites.forEach(function (site, i) {
            var pts = site.series.t_ds.map(function (t, j) { return [t, site.series.actual_w[j]]; });
            outSeries.push({ points: pts, color: SITE_COLORS[i % SITE_COLORS.length], width: 1.3, gapDs: siteTol * 2 });
            outVals = outVals.concat(site.series.actual_w);
        });
        outSeries.push({ points: run.fleet, color: FLEET_COLOR, width: 2, gapDs: siteTol * 2 });
        outVals = outVals.concat(run.fleet.map(function (p) { return p[1]; }));
        var bands = [];
        if (run.band) {
            run.band.forEach(function (b, i) {
                var t1 = i + 1 < run.band.length ? run.band[i + 1][0] : dur;
                bands.push({ t0: b[0], t1: t1, lo: b[1], hi: b[2] });
                outVals.push(b[1], b[2]);
            });
        }
        if (run.fleet_ideal_w !== undefined) {
            outSeries.push({ points: [[0, run.fleet_ideal_w], [dur, run.fleet_ideal_w]], color: FLEET_COLOR, width: 1, dash: [5, 4] });
            outVals.push(run.fleet_ideal_w);
        }
        var shades = run.downs.map(function (d) { return [d.start_ds, d.end_ds]; });
        var markers = (run.events || []).filter(function (e) { return e[1] !== "steady" && e[1] !== "end"; })
            .map(function (e) { return { t: e[0], label: eventLabel(e[1]) }; });
        var or = range(outVals.concat([0]), 0.08);

        var socSeries = run.sites.map(function (site, i) {
            return {
                points: site.series.t_ds.map(function (t, j) { return [t, site.series.soc_pml[j] / 10]; }),
                color: SITE_COLORS[i % SITE_COLORS.length], width: 1.3, gapDs: siteTol * 2
            };
        });

        var defs = [
            { title: "周波数", legend: [["記録された刺激（模擬信号）", css("--color-text")]],
              spec: { duration: dur, ymin: fr[0], ymax: fr[1], fmt: function (v) { return (v / 1000).toFixed(2); }, series: freqSeries, markers: markers } },
            { title: "出力（正 = 放電、負 = 充電）", tall: true,
              legend: run.sites.map(function (s, i) { return [s.id + " 実測", SITE_COLORS[i % SITE_COLORS.length]]; })
                .concat([["フリート合計", FLEET_COLOR]])
                .concat(run.band ? [["許容範囲" + (run.pattern === "a" ? "（下限のみ）" : ""), "rgba(122,79,209,0.35)"]] : [])
                .concat(run.fleet_ideal_w !== undefined ? [["登録カーブ上の理論値（フリート）", FLEET_COLOR]] : [])
                .concat(shades.length ? [["拠点停止中（記録なし）", "rgba(128,128,128,0.4)"]] : []),
              spec: { duration: dur, ymin: or[0], ymax: or[1], fmt: function (v) { return (v / 1000).toFixed(0) + " kW"; }, series: outSeries, bands: bands, shades: shades, markers: markers } },
            { title: "蓄電池 SoC", legend: run.sites.map(function (s, i) { return [s.id, SITE_COLORS[i % SITE_COLORS.length]]; }),
              spec: { duration: dur, ymin: 0, ymax: 100, fmt: function (v) { return v + " %"; }, series: socSeries, markers: markers } }
        ];
        state.charts = defs.map(function (d) {
            host.appendChild(el("div", { "class": "demo-chart-title" }, d.title));
            var legend = el("div", { "class": "demo-legend" });
            d.legend.forEach(function (l) {
                var item = el("span");
                var sw = el("i"); sw.style.background = l[1];
                item.appendChild(sw); item.appendChild(document.createTextNode(l[0]));
                legend.appendChild(item);
            });
            host.appendChild(legend);
            var canvas = el("canvas", { "class": "demo-chart" + (d.tall ? " tall" : ""), role: "img", "aria-label": d.title });
            host.appendChild(canvas);
            var chart = new Chart(canvas, d.spec);
            canvas.addEventListener("click", function (ev) {
                var r = canvas.getBoundingClientRect();
                var frac = (ev.clientX - r.left - chart.pad.l) / (r.width - chart.pad.l - chart.pad.r);
                seek(Math.max(0, Math.min(1, frac)) * dur);
            });
            return chart;
        });
        state.charts.forEach(function (c) { c.layout(); });
    }

    function eventLabel(name) {
        if (name.indexOf("cut ") === 0) { return name.slice(4) + " 回線断"; }
        if (name.indexOf("restore ") === 0) { return name.slice(8) + " 回線復旧"; }
        if (/ empty$/.test(name)) { return name.replace(" empty", "") + " SoC 0%"; }
        return name;
    }

    function schematic(run, t) {
        var tol = run.kind === "field" ? 5 : 15;
        var stim = stepValue(run.stimulus, t);
        var freq = stim ? stim[1] : run.stimulus[0][1];
        var text = css("--color-text"), sub = css("--color-text-secondary"), border = css("--color-border");
        var surface = css("--color-surface"), primary = css("--color-primary");
        var n = run.sites.length, W = 720, rowH = 92, H = Math.max(220, 40 + n * rowH);
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="周波数・拠点・DERMS の現在値">';
        svg += box(10, H / 2 - 40, 150, 80, surface, border);
        svg += label(85, H / 2 - 14, "周波数", sub, 12);
        svg += label(85, H / 2 + 10, hz(freq), text, 18, 700);
        svg += label(85, H / 2 + 30, run.kind === "field" ? "模擬信号（HTTP）" : "模擬（一定）", sub, 11);
        svg += box(560, H / 2 - 40, 150, 80, surface, border);
        svg += label(635, H / 2 - 14, "DERMS", text, 14, 700);
        svg += label(635, H / 2 + 8, run.assignment_source === "recorded" ? "割当（記録値）" : "割当（推定値）", sub, 11);
        run.sites.forEach(function (site, i) {
            var y = 20 + i * rowH + (H - 40 - n * rowH) / 2;
            var color = SITE_COLORS[i % SITE_COLORS.length];
            var smp = sampleAt(site, t, tol);
            var cut = cutWindow(run, site.id);
            var status, statusColor = sub;
            if (inDown(run, site.id, t)) { status = "停止中（記録なし）"; }
            else if (!smp) { status = "記録なし"; }
            else if (cut && t >= cut[0] && t < cut[1]) {
                status = smp.requested === 0 ? "回線断 → 安全停止（AVAIL-01）" : "回線断：最後の割当で応動中";
                statusColor = "#c98500";
            } else if (smp.actual === 0 && smp.avail === 0) { status = "SoC 下限：放電可能電力 0"; }
            else if (smp.actual > 0) { status = "放電"; statusColor = color; }
            else if (smp.actual < 0) { status = "充電"; statusColor = color; }
            else { status = "待機"; }
            svg += line(160, H / 2, 195, y + 36, border);
            svg += line(525, y + 36, 560, H / 2, border);
            svg += box(195, y, 330, 72, surface, color);
            svg += label(207, y + 18, site.id, text, 13, 700, "start");
            svg += label(513, y + 18, status, statusColor, 11, 600, "end");
            svg += label(207, y + 42, "出力 " + kw(smp ? smp.actual : null), text, 15, 600, "start");
            var soc = smp ? smp.soc / 10 : null;
            svg += '<rect x="207" y="' + (y + 52) + '" width="200" height="8" rx="4" fill="' + border + '"/>';
            if (soc !== null) {
                svg += '<rect x="207" y="' + (y + 52) + '" width="' + (2 * soc).toFixed(1) + '" height="8" rx="4" fill="' + color + '"/>';
            }
            svg += label(415, y + 60, "SoC " + (soc === null ? "—" : soc.toFixed(1) + " %"), sub, 11, 400, "start");
            var a = assignmentAt(run, site, t);
            var aText = !a || a.value === null ? "不明" : kw(a.value);
            svg += label(635, H / 2 + 22 + i * 16, site.id + "：" + aText, a && a.value !== null ? primary : sub, 11);
        });
        return svg + "</svg>";
    }
    function box(x, y, w, h, fill, stroke) {
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>';
    }
    function line(x1, y1, x2, y2, color) {
        return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="1.5"/>';
    }
    function label(x, y, s, color, size, weight, anchor) {
        return '<text x="' + x + '" y="' + y + '" fill="' + color + '" font-size="' + size + '" font-weight="' + (weight || 400) +
            '" text-anchor="' + (anchor || "middle") + '" font-family="Inter, system-ui, sans-serif">' + escapeXml(s) + "</text>";
    }
    function escapeXml(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

    function renderRun(run) {
        var host = document.getElementById("demo-run");
        host.innerHTML = "";
        state.run = run;
        // Start on the first recorded sample, not the empty lead-in.
        state.cursor = Math.min.apply(null, run.sites.map(function (x) { return x.series.t_ds[0]; }));
        state.playing = false;

        host.appendChild(el("h2", { style: "font-size:1.25rem;" }, run.title));
        host.appendChild(el("p", { "class": "demo-summary" }, run.summary));
        host.appendChild(el("p", { "class": "demo-meta" },
            "記録日 " + run.date + "　・　フリート登録量 " + kw(run.registered_w) + "　・　拠点 " + run.sites.length));
        host.appendChild(el("div", { "class": "demo-provenance" + (run.kind === "sim" ? " sim" : "") }, run.label));
        var notes = el("ul", { "class": "demo-notes" });
        notesFor(run).forEach(function (n) { notes.appendChild(el("li", {}, n)); });
        host.appendChild(notes);

        var controls = el("div", { "class": "demo-controls" });
        var play = el("button", { type: "button" }, "再生");
        play.addEventListener("click", function () { togglePlay(play); });
        controls.appendChild(play);
        SPEEDS.forEach(function (s) {
            var b = el("button", { type: "button", "aria-pressed": String(s === state.speed), "data-speed": String(s) }, "×" + s);
            b.addEventListener("click", function () {
                state.speed = s;
                controls.querySelectorAll("[data-speed]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
                update();
            });
            controls.appendChild(b);
        });
        var scrub = el("input", { type: "range", min: "0", max: String(run.duration_ds), value: "0", step: "1", "aria-label": "再生位置" });
        scrub.addEventListener("input", function () { seek(Number(scrub.value)); });
        controls.appendChild(scrub);
        var clk = el("span", { "class": "demo-clock" });
        controls.appendChild(clk);
        var flag = el("span", { "class": "demo-speed-flag" });
        controls.appendChild(flag);
        host.appendChild(controls);

        var sch = el("div", { "class": "demo-schematic" });
        host.appendChild(sch);
        var charts = el("div");
        host.appendChild(charts);
        buildCharts(run, charts);

        if (run.delays && run.delays.length) {
            host.appendChild(el("div", { "class": "demo-chart-title" }, "遅れ時間（周波数変化から出力変化まで、要件 ≤ 2 秒）"));
            host.appendChild(el("p", { "class": "demo-meta" },
                "拠点の時計と刺激側の時計のずれ（誤差幅つき）を考慮した区間で示します。区間が 2 秒をまたぐ場合は判定できません。"));
            var table = el("table", { "class": "demo-table" });
            var head = el("tr");
            ["拠点", "変化", "周波数", "遅れ時間の区間", "判定"].forEach(function (h) { head.appendChild(el("th", {}, h)); });
            table.appendChild(head);
            run.delays.forEach(function (d) {
                var tr = el("tr");
                tr.appendChild(el("td", {}, d.site));
                tr.appendChild(el("td", {}, phaseLabel(d.phase)));
                tr.appendChild(el("td", { "class": "num" }, hz(d.freq_mhz)));
                tr.appendChild(el("td", { "class": "num" }, d.lo_ms === null ? "—" : (d.lo_ms / 1000).toFixed(2) + "〜" + (d.hi_ms / 1000).toFixed(2) + " 秒"));
                tr.appendChild(el("td", {}, verdictLabel(d)));
                table.appendChild(tr);
            });
            host.appendChild(table);
        }

        var dl = el("p", { "class": "demo-downloads", style: "margin-top:14px;" });
        dl.appendChild(el("span", { "class": "demo-meta", style: "margin-right:10px;" }, "記録データ（CSV）："));
        run.downloads.forEach(function (p) {
            var a = el("a", { href: BASE + p, download: "" }, p.split("/").pop());
            dl.appendChild(a);
        });
        host.appendChild(dl);

        state.view = { play: play, scrub: scrub, clock: clk, flag: flag, schematic: sch };
        update();
    }

    function notesFor(run) {
        var notes = [];
        if (run.kind === "field") {
            notes.push("グラフの値は記録そのものです。拠点ごとの時刻は、刺激側の時計とのずれを補正しています。");
            if (run.pattern === "a") { notes.push("異常時の許容範囲は「供出可能量 − 10%」以上の下限だけです（上限はありません）。"); }
            else { notes.push("許容範囲は、登録カーブ上の理論値 ± 供出可能量の 10% です。不感帯（±10 mHz）の内側は評価の対象外で、その区間の帯は参考表示です。"); }
            notes.push("DERMS の割当は記録されていないため、指令値から逆算した推定値です。不感帯の内側や出力の上限に達しているときは「不明」と表示します。");
        } else {
            notes.push("電池は emu-mock のモデル（100 kWh、損失なし、指令どおりに即時応答）で、実機ではありません。");
            notes.push("DERMS の割当は、DERMS が実際に配信した記録値です。");
        }
        if (run.downs.length) {
            notes.push("停止中の拠点はフリート合計で 0 W として扱います。EMS 停止から蓄電池側のウォッチドッグが出力を止めるまでの残留出力は記録されていません。");
        }
        if (run.pattern === "cloud-loss") {
            notes.push("回線断中、DERMS は site-002 の分担を site-001 に移します。一方 site-002 も最後の割当で応動を続けるため、安全停止までの間はフリート合計が理論値を上回ります。");
            notes.push("site-002 が安全停止したあとは、site-001 が定格 50 kW の分担で応動するため、回線が戻るまでフリート合計は理論値を下回ります。");
            notes.push("回線断中の site-002 の値は、回線復旧後にさかのぼって送られた記録です。");
            notes.push("DERMS の欄は DERMS が配信した割当です。回線断中に配信された site-002 の割当 0 W は site-002 に届いておらず、site-002 は最後に受け取った割当で動いています。");
        }
        if (run.pattern === "soc-depletion") {
            notes.push("site-001 が空になると、DERMS はその分担を site-002 に移します。site-002 は定格 50 kW で頭打ちになるため、フリート合計は理論値（60 kW）に届きません。");
        }
        return notes;
    }

    function update() {
        var run = state.run, v = state.view;
        if (!run || !v) { return; }
        v.scrub.value = String(Math.round(state.cursor));
        v.clock.textContent = clock(state.cursor) + " / " + clock(run.duration_ds);
        v.flag.textContent = state.speed === 1 ? "" : "×" + state.speed + " 早送り";
        v.play.textContent = state.playing ? "一時停止" : "再生";
        v.schematic.innerHTML = schematic(run, state.cursor);
        state.charts.forEach(function (c) { c.draw(state.cursor); });
    }

    function seek(t) { state.cursor = t; update(); }

    function togglePlay() {
        if (state.cursor >= state.run.duration_ds) { state.cursor = 0; }
        state.playing = !state.playing;
        state.last = null;
        if (state.playing) { requestAnimationFrame(tick); }
        update();
    }

    function tick(now) {
        if (!state.playing) { return; }
        if (state.last !== null) {
            state.cursor += ((now - state.last) / 100) * state.speed;
            if (state.cursor >= state.run.duration_ds) { state.cursor = state.run.duration_ds; state.playing = false; }
        }
        state.last = now;
        update();
        if (state.playing) { requestAnimationFrame(tick); }
    }

    // ---- boot --------------------------------------------------------------

    function boot() {
        var tabs = document.getElementById("demo-tabs");
        fetchJson("index.json").then(function (index) {
            index.runs.forEach(function (r, i) {
                var b = el("button", { type: "button", role: "tab", "class": "demo-tab", "aria-selected": String(i === 0) }, r.title);
                b.appendChild(el("span", { "class": "kind" }, r.kind === "field" ? "実機記録" : "模擬"));
                b.addEventListener("click", function () {
                    tabs.querySelectorAll(".demo-tab").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
                    load(r.id);
                });
                tabs.appendChild(b);
            });
            if (index.runs.length) { load(index.runs[0].id); }
        }).catch(fail);
        var resizeTimer = null;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { state.charts.forEach(function (c) { c.layout(); }); update(); }, 150);
        });
    }

    // Only the most recent selection may render: an earlier fetch that
    // resolves late is dropped.
    function load(id) {
        state.playing = false;
        var generation = ++state.generation;
        fetchJson("runs/" + id + ".json").then(function (run) {
            if (generation === state.generation) { renderRun(run); }
        }).catch(function (err) {
            if (generation === state.generation) { fail(err); }
        });
    }

    function fail(err) {
        var host = document.getElementById("demo-run");
        host.innerHTML = "";
        host.appendChild(el("p", { "class": "demo-error" }, "記録を読み込めませんでした（" + err.message + "）。"));
    }

    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }
})();
