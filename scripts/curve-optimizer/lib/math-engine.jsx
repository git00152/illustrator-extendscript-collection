// =============================================================================
// math-engine.jsx  (CurveOptimization)
//
// G2 Curve Optimization Math Library
// DOM-independent. ExtendScript ES3 compatible.
// =============================================================================

// =============================================================================
// Snapshot utilities (ported from math-engine-v2.jsx)
// =============================================================================

/**
 * takeSnapshot(pathItem)
 *
 * Captures a copy of all path points as a plain-data array.
 * The snapshot is DOM-independent and can be used for undo/restore.
 *
 * @param  {PathItem} pathItem
 * @return {Array}    Array of { anchor, leftDirection, rightDirection, pointType }
 */
function takeSnapshot(pathItem) {
    var pts  = pathItem.pathPoints;
    var snap = [];
    snap.closed = pathItem.closed; // preserve open/closed state
    for (var i = 0; i < pts.length; i++) {
        var pt = pts[i];
        snap.push({
            anchor:         [pt.anchor[0],         pt.anchor[1]],
            leftDirection:  [pt.leftDirection[0],  pt.leftDirection[1]],
            rightDirection: [pt.rightDirection[0], pt.rightDirection[1]],
            pointType:      pt.pointType,
            selected:       (pt.selected !== PathPointSelection.NOSELECTION)
        });
    }
    return snap;
}

/**
 * restoreSnapshot(pathItem, snap)
 *
 * Restores a pathItem to a previously captured snapshot.
 * Uses the two-step setEntirePath pattern to avoid Error 9090.
 *
 * @param {PathItem} pathItem
 * @param {Array}    snap  From takeSnapshot()
 */
function restoreSnapshot(pathItem, snap) {
    var anchors = [];
    var i;
    for (i = 0; i < snap.length; i++) {
        anchors.push(snap[i].anchor);
    }
    pathItem.setEntirePath(anchors);
    pathItem.closed = (snap.closed === true);
    for (i = 0; i < snap.length; i++) {
        pathItem.pathPoints[i].leftDirection  = snap[i].leftDirection;
        pathItem.pathPoints[i].rightDirection = snap[i].rightDirection;
        pathItem.pathPoints[i].pointType      = snap[i].pointType;
    }
}

// =============================================================================
// Basic utilities
// =============================================================================

/**
 * signOf(x) -- replaces Math.sign (unavailable in ES3)
 */
function signOf(x) {
    if (x > 0) return 1;
    if (x < 0) return -1;
    return 0;
}

// =============================================================================
// 2D vector utilities
// =============================================================================

/**
 * cross2D(ax, ay, bx, by) -- 2D cross product (scalar)
 */
function cross2D(ax, ay, bx, by) {
    return ax * by - ay * bx;
}

/**
 * dot2D(ax, ay, bx, by) -- 2D dot product
 */
function dot2D(ax, ay, bx, by) {
    return ax * bx + ay * by;
}

/**
 * len2D(x, y) -- Euclidean length of a 2D vector
 */
function len2D(x, y) {
    return Math.sqrt(x * x + y * y);
}

/**
 * normalize2D(x, y) -- unit vector; returns {x:0, y:0} for near-zero input
 */
function normalize2D(x, y) {
    var l = len2D(x, y);
    if (l < 1e-10) return {x: 0, y: 0};
    return {x: x / l, y: y / l};
}

/**
 * rotate90(x, y) -- rotates 90 degrees counter-clockwise
 * @return {Object} {x, y}
 */
function rotate90(x, y) {
    return {x: -y, y: x};
}

// =============================================================================
// Cubic Bezier evaluation
// =============================================================================

/**
 * evalBez(p0, p1, p2, p3, t)
 *
 * Evaluates a cubic Bezier curve at parameter t.
 * p0..p3 are each [x, y] arrays.
 *
 * B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
 *
 * @return {Array} [x, y]
 */
