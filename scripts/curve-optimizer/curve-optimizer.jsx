// =============================================================================
// curve-optimizer.jsx  (CurveOptimization)
//
// G2 Curve Optimizer — ScriptUI Dialog + Preview
// Depends on: lib/math-engine.jsx
//
// ExtendScript ES3 compatible.
// =============================================================================

#include "lib/math-engine.jsx"

// =============================================================================
// Constants
// =============================================================================

var COMB_NAME = "_combPath";

// =============================================================================
// cloneSnapshot — deep copy of snapshot array
// =============================================================================

function cloneSnapshot(snap) {
    var result = [];
    result.closed = snap.closed; // preserve open/closed state
    var i;
    for (i = 0; i < snap.length; i++) {
        result.push({
            anchor:         [snap[i].anchor[0],         snap[i].anchor[1]],
            leftDirection:  [snap[i].leftDirection[0],  snap[i].leftDirection[1]],
            rightDirection: [snap[i].rightDirection[0], snap[i].rightDirection[1]],
            pointType:      snap[i].pointType,
            selected:       snap[i].selected
        });
    }
    return result;
}

// =============================================================================
// applyPtsToPath — setEntirePath 2-step pattern
// =============================================================================

function applyPtsToPath(pathItem, pts) {
    var anchors = [];
    var i;
    for (i = 0; i < pts.length; i++) {
        anchors.push(pts[i].anchor);
    }
    pathItem.setEntirePath(anchors);
    // closed は変えない
    for (i = 0; i < pts.length; i++) {
        pathItem.pathPoints[i].leftDirection  = pts[i].leftDirection;
        pathItem.pathPoints[i].rightDirection = pts[i].rightDirection;
        pathItem.pathPoints[i].pointType      = pts[i].pointType;
    }
}

// =============================================================================
// pathMatchesSnapshot — ハンドル位置でパスが元状態と一致するか確認
// =============================================================================

function pathMatchesSnapshot(pathItem, snap) {
    var pp = pathItem.pathPoints;
    if (pp.length !== snap.length) return false;
    var i, lx, ly;
    for (i = 0; i < pp.length && i < 5; i++) {
        lx = pp[i].leftDirection[0] - snap[i].leftDirection[0];
        ly = pp[i].leftDirection[1] - snap[i].leftDirection[1];
        if (Math.abs(lx) > 0.01 || Math.abs(ly) > 0.01) return false;
    }
    return true;
}

// =============================================================================
// Comb path management
// =============================================================================

function deleteCombPath(doc) {
    var items = doc.pathItems;
    var i;
    for (i = items.length - 1; i >= 0; i--) {
        if (items[i].name === COMB_NAME) {
            items[i].remove();
        }
    }
}

function _makeCombColor() {
    var c = new RGBColor();
    c.red   = 255;
    c.green = 100;
    c.blue  = 0;
    return c;
}

function drawCombPath(doc, segs) {
    if (segs.length === 0) return;
    var layer = doc.activeLayer;
    var color = _makeCombColor();
    var i, combPath;
    for (i = 0; i < segs.length; i++) {
        combPath = layer.pathItems.add();
        combPath.name        = COMB_NAME;
        combPath.stroked     = true;
        combPath.filled      = false;
        combPath.strokeColor = color;
        combPath.strokeWidth = 0.5;
        combPath.closed      = false;
        // Step 1: 2 \u70B9\u306E\u30A2\u30F3\u30AB\u30FC\u5EA7\u6A19\u3067\u70B9\u6570\u3092\u78BA\u5B9A
        combPath.setEntirePath([segs[i].from, segs[i].to]);
        // Step 2: \u5168\u70B9\u3092\u30B3\u30FC\u30CA\u30FC\u70B9\u306B\u8A2D\u5B9A
        combPath.pathPoints[0].pointType      = PointType.CORNER;
        combPath.pathPoints[0].leftDirection  = combPath.pathPoints[0].anchor;
        combPath.pathPoints[0].rightDirection = combPath.pathPoints[0].anchor;
        combPath.pathPoints[1].pointType      = PointType.CORNER;
        combPath.pathPoints[1].leftDirection  = combPath.pathPoints[1].anchor;
        combPath.pathPoints[1].rightDirection = combPath.pathPoints[1].anchor;
    }
}

