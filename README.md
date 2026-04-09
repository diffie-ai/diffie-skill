# Diffie QA — Claude Code Skill

AI-powered E2E testing for Claude Code. Create tests, run them against real browsers, and get video recordings — all from natural language.

## Install

```bash
/plugin marketplace add diffie-ai/diffie-skill
/plugin install diffie@diffie
```

## What It Does

Diffie generates Playwright test code from plain English descriptions, runs tests in real browsers, and returns video recordings of every run.

**Interactive mode** — Create and manage tests from Claude Code:

```
> Create E2E tests for my app at https://myapp.com
```

The skill will:
1. Ask about key user flows and credentials
2. Scan your source code for selector hints (`data-testid`, `aria-label`, etc.)
3. Present a test plan for your approval
4. Create, run, and manage tests via the Diffie API

**PR testing mode** — Comment `/diffie test` on any GitHub PR:

```
/diffie test
/diffie test https://pr-42-preview.vercel.app
```

The skill autonomously analyzes the PR diff, creates a test for the core user-facing change, runs it against the preview deployment, and posts the result with a recording link as a PR comment.

## Setup

### 1. Authenticate

On first use, the skill opens a browser window for OAuth sign-in. Credentials are stored at `~/.diffie/credentials.json`.

### 2. Set Up PR Testing (Optional)

```
> Set up Diffie PR testing for this repo
```

The skill will:
- Generate a `.github/workflows/diffie-qa.yml` workflow file
- Ask for your preview deployment URL variable (e.g., `${{ steps.vercel.outputs.url }}`)
- Guide you through adding `ANTHROPIC_API_KEY` and `DIFFIE_API_TOKEN` as GitHub repo secrets

After setup, `/diffie test` works on every PR.

## Features

- **Natural language tests** — Describe what to test in plain English
- **Selector hints** — Automatically mines your source code for `data-testid`, `aria-label`, and other selectors to improve test reliability
- **Video recordings** — Every test run produces a recording you can watch
- **PR integration** — Post test results and recordings directly on GitHub PRs
- **Secrets management** — Encrypted credential storage for login flows
- **Test suites** — Group tests and run them together
- **Auto-fix** — When tests fail, reprocess with fix instructions

## Requirements

- [Claude Code](https://claude.ai/code) CLI or IDE extension
- A [Diffie](https://diffie.ai) account
- [Bun](https://bun.sh) runtime (for the login script)

## PR Testing Requirements

- `ANTHROPIC_API_KEY` — [Anthropic Console](https://console.anthropic.com)
- `DIFFIE_API_TOKEN` — [Diffie Settings](https://app.diffie.ai/settings/api-tokens) or from `~/.diffie/credentials.json`
- Preview deployments (Vercel, Netlify, etc.) or a staging URL

## Commands

| Command | Description |
|---------|-------------|
| `Create tests for my app` | Interactive test creation with approval flow |
| `Run my tests` | Run existing tests or suites |
| `Check test status` | Get latest run results |
| `Set up PR testing` | Generate GitHub Action workflow for `/diffie test` |
| `/diffie test` | (On PR) Autonomous E2E test from PR diff |
| `/diffie test <url>` | (On PR) Same, with explicit preview URL |

## How PR Testing Works

1. Someone comments `/diffie test` on a GitHub PR
2. A GitHub Action runs Claude Code with this skill
3. The skill reads the PR diff and changed files to understand what feature was built
4. It creates an E2E test and sends it to Diffie
5. Diffie runs the test in a real browser against the preview deployment
6. The skill posts the result on the PR — pass/fail, error details, and a link to watch the recording
7. On re-trigger, it updates the same comment instead of posting a new one
8. If the changes don't affect any user-facing flow, it posts a comment saying no test is applicable

## Links

- [Diffie](https://diffie.ai) — AI-powered E2E testing platform
- [Documentation](https://diffie.ai/docs)
- [Claude Code](https://claude.ai/code)
