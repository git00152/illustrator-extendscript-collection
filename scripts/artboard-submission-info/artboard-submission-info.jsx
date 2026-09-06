#target illustrator

(function () {
    var SCRIPT_NAME = "アートボード入稿情報配置";
    var OUTPUT_LAYER_NAME = "入稿情報";
    var OUTPUT_ITEM_NAME = "アートボード入稿情報";
    var OUTPUT_NOTE = "ARTBOARD_SUBMISSION_INFO_V1";
    var BACKUP_LAYER_PREFIX = "__ARTBOARD_SUBMISSION_INFO_BACKUP_V1__";
    var FONT_FAMILY = "Noto Sans JP";
    var FONT_STYLE = "Regular";
    var FONT_SIZE_PT = 15;
    var OFFSET_MM = 10;
    var POINTS_PER_MM = 72 / 25.4;
    var BOUNDS_TOLERANCE_PT = 0.5;

    function getErrorMessage(error) {
        try {
            if (error && error.message) {
                return String(error.message);
            }
        } catch (ignore1) {}

        try {
            return String(error);
        } catch (ignore2) {
            return "不明なエラー";
        }
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function nearlyEqual(first, second, tolerance) {
        return Math.abs(first - second) <= tolerance;
    }

    function copyRect(rawRect, label) {
        var rect = [];
        var i;
        var value;

        if (!rawRect || typeof rawRect.length !== "number" || rawRect.length < 4) {
            throw new Error(label + "の範囲を取得できませんでした。");
        }

        for (i = 0; i < 4; i++) {
            value = Number(rawRect[i]);
            if (!isFiniteNumber(value)) {
                throw new Error(label + "の座標が不正です。");
            }
            rect.push(value);
        }

        if (rect[2] <= rect[0] || rect[1] <= rect[3]) {
            throw new Error(label + "のサイズが不正です。");
        }
        return rect;
    }

    function readBounds(item, propertyName, label) {
        var rawBounds;

        if (!item) {
            throw new Error(label + "を取得できませんでした。");
        }
        try {
            rawBounds = item[propertyName];
        } catch (e) {
            throw new Error(label + "を取得できませんでした。");
        }
        return copyRect(rawBounds, label);
    }

    function readVisibleBounds(item, label) {
        return readBounds(item, "visibleBounds", label);
    }

    function mmToPt(value) {
        var converted;

        try {
            converted = new UnitValue(value, "mm").as("pt");
            if (isFiniteNumber(converted)) {
                return converted;
            }
        } catch (e) {}

        converted = Number(value) * POINTS_PER_MM;
        if (!isFiniteNumber(converted)) {
            throw new Error("mmからポイントへの変換に失敗しました。");
        }
        return converted;
    }

    function ptToMm(value) {
        var converted = Number(value) / POINTS_PER_MM;
        if (!isFiniteNumber(converted)) {
            throw new Error("ポイントからmmへの変換に失敗しました。");
        }
        return converted;
    }

    function calculatePhysicalDimensions(artboardRect, scale) {
        var widthPt = artboardRect[2] - artboardRect[0];
        var heightPt = artboardRect[1] - artboardRect[3];
        var widthMm;
        var heightMm;
        var scaledWidth;
        var scaledHeight;
        var width;
        var height;

        if (!isFiniteNumber(widthPt) || !isFiniteNumber(heightPt) ||
            widthPt <= 0 || heightPt <= 0) {
            throw new Error("アートボードの寸法が不正です。");
        }
        if (!isFiniteNumber(scale) || scale < 1) {
            throw new Error("スケール分母が不正です。");
        }

        widthMm = ptToMm(widthPt);
        heightMm = ptToMm(heightPt);
        scaledWidth = widthMm * scale;
        scaledHeight = heightMm * scale;
        if (!isFiniteNumber(scaledWidth) || !isFiniteNumber(scaledHeight)) {
            throw new Error("実物換算寸法が非有限値になるため処理を中止しました。");
        }

        width = Math.round(scaledWidth);
        height = Math.round(scaledHeight);
        if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
            throw new Error("実物換算寸法を丸められません。");
        }

        return {
            width: width,
            height: height
        };
    }

    function getSubmissionDimensions(artboardRect, params) {
        if (params.manualSize) {
            if (!isFiniteNumber(params.manualWidth) || params.manualWidth <= 0 ||
                !isFiniteNumber(params.manualHeight) || params.manualHeight <= 0) {
                throw new Error("手動入力のサイズが不正です。");
            }
            return {
                width: params.manualWidth,
                height: params.manualHeight
            };
        }
        return calculatePhysicalDimensions(artboardRect, params.scale);
    }

    function isBlankString(value) {
        var i;
        var code;

        if (value === "") {
            return true;
        }
        for (i = 0; i < value.length; i++) {
            code = value.charCodeAt(i);
            if (code > 32) {
                return false;
            }
        }
        return true;
    }

    function getArtboardName(artboard) {
        var rawName;
        var name;

        try {
            rawName = artboard.name;
            if (rawName === null || typeof rawName === "undefined") {
                return "N/A";
            }
            name = String(rawName);
            if (isBlankString(name)) {
                return "N/A";
            }
            return name;
        } catch (e) {
            return "N/A";
        }
    }

    function buildLabel(artboardName, artboardRect, params) {
        var dimensions = getSubmissionDimensions(artboardRect, params);
        return artboardName + "   W" + dimensions.width + "*H" + dimensions.height +
            " 数量" + params.quantity + " スケール1/" + params.scale;
    }

    function buildOutputNote(index) {
        return OUTPUT_NOTE + "|index=" + index;
    }

    function parseOutputNote(note) {
        var prefix = OUTPUT_NOTE + "|index=";
        var indexText;
        var index;

        if (typeof note !== "string" || note.indexOf(prefix) !== 0) {
            return null;
        }
        indexText = note.substring(prefix.length);
        if (indexText === "") {
            return null;
        }
        index = Number(indexText);
        if (!isFiniteNumber(index) || index < 0 || Math.floor(index) !== index) {
            return null;
        }
        return index;
    }

    function pointIsInsideRect(x, y, rect) {
        return x >= rect[0] - BOUNDS_TOLERANCE_PT &&
            x <= rect[2] + BOUNDS_TOLERANCE_PT &&
            y <= rect[1] + BOUNDS_TOLERANCE_PT &&
            y >= rect[3] - BOUNDS_TOLERANCE_PT;
    }

    function getArtboardPlan(doc, params) {
        var plans = [];
        var artboards;
        var i;
        var artboard;
        var rect;
        var targetLeft;
        var targetTop;

        try {
            artboards = doc.artboards;
        } catch (e) {
            throw new Error("アートボードを取得できませんでした。");
        }

        if (!artboards || artboards.length < 1) {
            throw new Error("処理対象のアートボードがありません。");
        }

        for (i = 0; i < artboards.length; i++) {
            try {
                artboard = artboards[i];
                rect = copyRect(artboard.artboardRect, "アートボード" + (i + 1));
            } catch (e2) {
                throw new Error("アートボード" + (i + 1) + "の範囲を取得できませんでした。");
            }

            targetLeft = rect[0] + mmToPt(OFFSET_MM);
            targetTop = rect[1] - mmToPt(OFFSET_MM);
            if (!isFiniteNumber(targetLeft) || !isFiniteNumber(targetTop)) {
                throw new Error("アートボード" + (i + 1) + "の配置座標が不正です。");
            }
            if (!pointIsInsideRect(targetLeft, targetTop, rect)) {
                throw new Error("アートボード" + (i + 1) + "が10mmの配置余白より小さいため配置できません。");
            }

            plans.push({
                index: i,
                name: getArtboardName(artboard),
                rect: rect,
                targetLeft: targetLeft,
                targetTop: targetTop,
                dimensions: getSubmissionDimensions(rect, params)
            });
        }
        return plans;
    }

    function parsePositiveInteger(text, label) {
        var value = Number(text);

        if (!isFiniteNumber(value) || value < 1 || Math.floor(value) !== value) {
            alert(label + "は1以上の整数で入力してください。");
            return null;
        }
        return value;
    }

    function parseScale(text) {
        var value = Number(text);

        if (!isFiniteNumber(value) || value < 1) {
            alert("スケール分母は1以上の数値で入力してください。");
            return null;
        }
        return value;
    }

    function parseManualDimension(text, label) {
        var value = Number(text);

        if (!isFiniteNumber(value) || value <= 0) {
            alert(label + "は0より大きい数値で入力してください。");
            return null;
        }
        return value;
    }

    function showDialog() {
        var dialog = new Window("dialog", SCRIPT_NAME);
        var quantityGroup;
        var quantityInput;
        var scaleGroup;
        var scaleInput;
        var manualSizeCheckbox;
        var manualSizeGroup;
        var manualWidthInput;
        var manualHeightInput;
        var outlineCheckbox;
        var buttonGroup;
        var okButton;
        var cancelButton;
        var result = null;

        dialog.orientation = "column";
        dialog.alignChildren = "left";

        quantityGroup = dialog.add("group");
        quantityGroup.add("statictext", undefined, "数量：");
        quantityInput = quantityGroup.add("edittext", undefined, "1");
        quantityInput.characters = 8;

        scaleGroup = dialog.add("group");
        scaleGroup.add("statictext", undefined, "スケール： 1 /");
        scaleInput = scaleGroup.add("edittext", undefined, "1");
        scaleInput.characters = 8;

        manualSizeCheckbox = dialog.add("checkbox", undefined, "サイズを手動入力する");
        manualSizeCheckbox.value = false;

        manualSizeGroup = dialog.add("group");
        manualSizeGroup.add("statictext", undefined, "サイズ（mm）： W");
        manualWidthInput = manualSizeGroup.add("edittext", undefined, "");
        manualWidthInput.characters = 8;
        manualSizeGroup.add("statictext", undefined, "* H");
        manualHeightInput = manualSizeGroup.add("edittext", undefined, "");
        manualHeightInput.characters = 8;
        manualSizeGroup.enabled = false;

        manualSizeCheckbox.onClick = function () {
            manualSizeGroup.enabled = manualSizeCheckbox.value;
            if (manualSizeCheckbox.value) {
                manualWidthInput.active = true;
            }
        };

        outlineCheckbox = dialog.add("checkbox", undefined, "文字をアウトライン化する");
        outlineCheckbox.value = false;

        buttonGroup = dialog.add("group");
        buttonGroup.alignment = "center";
        okButton = buttonGroup.add("button", undefined, "OK", {name: "ok"});
        cancelButton = buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});

        okButton.onClick = function () {
            var quantity = parsePositiveInteger(quantityInput.text, "数量");
            var scale;
            var manualWidth = null;
            var manualHeight = null;

            if (quantity === null) {
                return;
            }
            scale = parseScale(scaleInput.text);
            if (scale === null) {
                return;
            }
            if (manualSizeCheckbox.value) {
                manualWidth = parseManualDimension(manualWidthInput.text, "W");
                if (manualWidth === null) {
                    return;
                }
                manualHeight = parseManualDimension(manualHeightInput.text, "H");
                if (manualHeight === null) {
                    return;
                }
            }
            result = {
                quantity: quantity,
                scale: scale,
                manualSize: manualSizeCheckbox.value,
                manualWidth: manualWidth,
                manualHeight: manualHeight,
                outline: outlineCheckbox.value
            };
            dialog.close(true);
        };

        cancelButton.onClick = function () {
            dialog.close(false);
        };

        quantityInput.active = true;
        dialog.center();
        if (!dialog.show()) {
            return null;
        }
        return result;
    }

    function isRequiredFont(font) {
        try {
            return font.family === FONT_FAMILY && font.style === FONT_STYLE;
        } catch (e) {
            return false;
        }
    }

    function findNotoSansJpRegular() {
        var font;
        var i;

        try {
            for (i = 0; i < app.textFonts.length; i++) {
                font = app.textFonts[i];
                if (isRequiredFont(font)) {
                    return font;
                }
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    function createBlackColor(doc) {
        var colorSpace;
        var color;

        try {
            colorSpace = doc.documentColorSpace;
        } catch (e) {
            throw new Error("文書のカラースペースを取得できないため、黒色を確定できません。");
        }

        if (typeof DocumentColorSpace === "undefined") {
            throw new Error("文書のカラースペース定数を取得できないため、黒色を確定できません。");
        }

        if (colorSpace === DocumentColorSpace.CMYK) {
            color = new CMYKColor();
            color.cyan = 0;
            color.magenta = 0;
            color.yellow = 0;
            color.black = 100;
            return color;
        }

        if (colorSpace === DocumentColorSpace.RGB) {
            color = new RGBColor();
            color.red = 0;
            color.green = 0;
            color.blue = 0;
            return color;
        }

        throw new Error("文書のカラースペースがCMYKまたはRGBではないため、黒色を確定できません。");
    }

    function findTopLevelOutputLayer(doc) {
        var found = null;
        var i;
        var layer;

        for (i = 0; i < doc.layers.length; i++) {
            layer = doc.layers[i];
            try {
                if (layer.name === OUTPUT_LAYER_NAME) {
                    if (found !== null) {
                        throw new Error("同名の「入稿情報」レイヤーが複数あります。整理してから再実行してください。");
                    }
                    found = layer;
                }
            } catch (e) {
                if (e && e.message && String(e.message).indexOf("同名の") === 0) {
                    throw e;
                }
                throw new Error("レイヤー名を検証できませんでした。");
            }
        }
        return found;
    }

    function captureOutputLayerState(layer, created, doc) {
        var state = {
            layer: layer,
            created: created,
            visible: true,
            locked: false,
            zOrderPosition: null
        };

        if (!created) {
            try {
                state.visible = layer.visible;
                state.locked = layer.locked;
            } catch (e) {
                throw new Error("「入稿情報」レイヤーの状態を取得できませんでした。");
            }
            try {
                state.zOrderPosition = layer.zOrderPosition;
            } catch (e2) {}
        }
        return state;
    }

    function getOrCreateOutputLayer(doc) {
        var layer = findTopLevelOutputLayer(doc);
        var addedLayer = null;
        var created = false;

        if (layer === null) {
            try {
                addedLayer = doc.layers.add();
                addedLayer.name = OUTPUT_LAYER_NAME;
                layer = addedLayer;
            } catch (e) {
                if (addedLayer !== null) {
                    try {
                        if (addedLayer.pageItems.length === 0) {
                            addedLayer.remove();
                        }
                    } catch (cleanupError) {}
                }
                throw new Error("「入稿情報」レイヤーを作成できませんでした。");
            }
            created = true;
        }
        return captureOutputLayerState(layer, created, doc);
    }

    function prepareOutputLayer(state) {
        try {
            state.layer.visible = true;
            state.layer.locked = false;
            state.layer.zOrder(ZOrderMethod.BRINGTOFRONT);
        } catch (e) {
            throw new Error("「入稿情報」レイヤーを表示・ロック解除・最前面にできませんでした。");
        }
    }

    function restoreOutputLayerState(state) {
        var restored = true;
        var current;
        var guard;

        if (!state || state.created || !state.layer) {
            return true;
        }

        try {
            state.layer.visible = state.visible;
        } catch (e) {
            restored = false;
        }
        try {
            state.layer.locked = state.locked;
        } catch (e2) {
            restored = false;
        }

        if (state.zOrderPosition !== null) {
            try {
                current = state.layer.zOrderPosition;
                guard = 0;
                if (typeof ZOrderMethod !== "undefined") {
                    while (current > state.zOrderPosition && guard < 100) {
                        state.layer.zOrder(ZOrderMethod.BRINGFORWARD);
                        current = state.layer.zOrderPosition;
                        guard += 1;
                    }
                    while (current < state.zOrderPosition && guard < 200) {
                        state.layer.zOrder(ZOrderMethod.SENDBACKWARD);
                        current = state.layer.zOrderPosition;
                        guard += 1;
                    }
                    if (current !== state.zOrderPosition) {
                        restored = false;
                    }
                }
            } catch (e3) {
                restored = false;
            }
        }
        return restored;
    }

    function validateManagedOutputOwnership(item, outputLayer, plan) {
        var note;
        var name;
        var pageItems;
        var index;
        var bounds;

        if (!item) {
            throw new Error("旧入稿情報を検証できませんでした。");
        }
        try {
            note = item.note;
        } catch (e) {
            throw new Error("旧入稿情報の識別情報を取得できませんでした。");
        }
        index = parseOutputNote(note);
        if (index === null) {
            throw new Error("旧入稿情報の識別情報またはアートボード番号が不正です。");
        }
        try {
            if (item.parent !== outputLayer) {
                throw new Error("旧入稿情報の所属レイヤーが不正です。");
            }
            name = item.name;
        } catch (e2) {
            if (e2 && e2.message && String(e2.message).indexOf("旧入稿情報の所属") === 0) {
                throw e2;
            }
            throw new Error("旧入稿情報の名前を取得できませんでした。");
        }
        if (name !== OUTPUT_ITEM_NAME) {
            throw new Error("旧入稿情報の名前が一致しません。");
        }
        if (item.typename !== "TextFrame" && item.typename !== "GroupItem") {
            throw new Error("旧入稿情報の種類が不正です。");
        }

        if (item.typename === "TextFrame") {
            try {
                if (String(item.contents) === "") {
                    throw new Error("旧入稿情報の文字列が空です。");
                }
            } catch (e3) {
                if (e3 && e3.message && String(e3.message).indexOf("旧入稿情報の文字列") === 0) {
                    throw e3;
                }
                throw new Error("旧入稿情報の文字列を検証できませんでした。");
            }
        } else {
            try {
                pageItems = item.pageItems;
                if (!pageItems || pageItems.length < 1) {
                    throw new Error("旧入稿情報のアウトラインが空です。");
                }
            } catch (e4) {
                if (e4 && e4.message && String(e4.message).indexOf("旧入稿情報のアウトライン") === 0) {
                    throw e4;
                }
                throw new Error("旧入稿情報のアウトラインを検証できませんでした。");
            }
        }

        if (plan) {
            if (index !== plan.index) {
                throw new Error("旧入稿情報のアートボード番号が一致しません。");
            }
            bounds = readVisibleBounds(item, "旧入稿情報のvisibleBounds");
            if (!nearlyEqual(bounds[0], plan.targetLeft, BOUNDS_TOLERANCE_PT) ||
                !nearlyEqual(bounds[1], plan.targetTop, BOUNDS_TOLERANCE_PT)) {
                throw new Error("旧入稿情報のアートボード" + (plan.index + 1) + "上の位置が不正です。");
            }
            if (!pointIsInsideRect(bounds[0], bounds[1], plan.rect)) {
                throw new Error("旧入稿情報のアートボード" + (plan.index + 1) + "への対応が不正です。");
            }
        }
        return index;
    }

    function collectPreviousOutputs(outputLayer, plans) {
        var outputs = [];
        var items;
        var i;
        var note;
        var index;
        var managedCount = 0;

        if (!outputLayer) {
            return outputs;
        }
        try {
            items = outputLayer.pageItems;
        } catch (e) {
            throw new Error("旧入稿情報を取得できませんでした。");
        }

        for (i = 0; i < items.length; i++) {
            try {
                note = items[i].note;
            } catch (e2) {
                throw new Error("入稿情報の識別情報を取得できませんでした。");
            }
            if (typeof note !== "string" || note.indexOf(OUTPUT_NOTE) !== 0) {
                continue;
            }
            managedCount += 1;
            index = validateManagedOutputOwnership(items[i], outputLayer, null);
            if (plans && index >= plans.length) {
                throw new Error("旧入稿情報に余剰のアートボード番号があります。");
            }
            if (outputs[index]) {
                throw new Error("旧入稿情報のアートボード番号が重複しています。");
            }
            outputs[index] = items[i];
        }

        if (managedCount === 0) {
            return [];
        }
        if (!plans) {
            return outputs;
        }
        if (managedCount !== plans.length) {
            throw new Error("旧入稿情報が全アートボード分そろっていません。");
        }
        for (i = 0; i < plans.length; i++) {
            if (!outputs[i]) {
                throw new Error("旧入稿情報にアートボード" + (i + 1) + "の出力がありません。");
            }
            validateManagedOutputOwnership(outputs[i], outputLayer, plans[i]);
        }
        return outputs;
    }

    function removeItemQuietly(item) {
        if (!item) {
            return true;
        }
        try {
            item.locked = false;
        } catch (e) {}
        try {
            item.hidden = false;
        } catch (e2) {}
        try {
            item.remove();
            return true;
        } catch (e3) {
            return false;
        }
    }

    function captureItemState(item) {
        var state = {
            item: item,
            locked: false,
            hidden: false
        };

        try {
            state.locked = item.locked;
        } catch (e) {}
        try {
            state.hidden = item.hidden;
        } catch (e2) {}
        return state;
    }

    function restoreItemState(state) {
        var restored = true;

        if (!state || !state.item) {
            return true;
        }
        try {
            state.item.hidden = state.hidden;
        } catch (e) {
            restored = false;
        }
        try {
            state.item.locked = state.locked;
        } catch (e2) {
            restored = false;
        }
        return restored;
    }

    function makeItemWritable(item) {
        if (!item) {
            return false;
        }
        try {
            item.hidden = false;
            item.locked = false;
        } catch (e) {
            return false;
        }
        return true;
    }

    function isDirectChildOf(item, parent) {
        try {
            return item && item.parent === parent;
        } catch (e) {
            return false;
        }
    }

    function captureLayerOrder(layer) {
        var order = [];
        var items;
        var i;
        var j;
        var position;

        if (!layer) {
            throw new Error("入稿情報レイヤーの重ね順を取得できませんでした。");
        }
        try {
            items = layer.pageItems;
            for (i = 0; i < items.length; i++) {
                if (!isDirectChildOf(items[i], layer)) {
                    continue;
                }
                position = Number(items[i].zOrderPosition);
                if (!isFiniteNumber(position)) {
                    throw new Error("入稿情報レイヤー内の重ね順を取得できませんでした。");
                }
                for (j = 0; j < order.length; j++) {
                    if (order[j].zOrderPosition === position) {
                        throw new Error("入稿情報レイヤー内の重ね順が一意ではありません。");
                    }
                }
                order.push({
                    item: items[i],
                    itemState: captureItemState(items[i]),
                    zOrderPosition: position
                });
            }
        } catch (e) {
            if (e && e.message && String(e.message).indexOf("入稿情報レイヤー内") === 0) {
                throw e;
            }
            throw new Error("入稿情報レイヤーの重ね順を取得できませんでした。");
        }

        for (i = 1; i < order.length; i++) {
            position = order[i];
            j = i - 1;
            while (j >= 0 && order[j].zOrderPosition > position.zOrderPosition) {
                order[j + 1] = order[j];
                j -= 1;
            }
            order[j + 1] = position;
        }
        return order;
    }

    function findBackupEntryForOriginal(state, item) {
        var i;

        if (!state || !state.entries) {
            return null;
        }
        for (i = 0; i < state.entries.length; i++) {
            if (state.entries[i].original === item) {
                return state.entries[i];
            }
        }
        return null;
    }

    function getRestoredOrderItem(state, snapshot) {
        var entry = findBackupEntryForOriginal(state, snapshot.item);

        if (entry === null) {
            if (!isDirectChildOf(snapshot.item, state.outputLayer) ||
                !isItemPresentInLayer(state.outputLayer, snapshot.item)) {
                return null;
            }
            return snapshot.item;
        }
        if (!entry.deleted) {
            if (!isDirectChildOf(entry.original, state.outputLayer) ||
                !isItemPresentInLayer(state.outputLayer, entry.original)) {
                return null;
            }
            return entry.original;
        }
        if (!entry.restoredItem || !isDirectChildOf(entry.restoredItem, state.outputLayer) ||
            !isItemPresentInLayer(state.outputLayer, entry.restoredItem)) {
            return null;
        }
        return entry.restoredItem;
    }

    function validateRestoredLayerOrder(state, desired) {
        var i;
        var current;
        var previous;

        for (i = 0; i < desired.length; i++) {
            if (!isDirectChildOf(desired[i].item, state.outputLayer) ||
                !isItemPresentInLayer(state.outputLayer, desired[i].item)) {
                return false;
            }
            current = Number(desired[i].item.zOrderPosition);
            if (!isFiniteNumber(current)) {
                return false;
            }
            if (i > 0) {
                previous = Number(desired[i - 1].item.zOrderPosition);
                if (!isFiniteNumber(previous) || previous >= current) {
                    return false;
                }
            }
        }
        return true;
    }

    function restoreLayerOrder(state) {
        var desired = [];
        var i;
        var item;
        var snapshot;

        if (!state || !state.originalOrder) {
            return false;
        }
        for (i = 0; i < state.originalOrder.length; i++) {
            snapshot = state.originalOrder[i];
            item = getRestoredOrderItem(state, snapshot);
            if (item === null) {
                return false;
            }
            desired.push({
                item: item,
                zOrderPosition: snapshot.zOrderPosition
            });
        }

        for (i = 1; i < desired.length; i++) {
            try {
                desired[i].item.move(desired[i - 1].item, ElementPlacement.PLACEAFTER);
            } catch (e) {
                return false;
            }
        }
        return validateRestoredLayerOrder(state, desired);
    }

    function isItemPresentInLayer(layer, item) {
        var items;
        var i;

        try {
            items = layer.pageItems;
            for (i = 0; i < items.length; i++) {
                if (items[i] === item) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function isLayerInDocument(doc, layer) {
        var i;

        try {
            for (i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i] === layer) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function getUniqueBackupLayerName(doc) {
        var i;
        var suffix;
        var candidate;
        var used;

        for (suffix = 0; suffix < 10000; suffix++) {
            candidate = BACKUP_LAYER_PREFIX + (suffix === 0 ? "" : String(suffix));
            used = false;
            for (i = 0; i < doc.layers.length; i++) {
                try {
                    if (doc.layers[i].name === candidate) {
                        used = true;
                        break;
                    }
                } catch (e) {
                    throw new Error("バックアップ用レイヤー名を検証できませんでした。");
                }
            }
            if (!used) {
                return candidate;
            }
        }
        throw new Error("バックアップ用レイヤー名を確保できませんでした。");
    }

    function createBackupLayer(doc) {
        var layer = null;

        try {
            layer = doc.layers.add();
            layer.name = getUniqueBackupLayerName(doc);
            layer.visible = true;
            layer.locked = false;
            return layer;
        } catch (e) {
            if (layer !== null) {
                try {
                    layer.remove();
                } catch (cleanupError) {}
            }
            throw new Error("旧入稿情報のバックアップ用レイヤーを作成できませんでした。");
        }
    }

    function validateBackupItem(item, backupLayer, entry) {
        var note;
        var name;
        var bounds;
        var noteIndex;
        var pageItems;

        if (!item || !isDirectChildOf(item, backupLayer)) {
            throw new Error("旧入稿情報のバックアップ所属を検証できませんでした。");
        }
        try {
            note = item.note;
            name = item.name;
        } catch (e) {
            throw new Error("旧入稿情報のバックアップ識別情報を取得できませんでした。");
        }
        noteIndex = parseOutputNote(note);
        if (name !== OUTPUT_ITEM_NAME || noteIndex !== entry.index) {
            throw new Error("旧入稿情報のバックアップ識別情報が不正です。");
        }
        if (item.typename !== "TextFrame" && item.typename !== "GroupItem") {
            throw new Error("旧入稿情報のバックアップ種類が不正です。");
        }
        if (item.typename === "TextFrame") {
            try {
                if (String(item.contents) === "") {
                    throw new Error("旧入稿情報のバックアップ文字列が空です。");
                }
            } catch (e2) {
                if (e2 && e2.message && String(e2.message).indexOf("旧入稿情報のバックアップ文字列") === 0) {
                    throw e2;
                }
                throw new Error("旧入稿情報のバックアップ文字列を検証できませんでした。");
            }
        } else {
            try {
                pageItems = item.pageItems;
                if (!pageItems || pageItems.length < 1) {
                    throw new Error("旧入稿情報のバックアップアウトラインが空です。");
                }
            } catch (e3) {
                if (e3 && e3.message && String(e3.message).indexOf("旧入稿情報のバックアップアウトライン") === 0) {
                    throw e3;
                }
                throw new Error("旧入稿情報のバックアップアウトラインを検証できませんでした。");
            }
        }
        bounds = readVisibleBounds(item, "旧入稿情報のバックアップvisibleBounds");
        if (!nearlyEqual(bounds[0], entry.bounds[0], BOUNDS_TOLERANCE_PT) ||
            !nearlyEqual(bounds[1], entry.bounds[1], BOUNDS_TOLERANCE_PT) ||
            !nearlyEqual(bounds[2], entry.bounds[2], BOUNDS_TOLERANCE_PT) ||
            !nearlyEqual(bounds[3], entry.bounds[3], BOUNDS_TOLERANCE_PT)) {
            throw new Error("旧入稿情報のバックアップ位置が元の出力と一致しません。");
        }
        return true;
    }

    function removeBackupLayer(state) {
        var layer;
        var items;
        var i;

        if (!state || !state.layer || state.layerRemoved) {
            return true;
        }
        layer = state.layer;
        try {
            layer.visible = true;
            layer.locked = false;
            items = layer.pageItems;
            for (i = 0; i < items.length; i++) {
                try {
                    items[i].locked = false;
                    items[i].hidden = false;
                } catch (itemError) {}
            }
            layer.remove();
        } catch (e) {
            return false;
        }
        if (isLayerInDocument(state.doc, layer)) {
            return false;
        }
        state.layerRemoved = true;
        return true;
    }

    function getLayerNameSafe(layer) {
        var name;

        try {
            name = String(layer.name);
            if (name !== "") {
                return name;
            }
        } catch (e) {}
        return "(名称不明)";
    }

    function retainBackupLayerHiddenLocked(state) {
        var retained = true;

        if (!state || !state.layer || state.layerRemoved) {
            return false;
        }
        if (!isLayerInDocument(state.doc, state.layer)) {
            return false;
        }
        try {
            state.layer.visible = false;
        } catch (e) {
            retained = false;
        }
        try {
            state.layer.locked = true;
        } catch (e2) {
            retained = false;
        }
        try {
            if (state.layer.visible !== false || state.layer.locked !== true) {
                retained = false;
            }
        } catch (e3) {
            retained = false;
        }
        return retained;
    }

    function createPreviousOutputBackup(doc, outputLayer, outputs, originalOrder) {
        var state = {
            doc: doc,
            outputLayer: outputLayer,
            layer: null,
            originalOrder: null,
            entries: [],
            layerRemoved: false
        };
        var i;
        var original;
        var backupItem;
        var entry;
        var j;
        var orderFound;

        if (!outputs || outputs.length === 0) {
            return null;
        }
        try {
            state.originalOrder = originalOrder || captureLayerOrder(outputLayer);
            state.layer = createBackupLayer(doc);
            for (i = 0; i < outputs.length; i++) {
                original = outputs[i];
                entry = {
                    index: i,
                    original: original,
                    originalState: captureItemState(original),
                    bounds: readVisibleBounds(original, "旧入稿情報のvisibleBounds"),
                    originalOrderIndex: null,
                    originalZOrderPosition: null,
                    backup: null,
                    deleted: false,
                    restoredItem: null
                };
                orderFound = false;
                for (j = 0; j < state.originalOrder.length; j++) {
                    if (state.originalOrder[j].item === original) {
                        entry.originalOrderIndex = j;
                        entry.originalZOrderPosition = state.originalOrder[j].zOrderPosition;
                        orderFound = true;
                        break;
                    }
                }
                if (!orderFound) {
                    throw new Error("旧入稿情報の元の重ね順を保存できませんでした。");
                }
                try {
                    backupItem = original.duplicate(state.layer, ElementPlacement.PLACEATEND);
                } catch (e) {
                    throw new Error("旧入稿情報のバックアップを作成できませんでした。");
                }
                entry.backup = backupItem;
                try {
                    backupItem.name = OUTPUT_ITEM_NAME;
                    backupItem.note = buildOutputNote(entry.index);
                } catch (metadataError) {
                    throw new Error("旧入稿情報のバックアップ識別情報を設定できませんでした。");
                }
                validateBackupItem(backupItem, state.layer, entry);
                state.entries.push(entry);
            }
            try {
                state.layer.visible = false;
            } catch (hideError) {
                throw new Error("旧入稿情報のバックアップを非表示にできませんでした。");
            }
            return state;
        } catch (e2) {
            if (state.layer !== null && !removeBackupLayer(state)) {
                throw new Error("旧入稿情報のバックアップ作成に失敗し、バックアップ用レイヤーも削除できませんでした。");
            }
            throw e2;
        }
    }

    function deletePreviousOutputsWithBackup(state) {
        var i;
        var entry;

        if (!state) {
            return {success: true};
        }
        for (i = 0; i < state.entries.length; i++) {
            entry = state.entries[i];
            try {
                entry.original.locked = false;
                entry.original.hidden = false;
            } catch (e) {
                for (var j = 0; j < state.entries.length; j++) {
                    restoreItemState(state.entries[j].originalState);
                }
                return {
                    success: false,
                    message: "旧入稿情報を削除できる状態にできませんでした。"
                };
            }
        }

        for (i = 0; i < state.entries.length; i++) {
            entry = state.entries[i];
            if (!removeItemQuietly(entry.original)) {
                if (!isItemPresentInLayer(state.outputLayer, entry.original)) {
                    entry.deleted = true;
                }
                return {
                    success: false,
                    message: "旧入稿情報の削除途中で失敗しました。バックアップから復元します。"
                };
            }
            entry.deleted = true;
        }
        return {success: true};
    }

    function restorePreviousOutputsFromBackup(state, plans) {
        var i;
        var entry;
        var restoredItem;
        var orderItem;
        var orderEntry;

        if (!state) {
            return true;
        }
        if (state.layerRemoved) {
            return false;
        }
        try {
            state.layer.visible = true;
            state.layer.locked = false;
        } catch (e) {
            return false;
        }

        try {
            for (i = 0; i < state.entries.length; i++) {
                entry = state.entries[i];
                if (!entry.deleted && !isItemPresentInLayer(state.outputLayer, entry.original)) {
                    entry.deleted = true;
                }
                if (entry.deleted) {
                    if (entry.restoredItem !== null && isDirectChildOf(entry.restoredItem, state.outputLayer)) {
                        restoredItem = entry.restoredItem;
                    } else {
                        restoredItem = entry.backup.duplicate(state.outputLayer, ElementPlacement.PLACEATEND);
                        restoredItem.name = OUTPUT_ITEM_NAME;
                        restoredItem.note = buildOutputNote(entry.index);
                        entry.restoredItem = restoredItem;
                    }
                    validateManagedOutputOwnership(
                        restoredItem,
                        state.outputLayer,
                        plans ? plans[entry.index] : null
                    );
                    if (!makeItemWritable(restoredItem)) {
                        throw new Error("旧入稿情報を重ね順復元可能な状態にできませんでした。");
                    }
                } else if (!makeItemWritable(entry.original)) {
                    throw new Error("旧入稿情報を重ね順復元可能な状態にできませんでした。");
                }
            }

            for (i = 0; i < state.originalOrder.length; i++) {
                orderEntry = state.originalOrder[i];
                orderItem = getRestoredOrderItem(state, orderEntry);
                if (orderItem === null || !makeItemWritable(orderItem)) {
                    throw new Error("入稿情報レイヤー内の全項目を重ね順復元可能な状態にできませんでした。");
                }
            }

            if (!restoreLayerOrder(state)) {
                throw new Error("旧入稿情報と非管理項目の重ね順を復元できませんでした。");
            }

            for (i = 0; i < state.entries.length; i++) {
                entry = state.entries[i];
                if (entry.deleted) {
                    if (!restoreItemState({
                        item: entry.restoredItem,
                        locked: entry.originalState.locked,
                        hidden: entry.originalState.hidden
                    })) {
                        throw new Error("旧入稿情報の状態を復元できませんでした。");
                    }
                } else if (!restoreItemState(entry.originalState)) {
                    throw new Error("旧入稿情報の状態を復元できませんでした。");
                }
            }
            for (i = 0; i < state.originalOrder.length; i++) {
                orderEntry = state.originalOrder[i];
                if (findBackupEntryForOriginal(state, orderEntry.item) === null &&
                    !restoreItemState(orderEntry.itemState)) {
                    throw new Error("非管理項目の状態を復元できませんでした。");
                }
            }
            return true;
        } catch (e2) {
            return false;
        }
    }

    function positionByVisibleTopLeft(item, targetLeft, targetTop) {
        var beforeBounds = readVisibleBounds(item, "入稿情報のvisibleBounds");
        var afterBounds;

        try {
            item.translate(targetLeft - beforeBounds[0], targetTop - beforeBounds[1]);
        } catch (e) {
            throw new Error("入稿情報を指定位置へ移動できませんでした。");
        }
        afterBounds = readVisibleBounds(item, "入稿情報のvisibleBounds");
        if (!nearlyEqual(afterBounds[0], targetLeft, BOUNDS_TOLERANCE_PT) ||
            !nearlyEqual(afterBounds[1], targetTop, BOUNDS_TOLERANCE_PT)) {
            throw new Error("入稿情報の左上位置を確定できませんでした。");
        }
    }

    function createOutput(doc, outputLayer, plan, params, font) {
        var targetLeft = plan.targetLeft;
        var targetTop = plan.targetTop;
        var textFrame = null;
        var outputItem = null;

        try {
            textFrame = outputLayer.textFrames.pointText([targetLeft, targetTop]);
            if (!textFrame) {
                throw new Error("入稿情報の文字オブジェクトを作成できませんでした。");
            }
            textFrame.contents = buildLabel(plan.name, plan.rect, params);
            textFrame.textRange.characterAttributes.textFont = font;
            textFrame.textRange.characterAttributes.size = FONT_SIZE_PT;
            textFrame.textRange.characterAttributes.fillColor = createBlackColor(doc);
            textFrame.name = OUTPUT_ITEM_NAME;
            outputItem = textFrame;

            if (params.outline) {
                outputItem = textFrame.createOutline();
                if (!outputItem) {
                    throw new Error("入稿情報をアウトライン化できませんでした。");
                }
            }

            outputItem.name = OUTPUT_ITEM_NAME;
            outputItem.note = buildOutputNote(plan.index);
            positionByVisibleTopLeft(outputItem, targetLeft, targetTop);
            validateOutputItem(outputItem, outputLayer, plan, params);
            try {
                outputItem.zOrder(ZOrderMethod.BRINGTOFRONT);
            } catch (e2) {
                throw new Error("入稿情報をレイヤー内の最前面にできませんでした。");
            }
            return outputItem;
        } catch (e) {
            removeItemQuietly(outputItem);
            if (textFrame !== outputItem) {
                removeItemQuietly(textFrame);
            }
            throw e;
        }
    }

    function validateOutputItem(item, outputLayer, plan, params) {
        var bounds;
        var note;
        var name;
        var pageItems;
        var noteIndex;

        if (!item || item.parent !== outputLayer) {
            throw new Error("入稿情報が「入稿情報」レイヤー直下にありません。");
        }
        try {
            name = item.name;
            note = item.note;
        } catch (e) {
            throw new Error("入稿情報の名前または識別情報を検証できませんでした。");
        }
        noteIndex = parseOutputNote(note);
        if (name !== OUTPUT_ITEM_NAME || noteIndex !== plan.index) {
            throw new Error("入稿情報の名前または識別情報が不正です。");
        }

        if (params.outline) {
            if (item.typename !== "GroupItem") {
                throw new Error("アウトライン化した入稿情報の種類が不正です。");
            }
            try {
                pageItems = item.pageItems;
                if (!pageItems || pageItems.length < 1) {
                    throw new Error("アウトライン化した入稿情報が空です。");
                }
            } catch (e2) {
                if (e2 && e2.message && String(e2.message).indexOf("アウトライン化した") === 0) {
                    throw e2;
                }
                throw new Error("アウトライン化した入稿情報を検証できませんでした。");
            }
        } else {
            if (item.typename !== "TextFrame") {
                throw new Error("入稿情報の種類が不正です。");
            }
            try {
                if (String(item.contents) === "") {
                    throw new Error("入稿情報の文字列が空です。");
                }
                if (String(item.contents) !== buildLabel(plan.name, plan.rect, params)) {
                    throw new Error("入稿情報の文字列がアートボード情報と一致しません。");
                }
            } catch (e3) {
                if (e3 && e3.message && String(e3.message).indexOf("入稿情報の文字列") === 0) {
                    throw e3;
                }
                throw new Error("入稿情報の文字列を検証できませんでした。");
            }
        }

        bounds = readVisibleBounds(item, "入稿情報のvisibleBounds");
        if (!nearlyEqual(bounds[0], plan.targetLeft, BOUNDS_TOLERANCE_PT) ||
            !nearlyEqual(bounds[1], plan.targetTop, BOUNDS_TOLERANCE_PT)) {
            throw new Error("入稿情報のアートボード" + (plan.index + 1) + "上の位置が不正です。");
        }
        if (!pointIsInsideRect(bounds[0], bounds[1], plan.rect)) {
            throw new Error("入稿情報のアートボード" + (plan.index + 1) + "への対応を確認できません。");
        }
        return bounds;
    }

    function validateOutputSet(outputs, plans, outputLayer, params) {
        var i;
        var j;
        var item;

        if (outputs.length !== plans.length) {
            throw new Error("全アートボード分の入稿情報を作成できませんでした。");
        }

        for (i = 0; i < outputs.length; i++) {
            item = outputs[i];
            if (!item) {
                throw new Error("入稿情報の件数または参照が不正です。");
            }
            for (j = 0; j < i; j++) {
                if (outputs[j] === item) {
                    throw new Error("入稿情報の件数または参照が不正です。");
                }
            }
            validateOutputItem(item, outputLayer, plans[i], params);
        }
        return true;
    }

    function removeCreatedOutputs(outputs) {
        var success = true;
        var i;

        for (i = outputs.length - 1; i >= 0; i--) {
            if (!removeItemQuietly(outputs[i])) {
                success = false;
            }
        }
        return success;
    }

    function removeCreatedLayerIfEmpty(state) {
        if (!state || !state.created || !state.layer) {
            return true;
        }
        try {
            if (state.layer.pageItems.length === 0) {
                state.layer.remove();
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function addUniqueReference(list, item) {
        var i;

        if (item === null || typeof item === "undefined") {
            return;
        }
        for (i = 0; i < list.length; i++) {
            if (list[i] === item) {
                return;
            }
        }
        list.push(item);
    }

    function isSelectionReferenceUsable(item) {
        if (!item) {
            return false;
        }
        try {
            item.selected;
        } catch (e) {
            return false;
        }
        return true;
    }

    function findReferenceIndex(list, item) {
        var i;

        if (!list) {
            return -1;
        }
        for (i = 0; i < list.length; i++) {
            if (list[i] === item) {
                return i;
            }
        }
        return -1;
    }

    function buildSelectionMapping(originalSelection, previousOutputs, outputLayer) {
        var mapping = {
            external: [],
            managedIndices: []
        };
        var i;
        var index;
        var managed;

        for (i = 0; i < originalSelection.length; i++) {
            if (!isSelectionReferenceUsable(originalSelection[i])) {
                continue;
            }
            managed = false;
            index = findReferenceIndex(previousOutputs, originalSelection[i]);
            if (index >= 0 && isDirectChildOf(originalSelection[i], outputLayer)) {
                addUniqueReference(mapping.managedIndices, index);
                managed = true;
            }
            if (!managed) {
                addUniqueReference(mapping.external, originalSelection[i]);
            }
        }
        return mapping;
    }

    function addSelectionTarget(targets, item, layer) {
        if (!item || !isSelectionReferenceUsable(item)) {
            return;
        }
        if (layer && !isItemPresentInLayer(layer, item)) {
            return;
        }
        addUniqueReference(targets, item);
    }

    function findLivePreviousOutput(index, previousOutputs, backupState, outputLayer) {
        var entry;

        if (backupState && backupState.entries && backupState.entries[index]) {
            entry = backupState.entries[index];
            if (entry.original && isItemPresentInLayer(outputLayer, entry.original)) {
                return entry.original;
            }
            if (entry.restoredItem && isItemPresentInLayer(outputLayer, entry.restoredItem)) {
                return entry.restoredItem;
            }
        }
        if (previousOutputs && previousOutputs[index] &&
            isItemPresentInLayer(outputLayer, previousOutputs[index])) {
            return previousOutputs[index];
        }
        return null;
    }

    function buildSelectionTargets(originalSelection, mapping, success, createdOutputs,
                                   previousOutputs, backupState, outputLayer) {
        var targets = [];
        var i;
        var index;
        var target;

        if (!mapping) {
            for (i = 0; i < originalSelection.length; i++) {
                addSelectionTarget(targets, originalSelection[i], null);
            }
            return targets;
        }
        for (i = 0; i < mapping.external.length; i++) {
            addSelectionTarget(targets, mapping.external[i], null);
        }
        for (i = 0; i < mapping.managedIndices.length; i++) {
            index = mapping.managedIndices[i];
            target = null;
            if (success && createdOutputs && createdOutputs[index]) {
                target = createdOutputs[index];
            } else {
                target = findLivePreviousOutput(index, previousOutputs, backupState, outputLayer);
            }
            addSelectionTarget(targets, target, outputLayer);
        }
        return targets;
    }

    function restoreSelection(doc, selectionTargets) {
        var restored = true;
        var i;

        try {
            doc.selection = null;
        } catch (e) {
            restored = false;
        }
        for (i = 0; i < selectionTargets.length; i++) {
            if (!isSelectionReferenceUsable(selectionTargets[i])) {
                continue;
            }
            try {
                selectionTargets[i].selected = true;
            } catch (e2) {
                restored = false;
            }
        }
        return restored;
    }

    function main() {
        var doc;
        var originalCoordinateSystem;
        var originalActiveLayer;
        var originalActiveArtboardIndex;
        var originalSelection = [];
        var currentSelection;
        var params;
        var plans;
        var font;
        var outputState = null;
        var previousOutputs = [];
        var createdOutputs = [];
        var backupState = null;
        var cleanupResult = null;
        var previousLayerOrder = null;
        var failureMessage = null;
        var success = false;
        var cancelled = false;
        var restorationFailed = false;
        var selectionMapping = null;
        var selectionTargets;
        var restoredPrevious;
        var validatedPrevious;
        var restoredPreviousOutputs;
        var backupLayerName;
        var backupRetained;
        var i;

        if (app.documents.length === 0) {
            alert("ドキュメントを開いてから実行してください。");
            return;
        }

        doc = app.activeDocument;
        originalCoordinateSystem = app.coordinateSystem;
        originalActiveLayer = doc.activeLayer;
        originalActiveArtboardIndex = doc.artboards.getActiveArtboardIndex();
        currentSelection = doc.selection;
        if (currentSelection) {
            for (i = 0; i < currentSelection.length; i++) {
                addUniqueReference(originalSelection, currentSelection[i]);
            }
        }

        try {
            params = showDialog();
            if (params === null) {
                cancelled = true;
                return;
            }

            app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
            plans = getArtboardPlan(doc, params);
            font = findNotoSansJpRegular();
            if (font === null) {
                throw new Error("Noto Sans JP Regularが見つかりません。フォントをインストールしてから再実行してください。");
            }

            outputState = getOrCreateOutputLayer(doc);
            previousOutputs = collectPreviousOutputs(outputState.layer, plans);
            selectionMapping = buildSelectionMapping(originalSelection, previousOutputs, outputState.layer);
            if (previousOutputs.length > 0) {
                previousLayerOrder = captureLayerOrder(outputState.layer);
            }
            prepareOutputLayer(outputState);

            for (i = 0; i < plans.length; i++) {
                createdOutputs.push(createOutput(doc, outputState.layer, plans[i], params, font));
            }

            if (typeof app.redraw === "function") {
                app.redraw();
            }
            validateOutputSet(createdOutputs, plans, outputState.layer, params);

            if (previousOutputs.length > 0) {
                backupState = createPreviousOutputBackup(doc, outputState.layer, previousOutputs, previousLayerOrder);
                try {
                    outputState.layer.zOrder(ZOrderMethod.BRINGTOFRONT);
                } catch (backupOrderError) {
                    throw new Error("バックアップ作成後に「入稿情報」レイヤーを最前面へ戻せませんでした。");
                }
                cleanupResult = deletePreviousOutputsWithBackup(backupState);
                if (!cleanupResult.success) {
                    throw new Error(cleanupResult.message);
                }
                if (!removeBackupLayer(backupState)) {
                    throw new Error("旧入稿情報の置換後にバックアップ用レイヤーを削除できませんでした。");
                }
                backupState = null;
            }
            success = true;
        } catch (e) {
            failureMessage = getErrorMessage(e);
            if (createdOutputs.length > 0 && !removeCreatedOutputs(createdOutputs)) {
                failureMessage += "\n今回作成した入稿情報を削除できませんでした。";
            }
            if (backupState !== null) {
                backupLayerName = getLayerNameSafe(backupState.layer);
                restoredPrevious = restorePreviousOutputsFromBackup(backupState, plans);
                validatedPrevious = false;
                if (restoredPrevious) {
                    try {
                        restoredPreviousOutputs = collectPreviousOutputs(backupState.outputLayer, plans);
                        if (!restoredPreviousOutputs || restoredPreviousOutputs.length !== plans.length) {
                            throw new Error("復元された旧入稿情報が全アートボード分そろっていません。");
                        }
                        validatedPrevious = true;
                    } catch (restoreValidationError) {
                        failureMessage += "\n旧入稿情報の復元後に全アートボード分の完全セットを確認できませんでした。";
                    }
                }
                if (!restoredPrevious || !validatedPrevious) {
                    failureMessage += "\n旧入稿情報をバックアップから完全には復元できませんでした。";
                    backupRetained = retainBackupLayerHiddenLocked(backupState);
                    if (backupRetained) {
                        failureMessage += "\nバックアップ用レイヤー「" + backupLayerName + "」を残しました。手動復旧が必要です。";
                    } else {
                        failureMessage += "\nバックアップ用レイヤー「" + backupLayerName + "」を非表示・ロック状態で保持できませんでした。手動復旧が必要です。レイヤーを確認してください。";
                    }
                } else if (!removeBackupLayer(backupState)) {
                    failureMessage += "\n旧入稿情報を復元し、完全セットを確認しましたが、バックアップ用レイヤー「" + backupLayerName + "」を削除できませんでした。";
                    backupRetained = retainBackupLayerHiddenLocked(backupState);
                    if (backupRetained) {
                        failureMessage += "\nバックアップ用レイヤー「" + backupLayerName + "」を残しました。手動復旧が必要です。";
                    } else {
                        failureMessage += "\nバックアップ用レイヤー「" + backupLayerName + "」を非表示・ロック状態で保持できませんでした。手動復旧が必要です。レイヤーを確認してください。";
                    }
                }
            }
            if (outputState !== null && outputState.created && !removeCreatedLayerIfEmpty(outputState)) {
                failureMessage += "\n今回作成した「入稿情報」レイヤーを削除できませんでした。";
            }
        } finally {
            if (!success && !cancelled && outputState !== null && !restoreOutputLayerState(outputState)) {
                restorationFailed = true;
            }
            try {
                app.coordinateSystem = originalCoordinateSystem;
            } catch (coordinateError) {
                restorationFailed = true;
            }
            try {
                doc.activeLayer = originalActiveLayer;
            } catch (layerError) {
                restorationFailed = true;
            }
            try {
                doc.artboards.setActiveArtboardIndex(originalActiveArtboardIndex);
            } catch (artboardError) {
                restorationFailed = true;
            }
            selectionTargets = buildSelectionTargets(
                originalSelection,
                selectionMapping,
                success,
                createdOutputs,
                previousOutputs,
                backupState,
                outputState ? outputState.layer : null
            );
            if (!restoreSelection(doc, selectionTargets)) {
                restorationFailed = true;
            }
        }

        if (restorationFailed) {
            if (failureMessage === null) {
                failureMessage = "処理後のIllustrator状態を完全には復元できませんでした。";
            } else {
                failureMessage += "\n処理後のIllustrator状態を完全には復元できませんでした。";
            }
            success = false;
        }

        if (!success && failureMessage !== null) {
            alert(SCRIPT_NAME + "\n\n" + failureMessage);
        }
    }

    if (typeof __ARTBOARD_SUBMISSION_INFO_TEST__ !== "undefined" &&
        __ARTBOARD_SUBMISSION_INFO_TEST__) {
        __ARTBOARD_SUBMISSION_INFO_TEST_API__ = {
            SCRIPT_NAME: SCRIPT_NAME,
            OUTPUT_LAYER_NAME: OUTPUT_LAYER_NAME,
            OUTPUT_ITEM_NAME: OUTPUT_ITEM_NAME,
            OUTPUT_NOTE: OUTPUT_NOTE,
            FONT_SIZE_PT: FONT_SIZE_PT,
            OFFSET_MM: OFFSET_MM,
            BOUNDS_TOLERANCE_PT: BOUNDS_TOLERANCE_PT,
            mmToPt: mmToPt,
            ptToMm: ptToMm,
            calculatePhysicalDimensions: calculatePhysicalDimensions,
            getSubmissionDimensions: getSubmissionDimensions,
            getArtboardName: getArtboardName,
            buildLabel: buildLabel,
            getArtboardPlan: getArtboardPlan,
            parsePositiveInteger: parsePositiveInteger,
            parseScale: parseScale,
            parseManualDimension: parseManualDimension,
            createBlackColor: createBlackColor,
            validateManagedOutputOwnership: validateManagedOutputOwnership,
            validateOutputItem: validateOutputItem,
            validateOutputSet: validateOutputSet,
            createOutput: createOutput,
            removeCreatedOutputs: removeCreatedOutputs,
            collectPreviousOutputs: collectPreviousOutputs,
            buildOutputNote: buildOutputNote,
            createPreviousOutputBackup: createPreviousOutputBackup,
            deletePreviousOutputsWithBackup: deletePreviousOutputsWithBackup,
            restorePreviousOutputsFromBackup: restorePreviousOutputsFromBackup,
            removeBackupLayer: removeBackupLayer,
            pointIsInsideRect: pointIsInsideRect,
            main: main
        };
    } else {
        main();
    }
}());