// =============================================================================
// previewApply — スナップショットから pts をコピーして G2 補正を適用
// =============================================================================

function previewApply(paths, snapshots, corrPct, targetAll, showComb, nSamples, combScale, shapePct) {
    var doc = app.activeDocument;
    var i, pts, pass;
    var combPts; // paths[0] \u306e\u88dc\u6b63\u6e08\u307f pts \u2014 \u30b3\u30e0\u63cf\u753b\u7528\u306b\u4fdd\u6301\uff08\u518d\u8a08\u7b97\u3057\u306a\u3044\uff09

    // 既存コムを削除
    deleteCombPath(doc);

    for (i = 0; i < paths.length; i++) {
        // スナップショットから pts コピーを作成（in-place 変更するため）
        pts = cloneSnapshot(snapshots[i]);

        // 最大3回反復して G2 補正
        for (pass = 0; pass < 3; pass++) {
            applyG2Pass(pts, corrPct, targetAll);
        }

        // 形状変化% (G2 補正後に 1 回だけ適用)
        if (shapePct !== 0) {
            applyShapeScale(pts, shapePct, targetAll);
        }

        if (i === 0) {
            combPts = pts; // \u30b3\u30e0\u7528\u306b\u4fdd\u5b58\uff08\u518d\u8a08\u7b97\u3057\u306a\u3044\uff09
        }

        // パスに適用
        applyPtsToPath(paths[i], pts);
    }

    // 曲率コム描画
    if (showComb && paths.length > 0) {
        var segs = buildCombSegments(combPts, nSamples, combScale, paths[0].closed);
        drawCombPath(doc, segs);
    }

    app.redraw();
}

// =============================================================================
// logG2Info — ESTK コンソールにログを出力
// =============================================================================

function logG2Info(paths, snapshots, corrPct, targetAll) {
    $.writeln("=== G2 Optimization Log ===");
    $.writeln("corrPct: " + corrPct + "%");
    var i, j, pts, snap;
    for (i = 0; i < paths.length; i++) {
        snap = snapshots[i];
        pts  = cloneSnapshot(snap);
        $.writeln("--- Path " + (i + 1) + " (" + snap.length + " points) ---");
        applyG2Pass(pts, corrPct, targetAll);
        for (j = 0; j < snap.length; j++) {
            if (snap[j].pointType !== PointType.SMOOTH) continue;
            var hInBefore  = Math.sqrt(
                Math.pow(snap[j].anchor[0] - snap[j].leftDirection[0], 2) +
                Math.pow(snap[j].anchor[1] - snap[j].leftDirection[1], 2));
            var hOutBefore = Math.sqrt(
                Math.pow(snap[j].rightDirection[0] - snap[j].anchor[0], 2) +
                Math.pow(snap[j].rightDirection[1] - snap[j].anchor[1], 2));
            var hInAfter  = Math.sqrt(
                Math.pow(pts[j].anchor[0] - pts[j].leftDirection[0], 2) +
                Math.pow(pts[j].anchor[1] - pts[j].leftDirection[1], 2));
            var hOutAfter = Math.sqrt(
                Math.pow(pts[j].rightDirection[0] - pts[j].anchor[0], 2) +
                Math.pow(pts[j].rightDirection[1] - pts[j].anchor[1], 2));
            $.writeln("  pt[" + j + "] h_in: " + hInBefore.toFixed(2) + " \u2192 " + hInAfter.toFixed(2) +
                      "  h_out: " + hOutBefore.toFixed(2) + " \u2192 " + hOutAfter.toFixed(2));
        }
    }
    $.writeln("===========================");
}

// =============================================================================
// runDialog — ScriptUI ダイアログ
// =============================================================================

