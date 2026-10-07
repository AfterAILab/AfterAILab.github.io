// AfterAI VPP — recorded-run player (vpp-repo ADR-089).
// Plays back recorded values only: no control computation runs here. Every
// run carries its provenance label; playback faster than 1× says so on screen.
(function () {
    "use strict";

    var BASE = window.VPP_DEMO_BASE || "/vpp-demo/";
    // Bumped with each bundle export, so a cached page never mixes old and new data.
    var BUNDLE_VERSION = "2026-10-07.2";
    var SPEED = 60;
    // A sample further than this from the cursor is not shown as current
    // (the runs are 10 Hz, so 0.5 s means a missing row, not jitter).
    var SAMPLE_TOL_DS = 5;
    var FLEET_COLOR = "#7a4fd1";
    var DOWN_COLOR = "#c98500";

    var state = { run: null, cursor: 0, start: 0, playing: false, scrubbing: false, last: null, raf: null, charts: [], generation: 0 };

    // ---- data access -------------------------------------------------------

    function fetchJson(path) {
        return fetch(BASE + path + "?v=" + BUNDLE_VERSION).then(function (r) {
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

    // The recorded value at the cursor, or null when there is none close
    // enough (a stopped EMS, or rows that never arrived).
    function valueAt(times, values, t) {
        var i = floorIndex(times, t);
        if (i < 0 || t - times[i] > SAMPLE_TOL_DS) { return null; }
        return values[i];
    }

    function stimulusAt(run, t) {
        var v = run.stimulus[0][1];
        for (var i = 0; i < run.stimulus.length && run.stimulus[i][0] <= t; i++) { v = run.stimulus[i][1]; }
        return v;
    }

    function inDown(run, siteId, t) {
        return run.downs.some(function (d) { return d.site === siteId && d.start_ds < t && t < d.end_ds; });
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
            c.fillText(clock(min * 600), Math.min(x - 12, self.w - c.measureText(clock(min * 600)).width - 2), self.h - 6);
        });
        (s.shades || []).forEach(function (r) {
            c.fillStyle = "rgba(201,133,0,0.16)";
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
        s.series.forEach(function (ser) {
            // A theme token ("--color-text") resolves here, so a re-theme redraws it.
            c.strokeStyle = ser.color.indexOf("--") === 0 ? css(ser.color) : ser.color; c.lineWidth = ser.width || 1.5;
            drawLine(c, self, ser.points, ser.step, ser.gapDs);
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

    // The output panel shows the fleet sum against the band only: per-site
    // lines overlap too much to read, and the schematic carries them.
    function buildCharts(run, host) {
        var dur = run.duration_ds;
        var stimulus = run.stimulus;
        var fr = range(stimulus.map(function (s) { return s[1]; }).concat([50000]), 0.15);
        if (fr[1] - fr[0] < 60) { fr = [fr[0] - 30, fr[1] + 30]; }

        var outVals = run.fleet.map(function (p) { return p[1]; });
        var bands = run.band.map(function (b, i) {
            outVals.push(b[1], b[2]);
            return { t0: b[0], t1: i + 1 < run.band.length ? run.band[i + 1][0] : dur, lo: b[1], hi: b[2] };
        });
        var or = range(outVals.concat([0]), 0.08);
        var shades = run.downs.map(function (d) { return [d.start_ds, d.end_ds]; });
        var downSites = run.downs.map(function (d) { return d.site; })
            .filter(function (s, i, all) { return all.indexOf(s) === i; });

        var defs = [
            { title: "周波数（模擬信号）", cls: "freq", legend: [],
              spec: { duration: dur, ymin: fr[0], ymax: fr[1], fmt: function (v) { return (v / 1000).toFixed(2); },
                      series: [{ points: stimulus, color: "--color-text", width: 1.6, step: true }] } },
            { title: "フリート出力（正 = 放電）", cls: "out",
              legend: [["フリート合計（実測）", FLEET_COLOR],
                       // The margin is 10 % of the fleet's supply capability, a fixed width, not 10 % of the value.
                       [run.pattern === "a" ? "許容範囲（下限のみ）" : "許容範囲（理論値 ± " + kw(run.registered_w / 10) + "）", "rgba(122,79,209,0.35)"]]
                  .concat(downSites.map(function (s) { return [s + " 停止中（0 W で合計・残留出力は未記録）", "rgba(201,133,0,0.45)"]; })),
              spec: { duration: dur, ymin: or[0], ymax: or[1], fmt: function (v) { return (v / 1000).toFixed(0) + " kW"; },
                      series: [{ points: run.fleet, color: FLEET_COLOR, width: 2, gapDs: 2 * SAMPLE_TOL_DS }],
                      bands: bands, shades: shades } }
        ];
        state.charts = defs.map(function (d) {
            var head = el("div", { "class": "demo-chart-head" });
            head.appendChild(el("span", { "class": "demo-chart-title" }, d.title));
            d.legend.forEach(function (l) {
                var item = el("span", { "class": "demo-legend" });
                var sw = el("i"); sw.style.background = l[1];
                item.appendChild(sw); item.appendChild(document.createTextNode(l[0]));
                head.appendChild(item);
            });
            host.appendChild(head);
            var canvas = el("canvas", { "class": "demo-chart " + d.cls, role: "img", "aria-label": d.title });
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

    // Frequency feeds every site; the sites sum to the fleet.
    function schematic(run, t) {
        var text = css("--color-text"), sub = css("--color-text-secondary"), border = css("--color-border");
        var surface = css("--color-surface"), primary = css("--color-primary");
        var W = 240, H = 300, n = run.sites.length, gap = 10;
        var siteW = (W - 8 - gap * (n - 1)) / n, siteY = 104, siteH = 86;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="周波数・拠点・フリート合計の現在値">';
        svg += box(20, 4, 200, 66, surface, border);
        svg += label(120, 26, "周波数（模擬信号）", sub, 12);
        svg += label(120, 56, hz(stimulusAt(run, t)), text, 22, 700);
        var anyDown = false;
        run.sites.forEach(function (site, i) {
            var x = 4 + i * (siteW + gap), cx = x + siteW / 2;
            var down = inDown(run, site.id, t);
            // A stopped site counts as 0 W in the fleet sum, so it shows no output of its own (ADR-084).
            var w = down ? null : valueAt(site.series.t_ds, site.series.actual_w, t);
            var status, statusColor = sub;
            if (down) { status = "停止中"; statusColor = DOWN_COLOR; anyDown = true; }
            else if (w === null) { status = "記録なし"; }
            else if (w > 0) { status = "放電"; statusColor = primary; }
            else if (w < 0) { status = "充電"; statusColor = primary; }
            else { status = "待機"; }
            svg += line(120, 70, cx, siteY, border);
            svg += line(cx, siteY + siteH, 120, 224, border);
            svg += box(x, siteY, siteW, siteH, surface, statusColor === sub ? border : statusColor);
            svg += label(cx, siteY + 20, site.id, text, 12, 700);
            svg += label(cx, siteY + 50, kw(w), text, 18, 700);
            svg += label(cx, siteY + 72, status, statusColor, 11, 600);
        });
        svg += box(20, 224, 200, 72, surface, FLEET_COLOR);
        svg += label(120, 244, "フリート合計", sub, 12);
        svg += label(120, 272, kw(valueAt(state.fleetT, state.fleetW, t)), FLEET_COLOR, 22, 700);
        if (anyDown) { svg += label(120, 289, "停止中の拠点は 0 W で合計", DOWN_COLOR, 10); }
        return svg + "</svg>";
    }
    function box(x, y, w, h, fill, stroke) {
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>';
    }
    function line(x1, y1, x2, y2, color) {
        return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="1.5"/>';
    }
    function label(x, y, s, color, size, weight) {
        return '<text x="' + x + '" y="' + y + '" fill="' + color + '" font-size="' + size + '" font-weight="' + (weight || 400) +
            '" text-anchor="middle" font-family="Inter, system-ui, sans-serif">' + escapeXml(s) + "</text>";
    }
    function escapeXml(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

    function renderRun(run) {
        var host = document.getElementById("demo-run");
        host.innerHTML = "";
        state.run = run;
        state.fleetT = run.fleet.map(function (p) { return p[0]; });
        state.fleetW = run.fleet.map(function (p) { return p[1]; });
        // Start (and loop back to) the first recorded sample, not the empty lead-in.
        state.start = Math.min.apply(null, run.sites.map(function (x) { return x.series.t_ds[0]; }));
        state.cursor = state.start;

        // Each fact stays on one line; the line may break between them.
        var provenance = el("p", { "class": "demo-provenance" }, run.label + "　");
        ["記録日 " + run.date, "フリート登録量 " + kw(run.registered_w), "拠点 " + run.sites.length].forEach(function (fact, i) {
            if (i > 0) { provenance.appendChild(document.createTextNode("・")); }
            provenance.appendChild(el("span", { "class": "demo-fact" }, fact));
        });
        host.appendChild(provenance);

        var controls = el("div", { "class": "demo-controls" });
        var play = el("button", { type: "button" });
        play.addEventListener("click", togglePlay);
        controls.appendChild(play);
        var scrub = el("input", { type: "range", min: "0", max: String(run.duration_ds), value: "0", step: "1", "aria-label": "再生位置" });
        scrub.addEventListener("input", function () { seek(Number(scrub.value)); });
        // While the thumb is held, playback holds too, so the thumb stays under the pointer.
        scrub.addEventListener("pointerdown", function () { state.scrubbing = true; });
        controls.appendChild(scrub);
        var clk = el("span", { "class": "demo-clock" });
        controls.appendChild(clk);
        controls.appendChild(el("span", { "class": "demo-speed-flag" }, "×" + SPEED + " 早送り"));
        host.appendChild(controls);

        var stage = el("div", { "class": "demo-stage" });
        var sch = el("div", { "class": "demo-schematic" });
        stage.appendChild(sch);
        var charts = el("div", { "class": "demo-charts" });
        stage.appendChild(charts);
        host.appendChild(stage);
        buildCharts(run, charts);

        var notes = el("ul", { "class": "demo-notes" });
        notes.appendChild(el("li", {}, run.summary));
        notesFor(run).forEach(function (n) { notes.appendChild(el("li", {}, n)); });
        host.appendChild(notes);

        state.view = { play: play, scrub: scrub, clock: clk, schematic: sch };
        state.playing = true;
        state.last = null;
        startLoop();
        update();
    }

    function notesFor(run) {
        var notes = ["グラフの値は記録そのものです。拠点の時刻は、刺激側の時計とのずれを補正しています。"];
        if (run.pattern === "a") { notes.push("許容範囲は、周波数が 0.2 Hz を超えて低下している間だけの下限（供出可能量 − 10%）です。"); }
        else { notes.push("許容範囲は、登録カーブ上の理論値 ± 供出可能量の 10% です。不感帯（±10 mHz）の内側は参考表示です。"); }
        if (run.downs.length) {
            notes.push("停止中の拠点はフリート合計で 0 W として扱います。EMS 停止から蓄電池側のウォッチドッグが出力を止めるまでの残留出力は記録されていません。");
        }
        return notes;
    }

    function update() {
        var run = state.run, v = state.view;
        if (!run || !v) { return; }
        if (!state.scrubbing) { v.scrub.value = String(Math.round(state.cursor)); }
        v.clock.textContent = clock(state.cursor) + " / " + clock(run.duration_ds);
        v.play.textContent = state.playing ? "一時停止" : "再生";
        v.schematic.innerHTML = schematic(run, state.cursor);
        state.charts.forEach(function (c) { c.draw(state.cursor); });
    }

    function seek(t) { state.cursor = t; update(); }

    function togglePlay() {
        state.playing = !state.playing;
        state.last = null;
        startLoop();
        update();
    }

    // One animation loop at most, however often playback is (re)started.
    function startLoop() {
        if (state.playing && state.raf === null) { state.raf = requestAnimationFrame(tick); }
    }

    function tick(now) {
        state.raf = null;
        if (!state.playing) { return; }
        if (state.last !== null && !state.scrubbing) {
            // A frame gap (a hidden tab) resumes where it left off instead of jumping.
            state.cursor += (Math.min(now - state.last, 100) / 100) * SPEED;
            if (state.cursor >= state.run.duration_ds) { state.cursor = state.start; }
        }
        state.last = now;
        update();
        startLoop();
    }

    // ---- boot --------------------------------------------------------------

    function boot() {
        var tabs = document.getElementById("demo-tabs");
        fetchJson("index.json").then(function (index) {
            index.runs.forEach(function (r, i) {
                var b = el("button", { type: "button", role: "tab", "class": "demo-tab", "aria-selected": String(i === 0) }, r.title);
                b.addEventListener("click", function () {
                    tabs.querySelectorAll(".demo-tab").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
                    load(r.id);
                });
                tabs.appendChild(b);
            });
            if (index.runs.length) { load(index.runs[0].id); }
        }).catch(fail);
        window.addEventListener("pointerup", releaseScrub);
        window.addEventListener("pointercancel", releaseScrub);
        var resizeTimer = null;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(relayout, 150);
        });
        // The theme toggle flips data-theme on <html>; the charts cache its colours.
        new MutationObserver(relayout).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    function relayout() {
        state.charts.forEach(function (c) { c.layout(); });
        update();
    }

    function releaseScrub() {
        if (!state.scrubbing) { return; }
        state.scrubbing = false;
        update();
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
        state.playing = false;
        state.charts = [];
        state.view = null;
        var host = document.getElementById("demo-run");
        host.innerHTML = "";
        host.appendChild(el("p", { "class": "demo-error" }, "記録を読み込めませんでした（" + err.message + "）。"));
    }

    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }
})();
