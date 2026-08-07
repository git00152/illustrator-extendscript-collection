// =============================================================================
// math-engine-v2.jsx
//
// v2 Math Engine: Generalized curve engine with per-corner selection and
// arbitrary polygon support.
//
// Phase A: Per-corner selection for rectangles (all curve types)
// Phase B: Arbitrary convex polygon support (G2/Clothoid/G3 only)
//
// ExtendScript (ES3) compatible: var only, no arrow functions, no template
// literals, no let/const, no Math.sign, no forEach/map/Array.isArray.
// =============================================================================

// =============================================================================
// Utility functions (carried over from v1)
// =============================================================================

function inspectRect(pathItem) {
    var bounds = pathItem.geometricBounds;
    var left   = bounds[0];
    var top    = bounds[1];
    var right  = bounds[2];
    var bottom = bounds[3];
    return {
        cx: (left + right)  / 2,
        cy: (top  + bottom) / 2,
        a:  (right - left)  / 2,
        b:  (top   - bottom) / 2
    };
}

function takeSnapshot(pathItem) {
    var pts  = pathItem.pathPoints;
    var snap = [];
    for (var i = 0; i < pts.length; i++) {
        var pt = pts[i];
        snap.push({
            anchor:         [pt.anchor[0],         pt.anchor[1]],
            leftDirection:  [pt.leftDirection[0],  pt.leftDirection[1]],
            rightDirection: [pt.rightDirection[0], pt.rightDirection[1]],
            pointType:      pt.pointType
        });
    }
    return snap;
}

function restoreSnapshot(pathItem, snap) {
    var anchors = [];
    var i;
    for (i = 0; i < snap.length; i++) {
        anchors.push(snap[i].anchor);
    }
    pathItem.setEntirePath(anchors);
    pathItem.closed = true;
    for (i = 0; i < snap.length; i++) {
        pathItem.pathPoints[i].leftDirection  = snap[i].leftDirection;
        pathItem.pathPoints[i].rightDirection = snap[i].rightDirection;
        pathItem.pathPoints[i].pointType      = snap[i].pointType;
    }
}

function signOf(x) {
    if (x > 0) return 1;
    if (x < 0) return -1;
    return 0;
}

function superellipsePoint(a, b, n, t) {
    var cosT = Math.cos(t);
    var sinT = Math.sin(t);
    var exp  = 2 / n;
    return [
        a * signOf(cosT) * Math.pow(Math.abs(cosT), exp),
        b * signOf(sinT) * Math.pow(Math.abs(sinT), exp)
    ];
}

function superellipseTangent(a, b, n, t) {
    var cosT   = Math.cos(t);
    var sinT   = Math.sin(t);
    var exp    = 2 / n;
    var absCos = Math.abs(cosT);
    var absSin = Math.abs(sinT);
    var dxdt = (absCos < 1e-10) ? 0 : -(exp) * a * Math.pow(absCos, exp - 1) * sinT;
    var dydt = (absSin < 1e-10) ? 0 :  (exp) * b * Math.pow(absSin, exp - 1) * cosT;
    return [dxdt, dydt];
}

function computeSuperellipsePoints(cx, cy, a, b, n) {
    if (n <= 2) {
        var kappa = 0.5522847498;
        return [
            { anchor: [cx + a, cy],     rightDirection: [cx + a, cy + kappa * b],     leftDirection: [cx + a, cy - kappa * b] },
            { anchor: [cx,     cy + b], rightDirection: [cx - kappa * a, cy + b],     leftDirection: [cx + kappa * a, cy + b] },
            { anchor: [cx - a, cy],     rightDirection: [cx - a, cy - kappa * b],     leftDirection: [cx - a, cy + kappa * b] },
            { anchor: [cx,     cy - b], rightDirection: [cx + kappa * a, cy - b],     leftDirection: [cx - kappa * a, cy - b] }
        ];
    }
    var TOTAL;
    if (n <= 5)       { TOTAL = 8; }
    else if (n <= 10) { TOTAL = 12; }
    else              { TOTAL = 16; }
    var dt  = (2 * Math.PI) / TOTAL;
    var pts = [];
    var i, t0, p0, tang0;
    for (i = 0; i < TOTAL; i++) {
        t0    = (i + 0.5) * dt;
        p0    = superellipsePoint(a, b, n, t0);
        tang0 = superellipseTangent(a, b, n, t0);
        pts.push({
            anchor:         [cx + p0[0],                       cy + p0[1]],
            rightDirection: [cx + p0[0] + (dt / 3) * tang0[0], cy + p0[1] + (dt / 3) * tang0[1]],
            leftDirection:  [cx + p0[0] - (dt / 3) * tang0[0], cy + p0[1] - (dt / 3) * tang0[1]]
        });
    }
    return pts;
}

