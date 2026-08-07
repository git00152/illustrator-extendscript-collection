// =============================================================================
// curve-converter-v2.jsx
//
// v2 Entry Point + Dialog
// Features:
//   Phase A: Per-corner selection UI (rectangles: TL/TR/BL/BR checkboxes)
//   Phase B: Arbitrary polygon support (N-gon: multi-select listbox)
//            Superellipse disabled for non-axis-aligned rectangles
//
// Depends on: lib/math-engine-v2.jsx
//
// ExtendScript (ES3) compatible.
// =============================================================================

#include "lib/math-engine-v2.jsx"

// =============================================================================
// applyPointsV2 — supports per-point pointType ("SMOOTH" or "CORNER")
// =============================================================================

function applyPointsV2(pathItem, pts) {
    var anchors = [];
    var i;
    for (i = 0; i < pts.length; i++) {
        anchors.push(pts[i].anchor);
    }
    pathItem.setEntirePath(anchors);
    pathItem.closed = true;

    for (i = 0; i < pts.length; i++) {
        pathItem.pathPoints[i].leftDirection  = pts[i].leftDirection;
        pathItem.pathPoints[i].rightDirection = pts[i].rightDirection;
        pathItem.pathPoints[i].pointType = (pts[i].pointType === "CORNER")
            ? PointType.CORNER
            : PointType.SMOOTH;
    }
}

// =============================================================================
// Constants
// =============================================================================

var DEFAULT_N_V2 = 4;

var CURVE_TYPE_NAMES_V2 = [
    "Superellipse (Lam\u00E9)",
    "G2 Curvature Continuous",
    "Clothoid",
    "G3 Curvature Continuous"
];

var PRESET_DATA_V2 = [
    { names: ["Ellipse (n=2)", "Squircle (n=4)", "iOS Icon (n=5)"],
      values: [2, 4, 5], defaultIdx: 1 },
    { names: ["Subtle (30%)", "Medium (60%)", "Full (100%)"],
      values: [30, 60, 100], defaultIdx: 1 },
    { names: ["Subtle (30%)", "Medium (60%)", "Full (100%)"],
      values: [30, 60, 100], defaultIdx: 1 },
    { names: ["Subtle (30%)", "Medium (60%)", "Full (100%)"],
      values: [30, 60, 100], defaultIdx: 1 }
];

var SLIDER_RANGES_V2 = [
    { min: 2, max: 20, defaultVal: 4 },
    { min: 1, max: 100, defaultVal: 60 },
    { min: 1, max: 100, defaultVal: 60 },
    { min: 1, max: 100, defaultVal: 60 }
];

// =============================================================================
// Dialog
// =============================================================================

/**
 * runDialogV2(items, snapshots, polyInfos, allowSuperellipse)
 *
 * ScriptUI dialog with:
 *   - Curve type dropdown (Superellipse grayed out if !allowSuperellipse)
 *   - Preset dropdown
 *   - Parameter slider
 *   - Corner selection panel:
 *     - Rectangle mode: 4 checkboxes (TL/TR/BL/BR) + All/None buttons
 *     - Polygon mode: multi-select listbox showing corner angles
 *   - OK / Cancel buttons
 *
 * @param {Array}   items             Array of PathItems to modify
 * @param {Array}   snapshots         Parallel array of snapshots
 * @param {Array}   polyInfos         Parallel array from inspectPolygon()
 * @param {boolean} allowSuperellipse Whether Superellipse is available
 * @return {boolean|number} true (OK) or false (Cancel)
 */