function runDialog(paths, snapshots) {
    var hasPreviewApplied = false;
    var _lastPreviewTime = 0;
    var _result = null;

    // 起動時に検出された選択アンカー数を集計
    var selCount = 0;
    var _si, _sj;
    for (_si = 0; _si < snapshots.length; _si++) {
        for (_sj = 0; _sj < snapshots[_si].length; _sj++) {
            if (snapshots[_si][_sj].selected) selCount++;
        }
    }

    // listbox 行インデックス → snapshot インデックスのマッピング
    var anchorMap = [];
    var _mi, _mj;
    for (_mi = 0; _mi < snapshots.length; _mi++) {
        for (_mj = 0; _mj < snapshots[_mi].length; _mj++) {
            anchorMap.push({pathIdx: _mi, anchorIdx: _mj});
        }
    }

    // selCount === 0 のとき全スムースアンカーを選択状態にする（デフォルト動作）
    if (selCount === 0) {
        var _ii;
        for (_ii = 0; _ii < anchorMap.length; _ii++) {
            var _iinfo = anchorMap[_ii];
            if (snapshots[_iinfo.pathIdx][_iinfo.anchorIdx].pointType === PointType.SMOOTH) {
                snapshots[_iinfo.pathIdx][_iinfo.anchorIdx].selected = true;
            }
        }
    }

    // listbox 表示ラベルを生成
    var anchorLabels = [];
    var _li;
    for (_li = 0; _li < anchorMap.length; _li++) {
        var _lpi = anchorMap[_li].pathIdx;
        var _lai = anchorMap[_li].anchorIdx;
        var _lpt = snapshots[_lpi][_lai];
        var _typeStr = (_lpt.pointType === PointType.SMOOTH)
            ? "\u30B9\u30E0\u30FC\u30B9"   // "スムース"
            : "\u30B3\u30FC\u30CA\u30FC";  // "コーナー"
        if (snapshots.length === 1) {
            anchorLabels.push(_lai + ": " + _typeStr);
        } else {
            anchorLabels.push("P" + (_lpi + 1) + "-" + _lai + ": " + _typeStr);
        }
    }

    var dlg = new Window("dialog", "\u30AB\u30FC\u30D6\u4FEE\u6B63"); // "G2 curve correction dialog"
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.margins = [16, 16, 16, 16];
    dlg.spacing = 8;

    // === G2っぽくする パネル ===
    var g2Panel = dlg.add("panel", undefined, "G2\u3063\u307D\u304F\u3059\u308B"); // "G2っぽくする"
    g2Panel.orientation = "column";
    g2Panel.alignChildren = ["fill", "center"];
    g2Panel.margins = [12, 18, 12, 10];
    g2Panel.spacing = 6;

    // 補正量行
    var corrRow = g2Panel.add("group");
    corrRow.orientation = "row";
    corrRow.alignChildren = ["left", "center"];
    corrRow.add("statictext", undefined, "\u88DC\u6B63\u91CF:"); // "補正量:"
    var corrSlider = corrRow.add("slider", undefined, 152, 0, 300);
    corrSlider.preferredSize.width = 160;
    var corrEdit = corrRow.add("edittext", undefined, "152");
    corrEdit.preferredSize.width = 40;
    corrRow.add("statictext", undefined, "%");

    // 形状変化行（将来用・現時点は表示のみ）
    var shapeRow = g2Panel.add("group");
    shapeRow.orientation = "row";
    shapeRow.alignChildren = ["left", "center"];
    shapeRow.add("statictext", undefined, "\u5F62\u72B6\u5909\u5316:"); // "形状変化:"
    var shapeSlider = shapeRow.add("slider", undefined, 0, -100, 100);
    shapeSlider.preferredSize.width = 160;
    var shapeEdit = shapeRow.add("edittext", undefined, "0");
    shapeEdit.preferredSize.width = 40;
    shapeRow.add("statictext", undefined, "%");
    shapeSlider.enabled = true;
    shapeEdit.enabled   = true;

    // === 曲率グラフ パネル ===
    var combPanel = dlg.add("panel", undefined, "\u66F2\u7387\u30B0\u30E9\u30D5"); // "曲率グラフ"
    combPanel.orientation = "column";
    combPanel.alignChildren = ["fill", "center"];
    combPanel.margins = [12, 18, 12, 10];
    combPanel.spacing = 6;

    var cbShowComb = combPanel.add("checkbox", undefined, "\u30B0\u30E9\u30D5\u3092\u8868\u793A"); // "グラフを表示"
    cbShowComb.value = true;

    var sampRow = combPanel.add("group");
    sampRow.orientation = "row";
    sampRow.alignChildren = ["left", "center"];
    sampRow.add("statictext", undefined, "\u30B5\u30F3\u30D7\u30EB\u6570:"); // "サンプル数:"
    var sampEdit = sampRow.add("edittext", undefined, "70");
    sampEdit.preferredSize.width = 50;

    var scaleRow = combPanel.add("group");
    scaleRow.orientation = "row";
    scaleRow.alignChildren = ["left", "center"];
    scaleRow.add("statictext", undefined, "\u30B0\u30E9\u30D5\u500D\u7387:"); // "グラフ倍率:"
    var scaleEdit = scaleRow.add("edittext", undefined, "1000");
    scaleEdit.preferredSize.width = 50;

    // === 対象アンカー パネル ===
    var anchorPanel = dlg.add("panel", undefined, "\u5BFE\u8C61\u30A2\u30F3\u30AB\u30FC"); // "対象アンカー"
    anchorPanel.orientation = "column";
    anchorPanel.alignChildren = ["fill", "center"];
    anchorPanel.margins = [12, 18, 12, 10];
    anchorPanel.spacing = 4;

    // チェックボックスを anchorMap に対応して生成
    var anchorCbs = [];
    var _ci;
    for (_ci = 0; _ci < anchorMap.length; _ci++) {
        var _cpi = anchorMap[_ci].pathIdx;
        var _cai = anchorMap[_ci].anchorIdx;
        var _cb  = anchorPanel.add("checkbox", undefined, anchorLabels[_ci]);
        _cb.value = snapshots[_cpi][_cai].selected;
        anchorCbs.push(_cb);
    }

    var anchorBtnRow = anchorPanel.add("group");
    anchorBtnRow.orientation = "row";
    anchorBtnRow.alignChildren = ["left", "center"];
    var btnSelSmooth = anchorBtnRow.add("button", undefined, "\u5168\u30B9\u30E0\u30FC\u30B9\u9078\u629E"); // "全スムース選択"
    var btnDeselAll  = anchorBtnRow.add("button", undefined, "\u5168\u89E3\u9664");                         // "全解除"

    // === オプション パネル ===
    var optPanel = dlg.add("panel", undefined, "\u30AA\u30D7\u30B7\u30E7\u30F3"); // "オプション"
    optPanel.orientation = "column";
    optPanel.alignChildren = ["fill", "center"];
    optPanel.margins = [12, 18, 12, 10];
    optPanel.spacing = 4;

    var cbPreview  = optPanel.add("checkbox", undefined, "\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u8868\u793A"); // "プレビューを表示"
    cbPreview.value = true;
    var cbKeepOrig = optPanel.add("checkbox", undefined, "\u5143\u306E\u30D1\u30B9\u3092\u6B8B\u3059"); // "元のパスを残す"
    cbKeepOrig.value = false;
    var cbLog      = optPanel.add("checkbox", undefined, "\u30ED\u30B0\u3092\u51FA\u529B"); // "ログを出力"
    cbLog.value = true;

    // === ボタン行 ===
    var btnRow = dlg.add("group");
    btnRow.orientation = "row";
    btnRow.alignment = ["right", "center"];
    btnRow.margins = [0, 4, 0, 0];
    var cancelBtn = btnRow.add("button", undefined, "\u30AD\u30E3\u30F3\u30BB\u30EB", {name: "cancel"}); // "キャンセル"
    var okBtn     = btnRow.add("button", undefined, "\u5B9F\u884C",                   {name: "ok"});    // "実行"

    // --- ヘルパー ---
    function getCorrPct() {
        var v = parseFloat(corrEdit.text);
        if (isNaN(v) || v < 0) v = 0;
        if (v > 300) v = 300;
        return v;
    }

    function getNSamples() {
        var v = parseInt(sampEdit.text, 10);
        if (isNaN(v) || v < 2) v = 2;
        if (v > 500) v = 500;
        return v;
    }

    function getCombScale() {
        var v = parseFloat(scaleEdit.text);
        if (isNaN(v) || v <= 0) v = 1000;
        return v;
    }

    function getShapePct() {
        var v = parseFloat(shapeEdit.text);
        if (isNaN(v)) v = 0;
        if (v < -100) v = -100;
        if (v > 100)  v = 100;
        return v;
    }

    function syncSelectionFromCbs() {
        var _ri;
        for (_ri = 0; _ri < anchorMap.length; _ri++) {
            var _rinfo = anchorMap[_ri];
            snapshots[_rinfo.pathIdx][_rinfo.anchorIdx].selected = anchorCbs[_ri].value;
        }
    }

    function doPreview() {
        if (!cbPreview.value) return;

        syncSelectionFromCbs();

        // \u30c7\u30d0\u30a6\u30f3\u30b9: onChanging \u306e\u9023\u7d9a\u547c\u3073\u51fa\u3057 100ms \u4ee5\u5185\u306f\u30b9\u30ad\u30c3\u30d7
        var now = (new Date()).getTime();
        if (now - _lastPreviewTime < 100) return;
        _lastPreviewTime = now;

        // previewApply \u306f\u5e38\u306b\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u304b\u3089\u76f4\u63a5\u8a08\u7b97\u3059\u308b\u305f\u3081 restoreSnapshot \u4e0d\u8981
        deleteCombPath(app.activeDocument);

        var corrPct   = getCorrPct();
        var targetAll = false;
        var showComb  = cbShowComb.value;
        var nSamples  = getNSamples();
        var combScale = getCombScale();
        var shapePct  = getShapePct();
        previewApply(paths, snapshots, corrPct, targetAll, showComb, nSamples, combScale, shapePct);
        hasPreviewApplied = true;
    }

    // --- イベント接続 ---
    // onChanging: ドラッグ中はテキスト更新のみ（プレビューは onChange で実行）
    corrSlider.onChanging = function () {
        corrEdit.text = Math.round(corrSlider.value) + "";
    };
    corrSlider.onChange = function () {
        corrEdit.text = Math.round(corrSlider.value) + "";
        doPreview();
    };

    corrEdit.onChange = function () {
        var v = getCorrPct();
        corrSlider.value = v;
        corrEdit.text = v + "";
        doPreview();
    };

    shapeSlider.onChanging = function () {
        shapeEdit.text = Math.round(shapeSlider.value) + "";
    };
    shapeSlider.onChange = function () {
        shapeEdit.text = Math.round(shapeSlider.value) + "";
        doPreview();
    };
    shapeEdit.onChange = function () {
        var v = getShapePct();
        shapeSlider.value = v;
        shapeEdit.text = v + "";
        doPreview();
    };

    // チェックボックス個別の onClick
    var _eci;
    for (_eci = 0; _eci < anchorCbs.length; _eci++) {
        anchorCbs[_eci].onClick = function () {
            syncSelectionFromCbs();
            doPreview();
        };
    }

    btnSelSmooth.onClick = function () {
        var _si;
        for (_si = 0; _si < anchorMap.length; _si++) {
            var _sinfo = anchorMap[_si];
            anchorCbs[_si].value =
                (snapshots[_sinfo.pathIdx][_sinfo.anchorIdx].pointType === PointType.SMOOTH);
        }
        syncSelectionFromCbs();
        doPreview();
    };

    btnDeselAll.onClick = function () {
        var _di;
        for (_di = 0; _di < anchorMap.length; _di++) {
            anchorCbs[_di].value = false;
        }
        syncSelectionFromCbs();
        doPreview();
    };

    cbShowComb.onClick = function () { doPreview(); };
    cbPreview.onClick  = function () {
        if (!cbPreview.value) {
            // \u30c1\u30a7\u30c3\u30af\u3092\u5916\u3057\u305f\u3068\u304d\u306f\u5143\u30d1\u30b9\u306b\u623b\u3059
            var i;
            for (i = 0; i < paths.length; i++) {
                restoreSnapshot(paths[i], snapshots[i]);
            }
            deleteCombPath(app.activeDocument);
            hasPreviewApplied = false;
            app.redraw();
        } else {
            doPreview();
        }
    };
    sampEdit.onChange  = function () { doPreview(); };
    scaleEdit.onChange = function () { doPreview(); };

    okBtn.onClick = function () {
        syncSelectionFromCbs();
        // 設定を保存
        _result = {
            corrPct:   getCorrPct(),
            targetAll: false,
            shapePct:  getShapePct(),
            nSamples:  getNSamples(),
            combScale: getCombScale(),
            keepOrig:  cbKeepOrig.value,
            doLog:     cbLog.value
        };
        // プレビュー状態をスナップショットに戻す（undo 履歴の末尾を元状態にする）
        // → ダイアログ外で previewApply を 1 回呼ぶと Cmd+Z 1 回で S0 に戻れる
        var i;
        for (i = 0; i < paths.length; i++) {
            restoreSnapshot(paths[i], snapshots[i]);
        }
        deleteCombPath(app.activeDocument);
        app.redraw();
        dlg.close(true);
    };

    cancelBtn.onClick = function () {
        // snapshot \u304b\u3089\u5143\u30d1\u30b9\u306b\u5fa9\u5143\u3057\u3066\u304b\u3089\u9589\u3058\u308b
        // \uff08\u30c0\u30a4\u30a2\u30ed\u30b0\u3092\u9589\u3058\u305f\u5f8c\u306b\u30a8\u30f3\u30c8\u30ea\u30dd\u30a4\u30f3\u30c8\u306e undo() \u3067\u30c8\u30e9\u30f3\u30b6\u30af\u30b7\u30e7\u30f3\u5168\u4f53\u3092\u5dfb\u304d\u623b\u3059\uff09
        var i;
        for (i = 0; i < paths.length; i++) {
            restoreSnapshot(paths[i], snapshots[i]);
        }
        deleteCombPath(app.activeDocument);
        app.redraw();
        dlg.close(false);
    };

    // 初期プレビュー
    doPreview();

    dlg.show();
    return _result; // null = Cancel, object = OK
}

