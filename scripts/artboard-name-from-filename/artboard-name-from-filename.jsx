#target illustrator

(function () {
    function showError(message) {
        alert("アートボード名を変更できませんでした。\n\n" + message);
    }

    function getBaseFileName(doc) {
        var fullName;
        var fileName;
        var dotIndex;

        try {
            fullName = doc.fullName;
        } catch (e) {
            throw new Error("先にIllustratorファイルを保存してください。");
        }

        if (!fullName || !fullName.exists) {
            throw new Error("先にIllustratorファイルを保存してください。");
        }

        try {
            fileName = File.decode(fullName.name);
        } catch (e2) {
            fileName = String(doc.name);
        }

        dotIndex = fileName.lastIndexOf(".");
        if (dotIndex > 0) {
            fileName = fileName.substring(0, dotIndex);
        }

        if (fileName.length === 0) {
            throw new Error("ファイル名を取得できませんでした。");
        }

        return fileName;
    }

    function zeroPad(value, width) {
        var text = String(value);
        while (text.length < width) {
            text = "0" + text;
        }
        return text;
    }

    function buildArtboardNames(baseName, count) {
        var names = [];
        var width;
        var i;

        if (count === 1) {
            names.push(baseName);
            return names;
        }

        width = Math.max(2, String(count).length);
        for (i = 0; i < count; i++) {
            names.push(baseName + "_" + zeroPad(i + 1, width));
        }
        return names;
    }

    function renameArtboards(artboards, names) {
        var originalNames = [];
        var renamedCount = 0;
        var i;

        for (i = 0; i < artboards.length; i++) {
            originalNames.push(artboards[i].name);
        }

        try {
            for (i = 0; i < artboards.length; i++) {
                artboards[i].name = names[i];
                renamedCount += 1;
            }
        } catch (e) {
            for (i = 0; i < renamedCount; i++) {
                try {
                    artboards[i].name = originalNames[i];
                } catch (restoreError) {}
            }
            throw new Error("変更中にエラーが発生したため、元の名前に戻しました。");
        }
    }

    function main() {
        var doc;
        var artboards;
        var baseName;
        var names;
        var message;

        if (app.documents.length === 0) {
            throw new Error("Illustratorドキュメントを開いてください。");
        }

        doc = app.activeDocument;
        artboards = doc.artboards;
        baseName = getBaseFileName(doc);
        names = buildArtboardNames(baseName, artboards.length);

        if (names.length === 1) {
            message = "アートボード名を次の名前に変更します。\n\n" + names[0];
        } else {
            message = String(names.length) + "個のアートボード名を変更します。\n\n" +
                names[0] + " 〜 " + names[names.length - 1];
        }

        if (!confirm(message, true, "アートボード名をファイル名に変更")) {
            return;
        }

        renameArtboards(artboards, names);

        alert(String(artboards.length) + "個のアートボード名を変更しました。");
    }

    try {
        main();
    } catch (error) {
        showError(error && error.message ? String(error.message) : String(error));
    }
}());
