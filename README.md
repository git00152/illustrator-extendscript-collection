# Adobe Illustrator ExtendScript Collection

Adobe Illustrator で実行する、制作作業向けの ExtendScript（`.jsx`）集です。各スクリプトはアクティブドキュメントまたは選択オブジェクトを変更します。実行前に `.ai` ファイルを保存し、まず複製ファイルで動作を確認してください。

## 含まれるスクリプト

| スクリプト | 役割 | 実行対象 |
| --- | --- | --- |
| [`angle-reset`](scripts/angle-reset/angle-reset.jsx) | 選択オブジェクトの回転・シアー・拡大縮小をリセットします。配置画像、ラスタ画像、クリッピンググループ、グループ、テキスト、長方形、直線を扱います。 | 選択オブジェクト |
| [`curve-converter-v2`](scripts/curve-converter-v2/curve-converter-v2.jsx) | 長方形または凸多角形の角を、スーパー楕円・G2・クロソイド・G3 の曲線に変換します。角ごとの適用、プレビュー、キャンセル時の復元に対応します。 | 選択したパス |
| [`curve-optimizer`](scripts/curve-optimizer/curve-optimizer.jsx) | 選択パスのアンカーに G2 曲率連続補正を適用し、曲率コムをプレビュー表示します。 | 編集可能な選択パス |
| [`trim-marks`](scripts/trim-marks/trim-marks.jsx) | 選択オブジェクトの外接矩形を基準に、指定間隔（mm）のトリムマークを専用レイヤーへ生成します。 | 選択オブジェクト |
| [`layer-order-by-position`](scripts/layer-order-by-position/layer-order-by-position.jsx) | 同じ親レイヤーまたはグループ内の選択オブジェクトを、上から下・左から右の見た目の順に重ね直します。 | 同じ親を持つ 2 個以上の選択オブジェクト |

`curve-converter-v2` と `curve-optimizer` は、同じディレクトリにある `lib/` を実行時に読み込みます。エントリーポイントだけを移動せず、ディレクトリ全体を保持してください。詳細は [スクリプトカタログ](docs/SCRIPT_CATALOG.md) を参照してください。

## 実行方法

1. Illustrator で対象の `.ai` ファイルを保存します。
2. 必要に応じて対象オブジェクトまたはパスを選択します。
3. Illustrator の **ファイル > スクリプト > その他のスクリプト...** から対象の `.jsx` を選択します。
4. ダイアログの内容を確認して実行します。特にパス変形系のスクリプトは、複製ファイルでの検証を推奨します。

## 互換性と安全性

- Adobe Illustrator の ExtendScript 実行環境を対象としています。コードは ES3 互換構文で記述しています。
- これらのスクリプトにネットワーク通信、外部コマンド実行、テレメトリーは含まれません。
- Illustrator ドキュメントの内容、レイヤー、パス、重なり順を変更します。実行結果は環境・オブジェクトの構造によって異なるため、事前保存と目視確認が必要です。
- 実機 Illustrator での網羅テストは行っていません。公開前の検証範囲は [SECURITY.md](SECURITY.md) に記載しています。

## 公開範囲

このリポジトリには各機能の現行版だけを収録しています。旧版、開発用計画、エージェント設定、macOS メタデータ、配布用 ZIP は含めません。

## ライセンスと商標

このリポジトリのコードは [MIT License](LICENSE) の下で提供します。Adobe および Illustrator は Adobe Inc. の商標または登録商標です。本プロジェクトは Adobe Inc. と提携・承認・後援関係にありません。

Issue・変更提案は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。
