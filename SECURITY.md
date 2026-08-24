# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not include credentials, session exports, private prompts, local paths, or Shadow debug logs in a public issue.

If private reporting is unavailable, open a public issue containing only a request for a private contact channel. Do not disclose exploit details in that issue.

## Secrets and local data

This plugin does not own provider credentials. It uses the model, credential, sandbox, approval, session, and settings services supplied by DeepSeek Harness.

Shadow definitions and optional debug records live below the active `DSH_HOME`. Debug records may describe run identifiers and failures. Treat the entire Harness home as private application data and never commit or attach it without inspection.

Repository commits must not contain `.env` files, API keys, authorization headers, private keys, session archives, JSONL logs, compressed session data, acceptance artifacts, or machine-specific absolute paths. The ignore rules are a safeguard, not a substitute for reviewing the staged diff.

## Installation trust

GitHub installs should pin a reviewed commit SHA:

```sh
dsh plugin --profile web add github:whutzefengxie-ops/dsh-shadow-mind#<commit-sha>
```

The repository commits its `lib/` artifacts and has no `prepare` script, so this package does not execute its own build command during installation. Review both source and built artifacts when changing the pinned commit.

## Supported versions

Security fixes target the latest commit on the default branch. The initial release is developed against DeepSeek Harness `0.1.1-rc.2` and the upstream master API at commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