// =============================================================================
// Phase B: Polygon inspection and filtering
// =============================================================================

/**
 * inspectPolygon(pathItem)
 *
 * Extracts per-vertex geometric information from any closed polygon.
 * For each vertex: position, edge directions, edge lengths, turning angle.
 *
 * @param  {PathItem} pathItem
 * @return {Object}   { vertices: Array, isRect: boolean, cx, cy, a, b (if isRect) }
 */
function inspectPolygon(pathItem) {
    var pts = pathItem.pathPoints;
    var n = pts.length;
    var vertices = [];
    var i, prev, curr, next;
    var inX, inY, outX, outY, inLen, outLen;
    var inDirX, inDirY, outDirX, outDirY;
    var cross, dot, angle;

    for (i = 0; i < n; i++) {
        prev = pts[(i - 1 + n) % n];
        curr = pts[i];
        next = pts[(i + 1) % n];

        inX = curr.anchor[0] - prev.anchor[0];
        inY = curr.anchor[1] - prev.anchor[1];
        outX = next.anchor[0] - curr.anchor[0];
        outY = next.anchor[1] - curr.anchor[1];

        inLen = Math.sqrt(inX * inX + inY * inY);
        outLen = Math.sqrt(outX * outX + outY * outY);

        inDirX = inLen > 1e-10 ? inX / inLen : 0;
        inDirY = inLen > 1e-10 ? inY / inLen : 0;
        outDirX = outLen > 1e-10 ? outX / outLen : 0;
        outDirY = outLen > 1e-10 ? outY / outLen : 0;

        // Signed turning angle: positive = CCW, negative = CW
        cross = inDirX * outDirY - inDirY * outDirX;
        dot   = inDirX * outDirX + inDirY * outDirY;
        angle = Math.atan2(cross, dot);

        vertices.push({
            x: curr.anchor[0],
            y: curr.anchor[1],
            inDirX: inDirX,
            inDirY: inDirY,
            outDirX: outDirX,
            outDirY: outDirY,
            inLength: inLen,
            outLength: outLen,
            angle: angle
        });
    }

    // Detect rectangle: 4 vertices, all angles ~90 degrees
    var isRect = false;
    if (n === 4) {
        isRect = true;
        for (i = 0; i < 4; i++) {
            if (Math.abs(Math.abs(vertices[i].angle) - Math.PI / 2) > 0.01) {
                isRect = false;
                break;
            }
        }
    }

    var result = { vertices: vertices, isRect: isRect };

    if (isRect) {
        var bounds = pathItem.geometricBounds;
        result.cx = (bounds[0] + bounds[2]) / 2;
        result.cy = (bounds[1] + bounds[3]) / 2;
        result.a  = (bounds[2] - bounds[0]) / 2;
        result.b  = (bounds[1] - bounds[3]) / 2;
    }

    return result;
}

/**
 * filterPolygons(selection)
 *
 * Filters selection to closed polygons with all CORNER-type points.
 * Accepts 3+ point polygons (not limited to 4-point rectangles).
 *
 * @param  {Object} selection  app.activeDocument.selection
 * @return {Array}  Array of qualifying PathItems
 */