function evalBez(p0, p1, p2, p3, t) {
    var mt  = 1 - t;
    var mt2 = mt * mt;
    var mt3 = mt2 * mt;
    var t2  = t * t;
    var t3  = t2 * t;
    var c0  = mt3;
    var c1  = 3 * mt2 * t;
    var c2  = 3 * mt  * t2;
    var c3  = t3;
    return [
        c0 * p0[0] + c1 * p1[0] + c2 * p2[0] + c3 * p3[0],
        c0 * p0[1] + c1 * p1[1] + c2 * p2[1] + c3 * p3[1]
    ];
}

/**
 * evalBezD1(p0, p1, p2, p3, t)
 *
 * First derivative of a cubic Bezier at parameter t.
 *
 * B'(t) = 3 [ (1-t)^2 (P1-P0) + 2(1-t)t (P2-P1) + t^2 (P3-P2) ]
 *
 * @return {Array} [dx, dy]
 */
function evalBezD1(p0, p1, p2, p3, t) {
    var mt  = 1 - t;
    var mt2 = mt * mt;
    var t2  = t * t;
    var c0  = 3 * mt2;
    var c1  = 6 * mt * t;
    var c2  = 3 * t2;
    return [
        c0 * (p1[0] - p0[0]) + c1 * (p2[0] - p1[0]) + c2 * (p3[0] - p2[0]),
        c0 * (p1[1] - p0[1]) + c1 * (p2[1] - p1[1]) + c2 * (p3[1] - p2[1])
    ];
}

/**
 * evalBezD2(p0, p1, p2, p3, t)
 *
 * Second derivative of a cubic Bezier at parameter t.
 *
 * B''(t) = 6 [ (1-t)(P2 - 2P1 + P0) + t(P3 - 2P2 + P1) ]
 *
 * @return {Array} [ddx, ddy]
 */
function evalBezD2(p0, p1, p2, p3, t) {
    var mt = 1 - t;
    var ax = p2[0] - 2 * p1[0] + p0[0];
    var ay = p2[1] - 2 * p1[1] + p0[1];
    var bx = p3[0] - 2 * p2[0] + p1[0];
    var by = p3[1] - 2 * p2[1] + p1[1];
    return [
        6 * (mt * ax + t * bx),
        6 * (mt * ay + t * by)
    ];
}

/**
 * curvatureAt(d1, d2)
 *
 * Signed curvature from first and second derivatives.
 * kappa = |cross2D(B', B'')| / |B'|^3
 *
 * d1 and d2 are each [x, y] arrays.
 *
 * @return {number} kappa (always non-negative; 0 if |B'| is near zero)
 */
function curvatureAt(d1, d2) {
    var cross = Math.abs(cross2D(d1[0], d1[1], d2[0], d2[1]));
    var speed = len2D(d1[0], d1[1]);
    var speed3 = speed * speed * speed;
    if (speed3 < 1e-20) return 0;
    return cross / speed3;
}

// =============================================================================
// G2 correction engine
// =============================================================================

/**
 * computeG2Handles(pts, idx, corrPct)
 *
 * Computes G2-corrected handle positions for the smooth point at pts[idx].
 *
 * pts is a snapshot-format array:
 *   pts[i] = { anchor: [x,y], leftDirection: [x,y], rightDirection: [x,y], pointType }
 *
 * Algorithm:
 *   1. Skip non-smooth points (returns null).
 *   2. Derive the tangent direction dhat from the existing handles.
 *   3. Compute cross-distances from neighboring control points to the tangent line.
 *   4. Use the ratio of cross-distances to derive the G2-optimal handle lengths.
 *   5. Blend toward the target lengths by corrPct percent.
 *
 * @param  {Array}  pts      Snapshot-format point array
 * @param  {number} idx      Index of the point to correct
 * @param  {number} corrPct  Correction percentage (0-100)
 * @return {Object|null}     { leftDir: [x,y], rightDir: [x,y] } or null
 */
