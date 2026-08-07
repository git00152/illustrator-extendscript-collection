var docObj = app.activeDocument;

function getOrCreateLayer(layerName) {
    var layer;
    try {
        layer = docObj.layers.getByName(layerName);
    } catch (e) {
        layer = docObj.layers.add();
        layer.name = layerName;
    }
    return layer;
}

function getColor() {
    var regSwatch = null;
    var targetColor;

    try {
        for (var i = 0; i < docObj.swatches.length; i++) {
            if (docObj.swatches[i].name === "[レジストレーション]") {
                regSwatch = docObj.swatches[i];
                break;
            }
        }

        if (regSwatch) {
            targetColor = regSwatch.color;
        } else {
            targetColor = new CMYKColor();
            targetColor.cyan = 100;
            targetColor.magenta = 100;
            targetColor.yellow = 100;
            targetColor.black = 100;
        }
    } catch (e) {}
    return targetColor;
}

function drawLine(startPoint, middlePoint, endPoint) {
    var line = docObj.pathItems.add();
    line.setEntirePath([startPoint, middlePoint, endPoint]);
    line.filled = false;
    line.strokeWidth = 0.425;
    line.strokeColor = getColor();
    return line;
}

function point(num) {
    var objUV = new UnitValue(num, "mm");
    return objUV.as("pt");
}

function parsePositiveNumber(text, label) {
    var value = Number(text);
    if (isNaN(value) || value <= 0) {
        alert(label + "が無効です。0より大きい数値を入力してください。");
        return null;
    }
    return value;
}

function createTrimMarks(bounds, layerName, trimGapValue) {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

    var rect = bounds;
    var left = rect[0], top = rect[1], right = rect[2], bottom = rect[3];
    var width = right - left;
    var height = top - bottom;
    var centerX = left + width / 2;
    var centerY = top - height / 2;

    var trimLayer = getOrCreateLayer(layerName);
    docObj.activeLayer = trimLayer;
    trimLayer.locked = false;

    var gapPt = point(trimGapValue);
    var markOuterPt = gapPt * 3;
    var centerMarkShortLengthPt = gapPt * 3;
    var centerMarkHalfPt = gapPt * 4.5;
    var centerMarkOffsetPt = centerMarkHalfPt / 2;
    var centerMarkShortPt = centerMarkOffsetPt - (centerMarkShortLengthPt / 4);

    var trimGroup = docObj.groupItems.add();
    var lines = [];

    lines.push(drawLine([left - markOuterPt, top], [left - gapPt, top], [left - gapPt, top + markOuterPt]));
    lines.push(drawLine([left - markOuterPt, top + gapPt], [left, top + gapPt], [left, top + markOuterPt]));
    lines.push(drawLine([right + markOuterPt, top], [right + gapPt, top], [right + gapPt, top + markOuterPt]));
    lines.push(drawLine([right + markOuterPt, top + gapPt], [right, top + gapPt], [right, top + markOuterPt]));
    lines.push(drawLine([left - markOuterPt, bottom], [left - gapPt, bottom], [left - gapPt, bottom - markOuterPt]));
    lines.push(drawLine([left - markOuterPt, bottom - gapPt], [left, bottom - gapPt], [left, bottom - markOuterPt]));
    lines.push(drawLine([right + markOuterPt, bottom], [right + gapPt, bottom], [right + gapPt, bottom - markOuterPt]));
    lines.push(drawLine([right + markOuterPt, bottom - gapPt], [right, bottom - gapPt], [right, bottom - markOuterPt]));

    lines.push(drawLine([centerX - centerMarkHalfPt, top + centerMarkOffsetPt], [centerX, top + centerMarkOffsetPt], [centerX + centerMarkHalfPt, top + centerMarkOffsetPt]));
    lines.push(drawLine([centerX, top + centerMarkShortPt], [centerX, top + centerMarkOffsetPt], [centerX, top + centerMarkHalfPt]));
    lines.push(drawLine([centerX - centerMarkHalfPt, bottom - centerMarkOffsetPt], [centerX, bottom - centerMarkOffsetPt], [centerX + centerMarkHalfPt, bottom - centerMarkOffsetPt]));
    lines.push(drawLine([centerX, bottom - centerMarkShortPt], [centerX, bottom - centerMarkOffsetPt], [centerX, bottom - centerMarkHalfPt]));

    lines.push(drawLine([left - centerMarkOffsetPt, centerY + centerMarkHalfPt], [left - centerMarkOffsetPt, centerY], [left - centerMarkOffsetPt, centerY - centerMarkHalfPt]));
    lines.push(drawLine([left - centerMarkShortPt, centerY], [left - centerMarkOffsetPt, centerY], [left - centerMarkHalfPt, centerY]));
    lines.push(drawLine([right + centerMarkOffsetPt, centerY + centerMarkHalfPt], [right + centerMarkOffsetPt, centerY], [right + centerMarkOffsetPt, centerY - centerMarkHalfPt]));
    lines.push(drawLine([right + centerMarkShortPt, centerY], [right + centerMarkOffsetPt, centerY], [right + centerMarkHalfPt, centerY]));

    for (var j = 0; j < lines.length; j++) {
        lines[j].move(trimGroup, ElementPlacement.PLACEATEND);
    }

    trimLayer.locked = true;
}

var dialog = new Window("dialog", "トリムマーク生成");
dialog.orientation = "column";
dialog.alignChildren = "left";

var gapGroup = dialog.add("group");
gapGroup.add("statictext", undefined, "間隔：");
var trimGap = gapGroup.add("edittext", undefined, "3");
trimGap.characters = 6;
gapGroup.add("statictext", undefined, "mm");

var layerGroup = dialog.add("group");
layerGroup.add("statictext", undefined, "レイヤー名：");
var layerName = layerGroup.add("edittext", undefined, "trimMark");
layerName.characters = 12;

var buttonGroup = dialog.add("group");
buttonGroup.alignment = "center";
var btnOK = buttonGroup.add("button", undefined, "OK", { name: "ok" });
var btnCancel = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

trimGap.active = true;

btnCancel.onClick = function () {
    dialog.close();
};

btnOK.onClick = function () {
    var trimGapValue = parsePositiveNumber(trimGap.text, "間隔");
    if (trimGapValue === null) {
        return;
    }

    var targetLayerName = layerName.text;
    if (targetLayerName === "") {
        alert("レイヤー名を入力してください。");
        return;
    }

    var selection = docObj.selection;
    if (!selection || selection.length === 0) {
        alert("トリムマークを作成する矩形を選択してください。");
        return;
    }

    var selectedBounds = [];
    for (var i = 0; i < selection.length; i++) {
        if (selection[i].geometricBounds) {
            selectedBounds.push(selection[i].geometricBounds);
        }
    }

    if (selectedBounds.length === 0) {
        alert("トリムマークを作成できる矩形を選択してください。");
        return;
    }

    dialog.close();

    for (var j = 0; j < selectedBounds.length; j++) {
        createTrimMarks(selectedBounds[j], targetLayerName, trimGapValue);
    }
};

dialog.center();
dialog.show();