function filterPolygons(selection) {
    var result = [];
    var i, j, item, allCorners;
    for (i = 0; i < selection.length; i++) {
        item = selection[i];
        if (item.typename !== "PathItem") { continue; }
        if (item.pathPoints.length < 3)   { continue; }
        if (item.closed !== true)         { continue; }
        allCorners = true;
        for (j = 0; j < item.pathPoints.length; j++) {
            if (item.pathPoints[j].pointType !== PointType.CORNER) {
                allCorners = false;
                break;
            }
        }
        if (allCorners) {
            result.push(item);
        }
    }
    return result;
}

/**
 * _isAxisAligned(polyInfo)
 *
 * Returns true if a rectangle's edges are horizontal/vertical.
 * Superellipse only works for axis-aligned rectangles.
 */
function _isAxisAligned(polyInfo) {
    if (!polyInfo.isRect) return false;
    var v = polyInfo.vertices;
    for (var i = 0; i < 4; i++) {
        if (Math.min(Math.abs(v[i].outDirX), Math.abs(v[i].outDirY)) > 0.01) {
            return false;
        }
    }
    return true;
}

/**
 * _mapRectCorners(polyInfo)
 *
 * Maps vertex indices to TL/TR/BL/BR positions for an axis-aligned rectangle.
 * Returns { tl, tr, bl, br } where each value is a vertex index (0-3).
 */
function _mapRectCorners(polyInfo) {
    var v = polyInfo.vertices;
    var cx = polyInfo.cx, cy = polyInfo.cy;
    var map = { tl: 0, tr: 1, bl: 3, br: 2 };
    for (var i = 0; i < 4; i++) {
        var isLeft = v[i].x < cx;
        var isTop  = v[i].y > cy;
        if (isLeft && isTop)       { map.tl = i; }
        else if (!isLeft && isTop) { map.tr = i; }
        else if (isLeft && !isTop) { map.bl = i; }
        else                       { map.br = i; }
    }
    return map;
}

/**
 * cornersUIToVertices(uiCorners, polyInfo)
 *
 * Converts UI corners array [TL, TR, BL, BR] to a per-vertex corners array
 * for axis-aligned rectangles. For non-rectangles, returns uiCorners directly.
 *
 * @param  {Array}  uiCorners  [TL, TR, BL, BR] booleans
 * @param  {Object} polyInfo   From inspectPolygon()
 * @return {Array}  Per-vertex boolean array
 */
function cornersUIToVertices(uiCorners, polyInfo) {
    if (!polyInfo.isRect) return uiCorners;
    var map = _mapRectCorners(polyInfo);
    var result = [false, false, false, false];
    result[map.tl] = uiCorners[0];
    result[map.tr] = uiCorners[1];
    result[map.bl] = uiCorners[2];
    result[map.br] = uiCorners[3];
    return result;
}

// =============================================================================
// Phase B: Generalized rotation and corner curve math
// =============================================================================

/**
 * _rotatePoint(x, y, angle)
 *
 * Rotates a 2D point (x, y) by the given angle (radians, CCW positive).
 */
function _rotatePoint(x, y, angle) {
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    return [x * c - y * s, x * s + y * c];
}

/**
 * _cornerThetaV2(t, curveType, cornerAngle)
 *
 * Generalized tangent angle for a corner curve at parameter t (0..1).
 * The angle sweeps from 0 to cornerAngle.
 * When cornerAngle = PI/2, produces identical results to v1.
 *
 * curveType 0 = G2:       cornerAngle * (3t^2 - 2t^3)
 * curveType 1 = Clothoid: piecewise quadratic
 * curveType 2 = G3:       cornerAngle * (10t^3 - 15t^4 + 6t^5)
 */
function _cornerThetaV2(t, curveType, cornerAngle) {
    if (curveType === 0) {
        // G2: cubic Hermite
        return cornerAngle * (3 * t * t - 2 * t * t * t);
    }
    if (curveType === 1) {
        // Clothoid: piecewise quadratic, generalized from PI/2
        if (t <= 0.5) {
            return 2 * cornerAngle * t * t;
        }
        var u = t - 0.5;
        return cornerAngle / 2 + 2 * cornerAngle * u - 2 * cornerAngle * u * u;
    }
    // G3: quintic smootherstep
    var t2 = t * t;
    var t3 = t2 * t;
    return cornerAngle * (10 * t3 - 15 * t2 * t2 + 6 * t2 * t3);
}