// =============================================================================
// Entry Point
// =============================================================================

(function () {
    if (app.documents.length === 0) {
        alert("\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u304C\u958B\u304B\u308C\u3066\u3044\u307E\u305B\u3093\u3002"); // "ドキュメントが開かれていません。"
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
        alert("\u30D1\u30B9\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002"); // "パスを選択してください。"
        return;
    }

    // PathItem のみ抽出（編集可能なもの）
    var paths = [];
    var i;
    for (i = 0; i < sel.length; i++) {
        if (sel[i].typename === "PathItem" && sel[i].editable) {
            paths.push(sel[i]);
        }
    }
    if (paths.length === 0) {
        alert("\u7DE8\u96C6\u53EF\u80FD\u306A\u30D1\u30B9\u304C\u9078\u629E\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002"); // "編集可能なパスが選択されていません。"
        return;
    }

    // スナップショット取得
    // selectedPathPoints で個別アンカー選択状態を保存する
    // （pt.selected は File>Scripts 経由の場合に全て非 NOSELECTION になるため信頼できない）
    var snapshots = [];
    var j, k, selPts, ax, ay;
    for (i = 0; i < paths.length; i++) {
        var snap = takeSnapshot(paths[i]);
        // まず全アンカーを未選択にリセット
        for (j = 0; j < snap.length; j++) {
            snap[j].selected = false;
        }
        // selectedPathPoints で個別選択されたアンカーだけを true にする
        // selPts.length === snap.length はパス全体選択（個別選択ではない）ため無視する
        selPts = paths[i].selectedPathPoints;
        if (selPts.length > 0 && selPts.length < snap.length) {
            for (k = 0; k < selPts.length; k++) {
                ax = selPts[k].anchor[0];
                ay = selPts[k].anchor[1];
                for (j = 0; j < snap.length; j++) {
                    if (Math.abs(snap[j].anchor[0] - ax) < 0.01 &&
                        Math.abs(snap[j].anchor[1] - ay) < 0.01) {
                        snap[j].selected = true;
                        break;
                    }
                }
            }
        }
        snapshots.push(snap);
    }

    // ダイアログ実行 — 戻り値 null = キャンセル、object = OK
    var result = runDialog(paths, snapshots);

    if (result !== null) {
        // 1回だけ最終適用（これが唯一の undo エントリになる）
        // okBtn.onClick で restoreSnapshot 済みのため、Cmd+Z 1 回で S0 に戻れる
        previewApply(paths, snapshots, result.corrPct, result.targetAll,
                     false, result.nSamples, result.combScale, result.shapePct);
        deleteCombPath(app.activeDocument);
        app.redraw();

        if (result.doLog) {
            logG2Info(paths, snapshots, result.corrPct, result.targetAll);
        }
        if (result.keepOrig) {
            for (i = 0; i < paths.length; i++) {
                var dup = paths[i].duplicate();
                restoreSnapshot(dup, snapshots[i]);
            }
        }
    }
}());
