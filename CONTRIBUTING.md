# Contributing

## Before submitting a change

- Keep Adobe Illustrator ExtendScript code compatible with ES3: use `var`, named functions, and ordinary `for` loops.
- Do not introduce `eval`, network requests, external command execution, credentials, or document file writes unless the feature has been explicitly reviewed.
- Preserve `#include` relationships between an entry script and its `lib/` directory.
- Prefer `setEntirePath()` followed by handle assignment when replacing Illustrator path points.
- Add or update the script catalog when a script's user-facing purpose changes.

## Validation

Run the changed script on a copy of an Illustrator document and confirm these cases where relevant:

1. No-document and empty-selection handling.
2. Valid input, invalid input, and Cancel behavior.
3. The expected document change and Undo behavior.
4. The script's documented target types and unsupported-type handling.

Include the Illustrator version, test document type, and observed result in a pull request. Do not include client artwork or other private source files.
