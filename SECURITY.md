# Security Policy

## Scope

This repository contains local Adobe Illustrator ExtendScript files. The scripts are designed to operate on the active Illustrator document and its selected objects. They do not require network access, external processes, or credentials.

## Safe use

- Save the Illustrator document before running a script.
- Run path, transform, and layer-order operations on a copy before using them in production.
- Review a script before running modified or third-party versions.
- Do not add credentials, private document data, or external downloader code to this repository.

## Reporting a vulnerability

Do not publish a proof of concept that could harm users or documents. If GitHub private vulnerability reporting is available for this repository, use it. Otherwise, contact [@git00152](https://github.com/git00152) through GitHub with a minimal description, affected file, Illustrator version, and reproduction steps.

Security reports are particularly welcome for unexpected code execution, filesystem access, network access, destructive document changes beyond the documented behavior, and unsafe input handling.

## Verification boundary

The publication review uses static inspection to check for network access, external process execution, file writes, and dynamic evaluation. It does not replace manual testing in every Illustrator version or for every document structure.
