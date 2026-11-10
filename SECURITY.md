# Security policy

## Supported versions

Security fixes go into the `main` branch.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
[GitHub's private vulnerability reporting](https://github.com/boss477/sarvam-editor/security/advisories/new).
Include steps to reproduce, the affected commit, and the impact.

You will get an acknowledgment within a week. Once a fix ships, you will be credited in the
changelog unless you prefer to stay anonymous.

## Secrets

`SARVAM_API_KEY` and `EDITOR_AGENT_TOKEN` are read on the server only. Never prefix them with
`NEXT_PUBLIC_`, and never deploy the example values.
