# Adobe Illustrator ExtendScript Collection

[日本語](README.md) | English

A collection of ExtendScript (`.jsx`) files for production work in Adobe Illustrator. Each script modifies the active document or the selected objects. Save your `.ai` file before running a script, and try it on a duplicate file first.

This is an unofficial personal project. It is not affiliated with, approved, certified, or sponsored by Adobe Inc. The scripts do not update themselves, do not download external files automatically, and do not run downloaded files automatically.

> [!NOTE]
> Script dialogs and messages are currently in Japanese, except for `curve-converter-v2`, which is in English.
> In a non-Japanese version of Illustrator, `trim-marks` cannot find the registration swatch by its Japanese name and draws the marks in CMYK 100/100/100/100 instead of Registration.

## Included scripts

| Script | What it does | Target |
| --- | --- | --- |
| [`angle-reset`](scripts/angle-reset/angle-reset.jsx) | Resets rotation, shear, and scaling of the selected objects. Handles placed images, raster images, clipping groups, groups, text, closed four-point paths, and straight lines. | Selected objects |
| [`artboard-name-from-filename`](scripts/artboard-name-from-filename/artboard-name-from-filename.jsx) | Names every artboard with sequential numbers based on the file name of the saved AI file. | Active document |
| [`artboard-submission-info`](scripts/artboard-submission-info/artboard-submission-info.jsx) | Creates print submission information from each artboard's name and places it at 15 pt, 10 mm from the top left. The size can be calculated automatically or entered manually as W and H. | All artboards |
| [`curve-converter-v2`](scripts/curve-converter-v2/curve-converter-v2.jsx) | Converts the corners of a rectangle or convex polygon into superellipse, G2, clothoid, or G3 curves. Supports per-corner application, preview, and restoring on Cancel. | Selected path |
| [`curve-optimizer`](scripts/curve-optimizer/curve-optimizer.jsx) | Applies G2 curvature-continuity correction to the anchors of the selected paths and previews a curvature comb. | Editable selected paths |
| [`trim-marks`](scripts/trim-marks/trim-marks.jsx) | Generates trim marks on a dedicated layer around the bounding box of the selected objects, at a gap you specify in mm. | Selected objects |
| [`layer-order-by-position`](scripts/layer-order-by-position/layer-order-by-position.jsx) | Restacks selected objects in the same parent layer or group in visual order: top to bottom, then left to right. | Two or more selected objects with the same parent |

`curve-converter-v2` and `curve-optimizer` load the `lib/` folder in the same directory at run time. Keep the whole directory together instead of moving only the entry script. For details, see the [script catalog](docs/SCRIPT_CATALOG.md) (Japanese).

## How to run

1. Save the target `.ai` file in Illustrator.
2. Select the target objects or paths if needed.
3. In Illustrator, choose **File > Scripts > Other Script...** and select the `.jsx` file.
4. Review the dialog and run the script. Testing on a duplicate file is especially recommended for the path-transforming scripts.

## Compatibility and safety

- The scripts target Adobe Illustrator's ExtendScript runtime and are written in ES3-compatible syntax.
- The scripts contain no network access, external command execution, or telemetry.
- They modify the contents, layers, paths, and stacking order of Illustrator documents. Results vary with your environment and object structure, so save beforehand and check the result visually.
- They have not been exhaustively tested in Illustrator. The verification done before publishing is described in [SECURITY.md](SECURITY.md).

## What is published

This repository contains only the current version of each feature. It does not include old versions, development plans, agent settings, macOS metadata, or distribution ZIP files.

## License and trademarks

The code in this repository is provided under the [MIT License](LICENSE). Adobe and Illustrator are either registered trademarks or trademarks of Adobe Inc. This project is not affiliated with, approved, or sponsored by Adobe Inc.

For issues and change proposals, see [CONTRIBUTING.md](CONTRIBUTING.md).