function computeG2Handles(pts, idx, corrPct) {
    var n = pts.length;
    var P = pts[idx];

    // Only process smooth points
    if (P.pointType !== PointType.SMOOTH) return null;

    // BUG-02: open path endpoints cannot satisfy G2 (no valid neighbor on both sides)
    if (pts.closed !== true) {
        if (idx === 0 || idx === n - 1) return null;
    }

    var prevIdx = (idx - 1 + n) % n;
    var nextIdx = (idx + 1) % n;
    var A = pts[prevIdx]; // previous anchor
    var B = pts[nextIdx]; // next anchor

    // Tangent direction: from leftDirection toward anchor
    var dlx = P.anchor[0] - P.leftDirection[0];
    var dly = P.anchor[1] - P.leftDirection[1];
    var h_in = len2D(dlx, dly);

    var drx = P.rightDirection[0] - P.anchor[0];
    var dry = P.rightDirection[1] - P.anchor[1];
    var h_out = len2D(drx, dry);

    // Derive tangent unit vector dhat
    // If leftDirection coincides with anchor, fall back to rightDirection
    var dhat;
    if (h_in < 1e-10) {
        dhat = normalize2D(drx, dry);
    } else {
        dhat = normalize2D(dlx, dly);
    }

    // Cross distances: perpendicular distance from each neighbor's adjacent
    // control point to the tangent line through P.anchor
    // c_in  = |cross(dhat, A.rightDirection - P.anchor)|
    // c_out = |cross(dhat, B.leftDirection  - P.anchor)|
    var arx = A.rightDirection[0] - P.anchor[0];
    var ary = A.rightDirection[1] - P.anchor[1];
    var blx = B.leftDirection[0]  - P.anchor[0];
    var bly = B.leftDirection[1]  - P.anchor[1];

    var c_in  = Math.abs(cross2D(dhat.x, dhat.y, arx, ary));
    var c_out = Math.abs(cross2D(dhat.x, dhat.y, blx, bly));

    if (c_in < 1e-10 || c_out < 1e-10) return null;

    // G2 optimal handle lengths
    var ratio        = Math.sqrt(c_out / c_in);
    var h_out_target = Math.sqrt(h_in * h_out * ratio);
    var h_in_target  = Math.sqrt(h_in * h_out / ratio);

    // Lerp toward target by corrPct/100
    // blend > 1.0 extrapolates past the G2 target; clamp handle lengths to >= 0
    // to prevent direction flipping which causes curve twisting.
    var blend    = corrPct / 100;
    var h_in_new  = h_in  + (h_in_target  - h_in)  * blend;
    var h_out_new = h_out + (h_out_target - h_out) * blend;
    if (h_in_new  < 0) { h_in_new  = 0; }
    if (h_out_new < 0) { h_out_new = 0; }

    // New handle positions along dhat
    var leftDir  = [
        P.anchor[0] - dhat.x * h_in_new,
        P.anchor[1] - dhat.y * h_in_new
    ];
    var rightDir = [
        P.anchor[0] + dhat.x * h_out_new,
        P.anchor[1] + dhat.y * h_out_new
    ];

    return { leftDir: leftDir, rightDir: rightDir };
}

/**
 * applyG2Pass(pts, corrPct, targetAll)
 *
 * Applies one G2 correction pass to the snapshot-format array pts (in-place).
 * All new handles are computed from the original data before any are written,
 * so neighboring points within the same pass do not interfere.
 *
 * @param  {Array}   pts       Snapshot-format point array (modified in-place)
 * @param  {number}  corrPct   Correction percentage (0-100)
 * @param  {boolean} targetAll true = all smooth points; false = same as true for now
 * @return {number}            Number of points that were updated
 */
function applyG2Pass(pts, corrPct, targetAll) {
    var n = pts.length;
    var newHandles = [];
    var i, res;

    // 1. Compute all new handles from the original data
    for (i = 0; i < n; i++) {
        res = computeG2Handles(pts, i, corrPct);
        newHandles.push(res);
    }

    // 2. Apply in bulk
    var count = 0;
    for (i = 0; i < n; i++) {
        if (newHandles[i] === null) continue;
        // targetAll=false のとき、未選択アンカーはスキップ（selected はブール値: true=選択済み）
        if (!targetAll && pts[i].selected === false) continue;
        pts[i].leftDirection  = newHandles[i].leftDir;
        pts[i].rightDirection = newHandles[i].rightDir;
        count++;
    }

    return count;
}