function runDialogV2(items, snapshots, polyInfos, allowSuperellipse) {
    var LABEL_W = 52;   // uniform label width for alignment
    var DROP_W  = 200;  // uniform dropdown width
    var SLIDER_W = 200;

    var dlg = new Window("dialog", "Curve Converter v2");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.margins = [16, 16, 16, 16];
    dlg.spacing = 10;

    // Determine if all items are rectangles (for rectangle-mode UI)
    var allRect = true;
    var i;
    for (i = 0; i < polyInfos.length; i++) {
        if (!polyInfos[i].isRect) { allRect = false; break; }
    }

    // Shape info label
    var infoText = items.length + " shape" + (items.length > 1 ? "s" : "") + " selected";
    if (allRect) {
        infoText += " (rectangle)";
    } else {
        infoText += " (" + polyInfos[0].vertices.length + "-gon)";
    }
    var infoLabel = dlg.add("statictext", undefined, infoText);
    infoLabel.alignment = ["center", "top"];
    infoLabel.graphics.font = ScriptUI.newFont("dialog", "BOLD", 11);

    // Number of corners (for polygon mode)
    var numCorners = polyInfos[0].vertices.length;

    // Corner selection state
    var corners = [];
    for (i = 0; i < numCorners; i++) { corners.push(true); }

    // =================================================================
    // Curve Settings Panel
    // =================================================================
    var curvePanel = dlg.add("panel", undefined, "Curve Settings");
    curvePanel.orientation = "column";
    curvePanel.alignChildren = ["fill", "center"];
    curvePanel.margins = [12, 18, 12, 10];
    curvePanel.spacing = 8;

    // --- Curve type row ---
    var curveRow = curvePanel.add("group");
    curveRow.orientation = "row";
    curveRow.alignChildren = ["left", "center"];
    var curveLabel = curveRow.add("statictext", undefined, "Curve:");
    curveLabel.preferredSize.width = LABEL_W;
    var curveList = curveRow.add("dropdownlist", undefined, CURVE_TYPE_NAMES_V2);
    curveList.preferredSize.width = DROP_W;

    // Disable Superellipse if not allowed
    if (!allowSuperellipse) {
        curveList.items[0].enabled = false;
        curveList.selection = 1;
    } else {
        curveList.selection = 0;
    }

    // --- Preset row ---
    var presetRow = curvePanel.add("group");
    presetRow.orientation = "row";
    presetRow.alignChildren = ["left", "center"];
    var presetLabel = presetRow.add("statictext", undefined, "Preset:");
    presetLabel.preferredSize.width = LABEL_W;
    var presetList = presetRow.add("dropdownlist", undefined, []);
    presetList.preferredSize.width = DROP_W;

    function rebuildPresets(ctIdx) {
        while (presetList.items.length > 0) { presetList.remove(0); }
        var pd = PRESET_DATA_V2[ctIdx];
        for (var pi = 0; pi < pd.names.length; pi++) {
            presetList.add("item", pd.names[pi]);
        }
        presetList.selection = pd.defaultIdx;
    }
    rebuildPresets(allowSuperellipse ? 0 : 1);

    // --- Slider row ---
    var sliderRow = curvePanel.add("group");
    sliderRow.orientation = "row";
    sliderRow.alignChildren = ["left", "center"];
    var sliderLabel = sliderRow.add("statictext", undefined, "Value:");
    sliderLabel.preferredSize.width = LABEL_W;
    var initRange = allowSuperellipse ? SLIDER_RANGES_V2[0] : SLIDER_RANGES_V2[1];
    var slider = sliderRow.add("slider", undefined,
        initRange.defaultVal, initRange.min, initRange.max);
    slider.preferredSize.width = SLIDER_W - 60;
    var nLabel = sliderRow.add("statictext", undefined,
        allowSuperellipse ? "n = 4" : "60%");
    nLabel.preferredSize.width = 55;
    nLabel.justify = "right";

    // =================================================================
    // Corner Selection Panel
    // =================================================================
    var cornerPanel = dlg.add("panel", undefined, "Corners");
    cornerPanel.orientation = "column";
    cornerPanel.alignChildren = ["fill", "center"];
    cornerPanel.margins = [12, 18, 12, 10];
    cornerPanel.spacing = 6;

    var cbTL, cbTR, cbBL, cbBR;
    var cornerCheckboxes, selCountLabel;

    if (allRect) {
        // --- Rectangle mode: spatial checkbox grid with drawn rectangle ---

        // Top row: TL checkbox ... TR checkbox
        var topRow = cornerPanel.add("group");
        topRow.orientation = "row";
        topRow.alignment = ["fill", "center"];
        cbTL = topRow.add("checkbox", undefined, "Top-Left");
        cbTL.value = true;
        cbTL.alignment = ["left", "center"];
        var topSpacer = topRow.add("group");
        topSpacer.alignment = ["fill", "center"];
        cbTR = topRow.add("checkbox", undefined, "Top-Right");
        cbTR.value = true;
        cbTR.alignment = ["right", "center"];

        // Middle: text-based rectangle visualization with corner indicators.
        // Uses Unicode symbols: \u25CF (●) = selected, \u25CB (○) = unselected.
        // All three rows use identical fixed-width columns so the vertical
        // bars align exactly below the corner dots.
        var CHAR_ON  = "\u25CF"; // ●
        var CHAR_OFF = "\u25CB"; // ○
        var H_LINE   = "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500";
        var DOT_W    = 14;   // fixed width for left/right columns
        var CENTER_W = 140;  // fixed width for center column (all rows)

        // Row builder: creates a 3-column row [left(DOT_W), center(CENTER_W), right(DOT_W)]
        // All rows share identical column widths so vertical alignment is exact.
        function addVizRow(leftText, centerText, rightText) {
            var row = cornerPanel.add("group");
            row.orientation = "row";
            row.alignment = ["center", "center"];
            row.margins = 0;
            row.spacing = 0;
            var colL = row.add("statictext", undefined, leftText);
            colL.preferredSize.width = DOT_W;
            colL.justify = "center";
            var colC = row.add("statictext", undefined, centerText);
            colC.preferredSize.width = CENTER_W;
            colC.justify = "center";
            var colR = row.add("statictext", undefined, rightText);
            colR.preferredSize.width = DOT_W;
            colR.justify = "center";
            return { left: colL, center: colC, right: colR };
        }

        var vizTop = addVizRow(CHAR_ON, H_LINE, CHAR_ON);
        var vizMid = addVizRow("\u2502", "", "\u2502");
        var vizBot = addVizRow(CHAR_ON, H_LINE, CHAR_ON);

        // Alias dot elements for updateDots()
        var dotTL = vizTop.left;
        var dotTR = vizTop.right;
        var dotBL = vizBot.left;
        var dotBR = vizBot.right;

        // Function to refresh dot indicators
        function updateDots() {
            dotTL.text = cbTL.value ? CHAR_ON : CHAR_OFF;
            dotTR.text = cbTR.value ? CHAR_ON : CHAR_OFF;
            dotBL.text = cbBL.value ? CHAR_ON : CHAR_OFF;
            dotBR.text = cbBR.value ? CHAR_ON : CHAR_OFF;
        }

        // Bottom row: BL checkbox ... BR checkbox
        var botRow = cornerPanel.add("group");
        botRow.orientation = "row";
        botRow.alignment = ["fill", "center"];
        cbBL = botRow.add("checkbox", undefined, "Bottom-Left");
        cbBL.value = true;
        cbBL.alignment = ["left", "center"];
        var botSpacer = botRow.add("group");
        botSpacer.alignment = ["fill", "center"];
        cbBR = botRow.add("checkbox", undefined, "Bottom-Right");
        cbBR.value = true;
        cbBR.alignment = ["right", "center"];

        // Divider line (thin group)
        var divider = cornerPanel.add("panel", undefined, "");
        divider.alignment = ["fill", "center"];
        divider.preferredSize.height = 2;

        // All / None / Invert buttons + selection count
        var btnCornerRow = cornerPanel.add("group");
        btnCornerRow.orientation = "row";
        btnCornerRow.alignment = ["fill", "center"];
        var allBtn     = btnCornerRow.add("button", undefined, "All");
        var noneBtn    = btnCornerRow.add("button", undefined, "None");
        var invertBtn  = btnCornerRow.add("button", undefined, "Invert");
        allBtn.preferredSize.width = 55;
        noneBtn.preferredSize.width = 55;
        invertBtn.preferredSize.width = 55;
        var cornerSpacer = btnCornerRow.add("group");
        cornerSpacer.alignment = ["fill", "center"];
        var selLabel = btnCornerRow.add("statictext", undefined, "4 / 4");
        selLabel.alignment = ["right", "center"];
        selLabel.helpTip = "Selected corners / Total corners";

        // helpTips
        cbTL.helpTip = "Round the top-left corner";
        cbTR.helpTip = "Round the top-right corner";
        cbBL.helpTip = "Round the bottom-left corner";
        cbBR.helpTip = "Round the bottom-right corner";
        allBtn.helpTip    = "Select all corners";
        noneBtn.helpTip   = "Deselect all corners";
        invertBtn.helpTip = "Invert corner selection";

        function updateSelLabel() {
            var count = 0;
            if (cbTL.value) count++;
            if (cbTR.value) count++;
            if (cbBL.value) count++;
            if (cbBR.value) count++;
            selLabel.text = count + " / 4";
        }

        function readRectCorners() {
            corners = [cbTL.value, cbTR.value, cbBL.value, cbBR.value];
            updateSelLabel();
            updateDots();
        }

        function setAllCheckboxes(val) {
            cbTL.value = val;
            cbTR.value = val;
            cbBL.value = val;
            cbBR.value = val;
            readRectCorners();
        }

        cbTL.onClick = function () { readRectCorners(); doPreview(); };
        cbTR.onClick = function () { readRectCorners(); doPreview(); };
        cbBL.onClick = function () { readRectCorners(); doPreview(); };
        cbBR.onClick = function () { readRectCorners(); doPreview(); };

        allBtn.onClick = function () {
            setAllCheckboxes(true);
            doPreview();
        };
        noneBtn.onClick = function () {
            setAllCheckboxes(false);
            doPreview();
        };
        invertBtn.onClick = function () {
            cbTL.value = !cbTL.value;
            cbTR.value = !cbTR.value;
            cbBL.value = !cbBL.value;
            cbBR.value = !cbBR.value;
            readRectCorners();
            doPreview();
        };
    } else {
        // --- Polygon mode: per-corner checkboxes with All/None ---
        cornerCheckboxes = [];
        var angleDeg;
        for (i = 0; i < numCorners; i++) {
            angleDeg = Math.round(Math.abs(polyInfos[0].vertices[i].angle) * 180 / Math.PI);
            var cb = cornerPanel.add("checkbox", undefined,
                "Corner " + (i + 1) + "   " + angleDeg + "\u00B0");
            cb.value = true;
            cornerCheckboxes.push(cb);
        }

        // Divider
        var polyDivider = cornerPanel.add("panel", undefined, "");
        polyDivider.alignment = ["fill", "center"];
        polyDivider.preferredSize.height = 2;

        // Buttons + count
        var polyBtnRow = cornerPanel.add("group");
        polyBtnRow.orientation = "row";
        polyBtnRow.alignment = ["fill", "center"];
        var polyAllBtn  = polyBtnRow.add("button", undefined, "All");
        var polyNoneBtn = polyBtnRow.add("button", undefined, "None");
        polyAllBtn.preferredSize.width = 55;
        polyNoneBtn.preferredSize.width = 55;
        var polySpacer = polyBtnRow.add("group");
        polySpacer.alignment = ["fill", "center"];
        selCountLabel = polyBtnRow.add("statictext", undefined,
            numCorners + " / " + numCorners);
        selCountLabel.alignment = ["right", "center"];
        selCountLabel.helpTip = "Selected corners / Total corners";

        function updatePolySelCount() {
            var count = 0;
            for (var ci = 0; ci < numCorners; ci++) {
                if (corners[ci]) count++;
            }
            selCountLabel.text = count + " / " + numCorners;
        }

        // Wire up each checkbox with closure
        (function () {
            for (var ci = 0; ci < numCorners; ci++) {
                (function (idx) {
                    cornerCheckboxes[idx].onClick = function () {
                        corners[idx] = cornerCheckboxes[idx].value;
                        updatePolySelCount();
                        doPreview();
                    };
                }(ci));
            }
        }());

        polyAllBtn.onClick = function () {
            for (var ci = 0; ci < numCorners; ci++) {
                cornerCheckboxes[ci].value = true;
                corners[ci] = true;
            }
            updatePolySelCount();
            doPreview();
        };
        polyNoneBtn.onClick = function () {
            for (var ci = 0; ci < numCorners; ci++) {
                cornerCheckboxes[ci].value = false;
                corners[ci] = false;
            }
            updatePolySelCount();
            doPreview();
        };
    }

    // =================================================================
    // OK / Cancel
    // =================================================================
    var btnRow = dlg.add("group");
    btnRow.orientation = "row";
    btnRow.alignment = ["right", "center"];
    btnRow.margins = [0, 4, 0, 0];
    var cancelBtn = btnRow.add("button", undefined, "Cancel", { name: "cancel" });
    var okBtn     = btnRow.add("button", undefined, "OK",     { name: "ok" });

    // --- helpTip assignments ---
    curveLabel.helpTip = "Select the curve algorithm for corner rounding";
    curveList.helpTip  = "Superellipse: Lam\u00E9 curve / G2: curvature-continuous / Clothoid: Euler spiral / G3: curvature+derivative continuous";
    presetLabel.helpTip = "Choose a named preset to jump to a common value";
    presetList.helpTip  = "Choose a named preset to jump to a common value";
    sliderLabel.helpTip = "Adjust the curve parameter";
    slider.helpTip      = "Drag to adjust the curve parameter";
    nLabel.helpTip      = "Current parameter value";
    okBtn.helpTip       = "Apply the current shape to all selected shapes";
    cancelBtn.helpTip   = "Cancel and restore all shapes to their original form";

    // --- Helpers ---
    function formatLabel(val, ctIdx) {
        if (ctIdx === 0) return "n = " + val;
        return val + "%";
    }

    function getCurveIdx() {
        if (curveList.selection === null) return allowSuperellipse ? 0 : 1;
        return curveList.selection.index;
    }

    // --- Shared preview function ---
    function doPreview() {
        var val   = Math.round(slider.value);
        var ctIdx = getCurveIdx();
        nLabel.text = formatLabel(val, ctIdx);

        var k, pInfo, pts, vertCorners, vc, vertCount;
        for (k = 0; k < items.length; k++) {
            pInfo = polyInfos[k];
            vertCount = pInfo.vertices.length;

            // Map UI corners to vertex indices
            if (pInfo.isRect && allRect) {
                vertCorners = cornersUIToVertices(corners, pInfo);
            } else {
                vertCorners = corners;
            }

            // Guard: pad or truncate to match this item's vertex count
            if (vertCorners.length !== vertCount) {
                vc = [];
                for (var vi = 0; vi < vertCount; vi++) {
                    vc.push(vi < vertCorners.length ? vertCorners[vi] : true);
                }
                vertCorners = vc;
            }

            if (ctIdx === 0) {
                // Superellipse (only for axis-aligned rects)
                pts = computeSuperellipsePointsV2(
                    pInfo.cx, pInfo.cy, pInfo.a, pInfo.b, val, corners);
            } else if (ctIdx === 1) {
                pts = computeG2PointsV2(pInfo, val, vertCorners);
            } else if (ctIdx === 2) {
                pts = computeClothoidPointsV2(pInfo, val, vertCorners);
            } else {
                pts = computeG3PointsV2(pInfo, val, vertCorners);
            }
            applyPointsV2(items[k], pts);
        }
        app.redraw();
    }

    // --- Event handlers ---
    slider.onChanging = function () {
        doPreview();
    };

    presetList.onChange = function () {
        if (this.selection === null) return;
        var ctIdx = getCurveIdx();
        var val = PRESET_DATA_V2[ctIdx].values[this.selection.index];
        slider.value = val;
        doPreview();
    };

    curveList.onChange = function () {
        if (this.selection === null) return;
        var ctIdx = this.selection.index;

        // Block Superellipse for non-axis-aligned shapes
        if (ctIdx === 0 && !allowSuperellipse) {
            curveList.selection = 1;
            return;
        }

        rebuildPresets(ctIdx);
        var sr = SLIDER_RANGES_V2[ctIdx];
        slider.minvalue = sr.min;
        slider.maxvalue = sr.max;
        slider.value    = sr.defaultVal;
        doPreview();
    };

    okBtn.onClick     = function () { dlg.close(true); };
    cancelBtn.onClick = function () { dlg.close(false); };

    return dlg.show();
}