/**
 * _integrateCornerV2(curveType, cornerAngle)
 *
 * Numerically integrates a unit corner curve for the given angle.
 * Returns { xs, ys, endX, endY, N }.
 * For cornerAngle = PI/2, endX ~ endY (symmetric).
 */
function _integrateCornerV2(curveType, cornerAngle) {
    var N = 200;
    var h = 1.0 / N;
    var xs = [0];
    var ys = [0];
    var x = 0, y = 0;
    var i, theta;
    for (i = 1; i <= N; i++) {
        theta = _cornerThetaV2((i - 0.5) * h, curveType, cornerAngle);
        x += Math.cos(theta) * h;
        y += Math.sin(theta) * h;
        xs.push(x);
        ys.push(y);
    }
    return { xs: xs, ys: ys, endX: x, endY: y, N: N };
}

// Integration table cache: keyed by "curveType_cornerAngle" (angle rounded to 0.001)
var _integrationCache = {};

function _getCachedIntegration(curveType, cornerAngle) {
    var key = curveType + "_" + (Math.round(cornerAngle * 1000) / 1000);
    if (!_integrationCache[key]) {
        _integrationCache[key] = _integrateCornerV2(curveType, cornerAngle);
    }
    return _integrationCache[key];
}

// =============================================================================
// Phase A+B: Corner curve computation for polygons with per-corner selection
// =============================================================================

/**
 * _computeCornerCurvePointsV2(polyInfo, roundness, curveType, corners)
 *
 * Computes PathPoint data for a polygon with per-corner curve selection.
 * Selected corners get PER_CORNER sample points; unselected corners get
 * one CORNER-type point at the original vertex position.
 *
 * Works for rectangles (Phase A) and arbitrary convex polygons (Phase B).
 *
 * @param  {Object} polyInfo   From inspectPolygon()
 * @param  {number} roundness  1..100
 * @param  {number} curveType  0=G2, 1=Clothoid, 2=G3
 * @param  {Array}  corners    Per-vertex boolean array
 * @return {Array}  Point objects with anchor, leftDirection, rightDirection, pointType
 */