// =============================================================================
// Shape scale engine
// =============================================================================

/**
 * applyShapeScale(pts, shapePct)
 *
 * Scales handle lengths by Math.pow(2, shapePct/100) while preserving G2 ratio.
 * Must be called AFTER all applyG2Pass iterations are complete.
 * 0% = no change, 100% = 2x handle length, -100% = 0.5x handle length.
 *
 * @param {Array}  pts      Snapshot-format point array (modified in-place)
 * @param {number} shapePct Scale factor exponent in percent (-100 to 100)
 */
function applyShapeScale(pts, shapePct, targetAll) {
    var scaleFactor = Math.pow(2, shapePct / 100);
    var i, dx, dy;
    for (i = 0; i < pts.length; i++) {
        if (!targetAll && pts[i].selected === false) continue;
        // leftDirection: anchor \u304b\u3089\u306e\u5dee\u5206\u30d9\u30af\u30c8\u30eb\u3092 scaleFactor \u500d
        dx = pts[i].leftDirection[0] - pts[i].anchor[0];
        dy = pts[i].leftDirection[1] - pts[i].anchor[1];
        pts[i].leftDirection = [
            pts[i].anchor[0] + dx * scaleFactor,
            pts[i].anchor[1] + dy * scaleFactor
        ];
        // rightDirection: anchor \u304b\u3089\u306e\u5dee\u5206\u30d9\u30af\u30c8\u30eb\u3092 scaleFactor \u500d
        dx = pts[i].rightDirection[0] - pts[i].anchor[0];
        dy = pts[i].rightDirection[1] - pts[i].anchor[1];
        pts[i].rightDirection = [
            pts[i].anchor[0] + dx * scaleFactor,
            pts[i].anchor[1] + dy * scaleFactor
        ];
    }
}

// =============================================================================
// Curvature comb generation
// =============================================================================

/**
 * buildCombSegments(pts, nSamples, scale, closed)
 *
 * Builds curvature comb line segments from a snapshot-format path.
 * Each segment spans from a curve sample position to the tip of the comb tooth
 * in the normal direction, scaled by kappa * scale.
 *
 * @param  {Array}   pts      Snapshot-format point array
 * @param  {number}  nSamples Number of sample points per Bezier segment
 * @param  {number}  scale    Visual scale factor for comb tooth length
 * @param  {boolean} closed   true = include last segment (pts[n-1] -> pts[0])
 * @return {Array}   Array of { from: [x,y], to: [x,y] }
 */
function buildCombSegments(pts, nSamples, scale, closed) {
    var n = pts.length;
    var result = [];
    var segCount = closed ? n : n - 1;
    var i, j, t;
    var p0, p1, p2, p3;
    var pos, d1, d2, kappa;
    var ndir, tip;
    var dnorm;

    for (i = 0; i < segCount; i++) {
        var iNext = (i + 1) % n;
        p0 = pts[i].anchor;
        p1 = pts[i].rightDirection;
        p2 = pts[iNext].leftDirection;
        p3 = pts[iNext].anchor;

        for (j = 0; j < nSamples; j++) {
            t   = j / (nSamples - 1);
            pos = evalBez(p0, p1, p2, p3, t);
            d1  = evalBezD1(p0, p1, p2, p3, t);
            d2  = evalBezD2(p0, p1, p2, p3, t);

            kappa = curvatureAt(d1, d2);

            // Skip degenerate samples
            if (isNaN(kappa) || !isFinite(kappa)) continue;

            // Normal direction: rotate tangent 90 degrees CCW
            dnorm = normalize2D(d1[0], d1[1]);
            ndir  = rotate90(dnorm.x, dnorm.y);

            tip = [
                pos[0] + ndir.x * kappa * scale,
                pos[1] + ndir.y * kappa * scale
            ];

            result.push({
                from: [pos[0], pos[1]],
                to:   [tip[0], tip[1]]
            });
        }
    }

    return result;
}