// =============================================================================
// Entry Point
// =============================================================================

(function () {
    // a) Guard: no document open
    if (app.documents.length === 0) {
        alert("No document is open.");
        return;
    }

    // b) Get selection
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
        alert("Nothing is selected. Select one or more shapes and run again.");
        return;
    }

    // c) Filter to valid polygons (closed, all CORNER points, 3+ vertices)
    var polys = filterPolygons(sel);
    if (polys.length === 0) {
        alert("No valid shapes found. Select one or more closed polygons " +
              "(all corner points, no curves) and run again.");
        return;
    }

    // d) Filter to editable items
    var editableItems = [];
    var i, item;
    for (i = 0; i < polys.length; i++) {
        item = polys[i];
        if (item.editable) {
            editableItems.push(item);
        } else {
            alert("Skipping locked or hidden path" +
                  (item.name ? ": " + item.name : "."));
        }
    }
    if (editableItems.length === 0) {
        alert("All selected shapes are locked or hidden.");
        return;
    }

    // e) Take snapshots and inspect polygon geometry
    var snapshots = [];
    var polyInfos = [];
    for (i = 0; i < editableItems.length; i++) {
        snapshots.push(takeSnapshot(editableItems[i]));
        polyInfos.push(inspectPolygon(editableItems[i]));
    }

    // f) Determine if Superellipse is available
    //    Only for shapes where ALL items are axis-aligned rectangles
    var allowSuperellipse = true;
    for (i = 0; i < polyInfos.length; i++) {
        if (!_isAxisAligned(polyInfos[i])) {
            allowSuperellipse = false;
            break;
        }
    }

    // g) Apply initial preview
    var ctIdx = allowSuperellipse ? 0 : 1;
    var initVal = SLIDER_RANGES_V2[ctIdx].defaultVal;
    var initCorners = [];
    var numVerts = polyInfos[0].vertices.length;
    for (i = 0; i < numVerts; i++) { initCorners.push(true); }

    var pts;
    for (i = 0; i < editableItems.length; i++) {
        if (ctIdx === 0) {
            // Superellipse: use UI corners [TL, TR, BL, BR] = all true
            pts = computeSuperellipsePointsV2(
                polyInfos[i].cx, polyInfos[i].cy,
                polyInfos[i].a, polyInfos[i].b,
                initVal, [true, true, true, true]);
        } else {
            pts = computeG2PointsV2(polyInfos[i], initVal, initCorners);
        }
        applyPointsV2(editableItems[i], pts);
    }
    app.redraw();

    // h) Show dialog
    var confirmed = runDialogV2(editableItems, snapshots, polyInfos, allowSuperellipse);
    if (!confirmed) {
        for (i = 0; i < editableItems.length; i++) {
            restoreSnapshot(editableItems[i], snapshots[i]);
        }
        app.redraw();
    }
}());