function _computeCornerCurvePointsV2(polyInfo, roundness, curveType, corners) {
    var MIN_ANGLE = Math.PI / 36; // 5 degrees minimum for rounding
    var PER_CORNER; // set per-vertex based on turning angle
    var vertices = polyInfo.vertices;
    var numVerts = vertices.length;
    var allPts = []; // intermediate format: { px, py, tx, ty, isCorner }

    var i, j, v, absAngle, isConvex, selected;
    var table, sinA, cosA, dInUnit, dOutUnit, maxScale, scale;
    var baseAngle, sign, startX, startY;
    var t, idx, theta, lx, ly, rp, thetaWorld;

    for (i = 0; i < numVerts; i++) {
        v = vertices[i];
        absAngle = Math.abs(v.angle);
        // Only round convex corners with sufficient angle
        isConvex = absAngle > MIN_ANGLE && absAngle < Math.PI;
        selected = corners[i] && isConvex;

        // Adaptive sampling: large turns (>=120 deg) need more points for accurate Bezier approximation
        PER_CORNER = (absAngle >= 2 * Math.PI / 3) ? 6 : 4;

        if (!selected) {
            // Emit original vertex as a CORNER point
            allPts.push({
                px: v.x, py: v.y,
                tx: v.outDirX, ty: v.outDirY,
                isCorner: true
            });
            continue;
        }

        // Get integration table for this corner angle
        table = _getCachedIntegration(curveType, absAngle);

        // Compute scale factor from edge consumption
        sinA = Math.sin(absAngle);
        cosA = Math.cos(absAngle);

        // Guard against degenerate angles
        if (Math.abs(sinA) < 1e-10) {
            allPts.push({
                px: v.x, py: v.y,
                tx: v.outDirX, ty: v.outDirY,
                isCorner: true
            });
            continue;
        }

        // Edge consumption in unit curve coordinates
        dInUnit  = table.endX - table.endY * cosA / sinA;
        dOutUnit = table.endY / sinA;

        if (dInUnit < 1e-6)  dInUnit  = 1e-6;
        if (dOutUnit < 1e-6) dOutUnit = 1e-6;

        // Scale: ensure curve fits within half of each adjacent edge
        maxScale = Math.min(
            v.inLength / (2 * dInUnit),
            v.outLength / (2 * dOutUnit)
        );
        scale = (roundness / 100) * maxScale;
        if (scale < 0.001) scale = 0.001;

        // Base angle: rotation from local frame to world frame
        baseAngle = Math.atan2(v.inDirY, v.inDirX);
        sign = (v.angle >= 0) ? 1 : -1; // CCW or CW turn

        // Curve start position (on incoming edge, dIn before vertex)
        startX = v.x - scale * dInUnit * v.inDirX;
        startY = v.y - scale * dInUnit * v.inDirY;

        for (j = 0; j < PER_CORNER; j++) {
            t = j / (PER_CORNER - 1); // 0, 1/3, 2/3, 1
            idx = Math.round(t * table.N);
            if (idx > table.N) idx = table.N;
            theta = _cornerThetaV2(t, curveType, absAngle);

            // Local position (scaled), mirrored for CW turns
            lx = table.xs[idx] * scale;
            ly = table.ys[idx] * scale * sign;

            // Rotate to world frame
            rp = _rotatePoint(lx, ly, baseAngle);

            // Tangent direction in world frame
            thetaWorld = baseAngle + theta * sign;

            allPts.push({
                px: startX + rp[0],
                py: startY + rp[1],
                tx: Math.cos(thetaWorld),
                ty: Math.sin(thetaWorld),
                isCorner: false
            });
        }
    }

    // Convert intermediate format to Bezier point format
    var result = [];
    var n = allPts.length;
    var k, p, prev, next, tLen, ux, uy, dPrev, dNext;

    for (k = 0; k < n; k++) {
        p    = allPts[k];
        prev = allPts[(k - 1 + n) % n];
        next = allPts[(k + 1) % n];

        if (p.isCorner) {
            // CORNER point: handles coincide with anchor
            result.push({
                anchor:         [p.px, p.py],
                rightDirection: [p.px, p.py],
                leftDirection:  [p.px, p.py],
                pointType:      "CORNER"
            });
            continue;
        }

        // SMOOTH point: handles from tangent direction and neighbor distance
        tLen = Math.sqrt(p.tx * p.tx + p.ty * p.ty);
        ux = (tLen > 1e-10) ? p.tx / tLen : 0;
        uy = (tLen > 1e-10) ? p.ty / tLen : 0;

        dNext = Math.sqrt(
            (next.px - p.px) * (next.px - p.px) +
            (next.py - p.py) * (next.py - p.py)
        );
        dPrev = Math.sqrt(
            (p.px - prev.px) * (p.px - prev.px) +
            (p.py - prev.py) * (p.py - prev.py)
        );

        result.push({
            anchor:         [p.px, p.py],
            rightDirection: [p.px + (dNext / 3) * ux, p.py + (dNext / 3) * uy],
            leftDirection:  [p.px - (dPrev / 3) * ux, p.py - (dPrev / 3) * uy],
            pointType:      "SMOOTH"
        });
    }

    return result;
}

// =============================================================================
// Phase A: Superellipse with per-corner selection (axis-aligned rectangles)
// =============================================================================

/**
 * computeSuperellipsePointsV2(cx, cy, a, b, n, corners)
 *
 * Superellipse with per-corner selection. Only for axis-aligned rectangles.
 * corners = [TL, TR, BL, BR] booleans (already mapped to UI order).
 *
 * Each quadrant (CCW from t=0):
 *   Q0 = TR, Q1 = TL, Q2 = BL, Q3 = BR
 *
 * Selected quadrants get superellipse curve points.
 * Unselected quadrants get the sharp rectangle corner.
 */
