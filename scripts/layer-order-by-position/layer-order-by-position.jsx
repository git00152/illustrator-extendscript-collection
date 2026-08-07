// =============================================================================
// layer-order-by-position.jsx
// ExtendScript (ES3) - Adobe Illustrator
//
// Reorders selected objects so the stacking order matches their visual position:
// items higher on the artboard are brought in front of lower items.
// =============================================================================

#target illustrator

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    var doc = app.activeDocument;
    var selection = doc.selection;

    if (!selection || selection.length < 2) {
        alert("2つ以上のオブジェクトを選択してください。");
        return;
    }

    var groups = collectItemsByParent(selection);
    var changedGroupCount = 0;

    for (var i = 0; i < groups.length; i++) {
        if (groups[i].items.length < 2) {
            continue;
        }

        reorderGroup(groups[i].items);
        changedGroupCount++;
    }

    if (changedGroupCount === 0) {
        alert("同じ親レイヤーまたはグループ内のオブジェクトを2つ以上選択してください。");
        return;
    }

    app.redraw();
}());

function collectItemsByParent(selection) {
    var groups = [];

    for (var i = 0; i < selection.length; i++) {
        var item = selection[i];
        var parent = item.parent;
        var group = findGroup(groups, parent);

        if (!group) {
            group = {
                parent: parent,
                items: []
            };
            groups.push(group);
        }

        group.items.push(item);
    }

    return groups;
}

function findGroup(groups, parent) {
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].parent === parent) {
            return groups[i];
        }
    }

    return null;
}

function reorderGroup(items) {
    items.sort(compareByVisualPosition);

    // Bring lower items forward first, then higher items. The final item brought
    // forward becomes the topmost object, so this preserves top-to-front order.
    for (var i = items.length - 1; i >= 0; i--) {
        items[i].zOrder(ZOrderMethod.BRINGTOFRONT);
    }
}

function compareByVisualPosition(a, b) {
    var aBounds = a.visibleBounds;
    var bBounds = b.visibleBounds;

    var aTop = aBounds[1];
    var bTop = bBounds[1];

    if (aTop !== bTop) {
        return bTop - aTop;
    }

    var aLeft = aBounds[0];
    var bLeft = bBounds[0];

    if (aLeft !== bLeft) {
        return aLeft - bLeft;
    }

    return 0;
}
