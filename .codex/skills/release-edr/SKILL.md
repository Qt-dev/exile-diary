---
name: release-edr
description: "Release this repository from one version argument: bump patch, minor, or major from the current package version, or use an exact semver; coordinate versioning, changelog generation, and the GitHub release update. Use when asked to publish a new npm/GitHub release."
---

# ReleaseEDR

Run this workflow with exactly one parameter, `version`. Accept `patch`, `minor`, or `major` to bump that semver component from `package.json` (reset lower components to zero), or accept an exact version such as `4.1.0`. Reject other values before making changes.

## Workflow

Start these two workflows in parallel on fresh specialized agents, passing the previous and resolved target versions:

1. **Version** — git/npm specialist, current model, Light effort. Check out `main`, pull from `origin`, bump to the full npm version, capture the npm version and git tag, push the commit and tag to GitHub, and report the results.
2. **Documentation** — documentation specialist, current model, Medium effort. Find PRs merged between the two versions, generate a proper changelog, and save it exactly as `.tmp/<target-version>-changelog.md`.

Stop if either prerequisite fails. After the first prerequisite finishes, wait five minutes; begin release processing only once both have finished and that delay has elapsed.

For release processing, check GitHub for a release matching the target tag. If it exists, replace its body with the complete changelog file. If it does not exist, inspect the GitHub Actions workflow named `release`: report its error and stop if it errored; otherwise wait five minutes and repeat the release check. Do not fabricate results or delete the changelog.

Report the resolved version, npm version, git tag, changelog path, release URL, and release-body update status. On failure, include the exact failed stage and command/GitHub error.

## Overview

Automate npm/GitHub releases from a single version argument. The workflow coordinates version bumping, changelog generation, GitHub Actions verification, and release-body publication.