function computeSuperellipsePointsV2(cx, cy, a, b, n, corners) {
    // Map UI corners [TL, TR, BL, BR] to quadrant order [TR, TL, BL, BR]
    var qCorners = [corners[1], corners[0], corners[2], corners[3]];

    // If all selected, delegate to standard function
    var allSel = qCorners[0] && qCorners[1] && qCorners[2] && qCorners[3];
    if (allSel) {
        return computeSuperellipsePoints(cx, cy, a, b, n);
    }

    // Axis crossing points (boundaries between quadrants, CCW order)
    var axX = [cx + a, cx,     cx - a, cx    ];
    var axY = [cy,     cy + b, cy,     cy - b];

    // Rectangle corner vertices per quadrant
    var rcX = [cx + a, cx - a, cx - a, cx + a];
    var rcY = [cy + b, cy + b, cy - b, cy - b];

    if (n <= 2) {
        return _superellipseCornerN2(cx, cy, a, b, axX, axY, rcX, rcY, qCorners);
    }
    return _superellipseCornerNgt2(cx, cy, a, b, n, axX, axY, rcX, rcY, qCorners);
}

/**
 * Ellipse (n<=2) with per-corner selection.
 * Selected quadrants use kappa handles; unselected get the sharp corner vertex.
 */
function _superellipseCornerN2(cx, cy, a, b, axX, axY, rcX, rcY, qCorners) {
    var kappa = 0.5522847498;
    var pts = [];

    // Handle offsets for each axis point's right/left handles
    // rightH = toward the next quadrant, leftH = from the previous quadrant
    var hrX = [0, -kappa * a, 0,  kappa * a]; // right handle X offset
    var hrY = [kappa * b, 0, -kappa * b, 0];  // right handle Y offset
    var hlX = [0,  kappa * a, 0, -kappa * a]; // left handle X offset
    var hlY = [-kappa * b, 0,  kappa * b, 0]; // left handle Y offset

    var q, prevQ, rh0, rh1, lh0, lh1, pType;

    for (q = 0; q < 4; q++) {
        prevQ = (q + 3) % 4;

        // Right handle: extends into quadrant q
        if (qCorners[q]) {
            rh0 = axX[q] + hrX[q];
            rh1 = axY[q] + hrY[q];
        } else {
            rh0 = axX[q];
            rh1 = axY[q];
        }

        // Left handle: extends into quadrant prevQ
        if (qCorners[prevQ]) {
            lh0 = axX[q] + hlX[q];
            lh1 = axY[q] + hlY[q];
        } else {
            lh0 = axX[q];
            lh1 = axY[q];
        }

        pType = (qCorners[q] || qCorners[prevQ]) ? "SMOOTH" : "CORNER";

        pts.push({
            anchor:         [axX[q], axY[q]],
            rightDirection: [rh0, rh1],
            leftDirection:  [lh0, lh1],
            pointType:      pType
        });

        // If quadrant q is not selected, add the sharp rectangle corner
        if (!qCorners[q]) {
            pts.push({
                anchor:         [rcX[q], rcY[q]],
                rightDirection: [rcX[q], rcY[q]],
                leftDirection:  [rcX[q], rcY[q]],
                pointType:      "CORNER"
            });
        }
    }

    return pts;
}

/**
 * Superellipse n>2 with per-corner selection.
 * Selected quadrants get sampled curve points; unselected get axis + corner + axis.
 */
function _superellipseCornerNgt2(cx, cy, a, b, n, axX, axY, rcX, rcY, qCorners) {
    // Points per quadrant (matches v1 total / 4)
    var TOTAL;
    if (n <= 5)       { TOTAL = 8; }
    else if (n <= 10) { TOTAL = 12; }
    else              { TOTAL = 16; }
    var PER_Q = TOTAL / 4;

    var segments = []; // array of arrays of point objects
    var q, j, seg, t, p, tang, dt, qStart, qEnd, nextQ;

    for (q = 0; q < 4; q++) {
        seg = [];
        qStart = q * Math.PI / 2;
        qEnd   = (q + 1) * Math.PI / 2;
        nextQ  = (q + 1) % 4;

        if (qCorners[q]) {
            // Sample superellipse within this quadrant
            dt = (qEnd - qStart) / PER_Q;
            for (j = 0; j < PER_Q; j++) {
                t    = qStart + (j + 0.5) * dt; // half-step offset
                p    = superellipsePoint(a, b, n, t);
                tang = superellipseTangent(a, b, n, t);
                seg.push({
                    anchor:         [cx + p[0],                       cy + p[1]],
                    rightDirection: [cx + p[0] + (dt / 3) * tang[0], cy + p[1] + (dt / 3) * tang[1]],
                    leftDirection:  [cx + p[0] - (dt / 3) * tang[0], cy + p[1] - (dt / 3) * tang[1]],
                    pointType:      "SMOOTH"
                });
            }
        } else {
            // Sharp corner: axis start -> corner vertex -> axis end
            seg.push({
                anchor: [axX[q], axY[q]],
                rightDirection: [axX[q], axY[q]],
                leftDirection: [axX[q], axY[q]],
                pointType: "CORNER"
            });
            seg.push({
                anchor: [rcX[q], rcY[q]],
                rightDirection: [rcX[q], rcY[q]],
                leftDirection: [rcX[q], rcY[q]],
                pointType: "CORNER"
            });
            seg.push({
                anchor: [axX[nextQ], axY[nextQ]],
                rightDirection: [axX[nextQ], axY[nextQ]],
                leftDirection: [axX[nextQ], axY[nextQ]],
                pointType: "CORNER"
            });
        }

        segments.push(seg);
    }

    // Merge segments, deduplicating shared axis points at boundaries
    var pts = [];
    var si, sj, pt, last, dx, dy;
    for (si = 0; si < segments.length; si++) {
        seg = segments[si];
        for (sj = 0; sj < seg.length; sj++) {
            pt = seg[sj];
            if (pts.length > 0) {
                last = pts[pts.length - 1];
                dx = pt.anchor[0] - last.anchor[0];
                dy = pt.anchor[1] - last.anchor[1];
                if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
                    // Merge: keep left handle of existing, use right handle of new
                    last.rightDirection = pt.rightDirection;
                    if (pt.pointType === "SMOOTH") last.pointType = "SMOOTH";
                    continue;
                }
            }
            pts.push({
                anchor:         pt.anchor,
                rightDirection: pt.rightDirection,
                leftDirection:  pt.leftDirection,
                pointType:      pt.pointType
            });
        }
    }

    // Check wraparound: first and last point might overlap
    if (pts.length > 1) {
        last = pts[pts.length - 1];
        dx = pts[0].anchor[0] - last.anchor[0];
        dy = pts[0].anchor[1] - last.anchor[1];
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            pts[0].leftDirection = last.leftDirection;
            if (last.pointType === "SMOOTH") pts[0].pointType = "SMOOTH";
            pts.pop();
        }
    }

    return pts;
}

// =============================================================================
// Public API: v2 curve computation functions
// =============================================================================

/**
 * computeG2PointsV2(polyInfo, roundness, corners)
 */
function computeG2PointsV2(polyInfo, roundness, corners) {
    return _computeCornerCurvePointsV2(polyInfo, roundness, 0, corners);
}

/**
 * computeClothoidPointsV2(polyInfo, roundness, corners)
 */
function computeClothoidPointsV2(polyInfo, roundness, corners) {
    return _computeCornerCurvePointsV2(polyInfo, roundness, 1, corners);
}

/**
 * computeG3PointsV2(polyInfo, roundness, corners)
 */
function computeG3PointsV2(polyInfo, roundness, corners) {
    return _computeCornerCurvePointsV2(polyInfo, roundness, 2, corners);
}
