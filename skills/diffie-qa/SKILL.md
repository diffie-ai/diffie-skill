---
name: diffie-qa
description: "Manage QA tests with Diffie - create tests, run tests, create test suites, run test suites, and check results. Use when user mentions 'diffie', 'QA test', 'test suite', 'run tests', or wants to do end-to-end testing with Diffie."
metadata:
  version: 2.0.0
---

# Diffie QA

You are an expert at using Diffie, an AI-powered E2E testing platform. Diffie generates Playwright test code from natural language descriptions and runs them against real websites.

**You interact with Diffie entirely through its REST API using API tokens.**

## Authentication

**The very first thing you do is check for a stored API token.**

Read `~/.diffie/credentials.json`:

```bash
cat ~/.diffie/credentials.json 2>/dev/null
```

The file contains:

```json
{
  "apiToken": "dif_...",
  "apiUrl": "https://api.diffie.ai"
}
```

### If the file exists and has `apiToken`

Use it directly. All API calls use:

```
Authorization: Bearer <apiToken>
```

### If the file does NOT exist or has no token

**You must execute the login script yourself using the Bash tool.** Do NOT ask the user to run it manually — execute it directly. It opens the browser for OAuth, the user signs in there, and the script automatically creates and saves an API token.

Tell the user: "I need to log you into Diffie. A browser window will open — please sign in there." Then immediately execute:

```bash
bun run ${CLAUDE_SKILL_DIR}/scripts/login.ts
```

For local development or custom environments, execute:

```bash
bun run ${CLAUDE_SKILL_DIR}/scripts/login.ts --api-url http://localhost:3005 --auth-url https://auth.alpha.diffie.ai
```

After the script completes, read `~/.diffie/credentials.json` to verify the token was saved.

**Do NOT proceed with any API calls until you have a valid token.**

### If an API call returns 401

The token is invalid or expired. Execute the login script again yourself using the Bash tool:

```bash
bun run ${CLAUDE_SKILL_DIR}/scripts/login.ts
```

## API Base URL

Read `apiUrl` from `~/.diffie/credentials.json`. Default: `https://api.diffie.ai`

All API calls go to: `{apiUrl}/ci/...`

Example:

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://api.diffie.ai/ci/tests
```

## State File — `.diffie-qa.md`

**CRITICAL: You MUST maintain a `.diffie-qa.md` file in the project root.** This is how test state persists across sessions. Without it, every session starts from scratch.

### On Skill Load — Always Read First

**The very first thing you do when this skill is invoked is read `.diffie-qa.md`.**

```
Read .diffie-qa.md from the project root
```

- If the file exists: you now know all test IDs, suite IDs, secret keys, and last run results. Use these directly — do not re-fetch from the API unless the user asks for fresh status.
- If the file does not exist: this is a fresh setup. Proceed with test planning.

### After Every API Mutation — Always Write Back

**Every time you make an API call that changes state, you MUST update `.diffie-qa.md` immediately after.** Not at the end of the conversation — right after the API call returns. This ensures state is saved even if the session is interrupted.

The mutations that require a write-back:

| API Call | What to Update in `.diffie-qa.md` |
|----------|-----------------------------------|
| `POST /ci/secrets` | Add row to Secrets table (key + description, never the value) |
| `POST /ci/tests` | Add row to Tests table (name, ID, processing status = `processing`, last run = `—`) |
| `GET /ci/tests/{id}` returns terminal status | Update the Processing column for that test |
| `POST /ci/tests/{id}/execute` | Note run triggered; after polling completes, update Last Run column |
| `POST /ci/tests/{id}/reprocess` | Set Processing column back to `processing` |
| `DELETE /ci/tests/{id}` | Remove row from Tests table |
| `POST /ci/suites` | Add row to Suites table |
| `POST /ci/suites/{id}/tests` | Update Tests column in Suites table |
| `DELETE /ci/suites/{id}/tests` | Update Tests column in Suites table |
| `POST /ci/suites/{id}/execute` | Update Last Suite Run section after polling completes |
| `DELETE /ci/secrets/{key}` | Remove row from Secrets table |

### File Format

```markdown
# Diffie QA State

## App
- **Name**: Cal.com
- **URL**: https://app.cal.com

## Secrets
| Key | Description |
|-----|-------------|
| LOGIN_EMAIL | Login email for Cal.com |
| LOGIN_PASSWORD | Login password for Cal.com |

## Tests
| Name | ID | Processing | Last Run |
|------|----|------------|----------|
| Cal.com > Login with Valid Credentials | abc-123 | processed | passed (2026-04-06) |
| Cal.com > Book a Meeting | def-456 | processed | failed (2026-04-06) |
| Cal.com > Create Event Type | ghi-789 | processing | — |

## Suites
| Name | ID | Tests |
|------|----|-------|
| Cal.com Smoke Tests | jkl-012 | abc-123, def-456, ghi-789 |

## Last Suite Run
- **Suite**: Cal.com Smoke Tests
- **Suite Run ID**: mno-345
- **Status**: failed
- **Results**: 2/3 passed, 1 failed
- **Date**: 2026-04-06
- **Failed Tests**:
  - Cal.com > Book a Meeting (def-456): "Timeout waiting for calendar to load"
```

### Rules

- **Never store secret values** — only key names and descriptions
- **Write immediately after each mutation** — do not batch updates or defer to end of session
- **Keep it accurate** — if you create a test, add it. If you delete one, remove it.
- **Overwrite stale data** — when you get fresh status from the API (e.g., a run result), update the corresponding row
- **One file per project** — if testing multiple apps from the same project, use separate `## App` sections
- **Add to .gitignore** — this file contains test IDs specific to a Diffie account

## How to Think About Test Cases

When the user asks you to create tests for an application, **do NOT immediately create tests**. First, think through what to test and present a structured test plan for the user to review.

### Step 1: Understand the Application

Ask the user (if not already provided):
- What is the application URL?
- What are the key user flows to test?
- Are there credentials needed? (login email/password, API keys, etc.)
- Any specific areas of concern?

### Step 2: Design Test Cases

Break down each test into a named test case with explicit, numbered steps. Think like a QA engineer — each test should cover one distinct user flow end-to-end.

Present the test plan to the user in this format:

```
Test Plan for [App Name] ([URL])

Test 1: [App Name] > [Feature] — [What It Validates]
Steps:
  1. [First action]
  2. [Next action]
  ...
  N. [Final verification]

Test 2: [App Name] > [Feature] — [What It Validates]
Steps:
  1. ...
```

**Example test plan:**

```
Test Plan for Cal.com (https://app.cal.com)

Test 1: Cal.com > Login with Valid Credentials
Steps:
  1. Navigate to the login page
  2. Enter the email from LOGIN_EMAIL secret
  3. Enter the password from LOGIN_PASSWORD secret
  4. Click the 'Sign in' button
  5. Verify the dashboard loads with the user's name displayed

Test 2: Cal.com > Book a Meeting with Valid Details
Steps:
  1. Login with the given credentials
  2. Navigate to the public booking page from the main sidebar
  3. Click on an available event type (e.g., 'Test Meeting')
  4. Select an available date from the calendar
  5. Click on an available time slot (e.g., '5:15pm')
  6. Verify that the booking form appears with pre-filled name and email fields
  7. Verify that the selected date and time are displayed correctly
  8. Fill in any required fields if not pre-filled
  9. Click the 'Confirm' button
  10. Verify that a booking confirmation message appears
  11. Make sure the booking is created successfully

Test 3: Cal.com > Create a New Event Type
Steps:
  1. Login with the given credentials
  2. Navigate to Event Types from the sidebar
  3. Click 'New Event Type'
  4. Enter 'Automated Test Event' as the title
  5. Set the duration to 30 minutes
  6. Click 'Continue' or 'Create'
  7. Verify the event type is created and appears in the list
  8. Delete the test event type to clean up
```

**Guidelines for designing steps:**
- Start with login if the app requires authentication — reference secrets by key name (e.g., "Enter the email from LOGIN_EMAIL secret")
- Each step should be a single, concrete action or verification
- Include both positive actions ("Click the button") and verifications ("Verify the page loads")
- End with a clear success criteria
- Think about cleanup if the test creates data (e.g., delete the created item)
- Be specific about UI elements ("Click the 'Sign In' button" not just "Sign in")

### Step 3: Extract Selector Hints from Source Code

**Before finalizing the test plan, scan the application's source code to extract selector hints.** Since you have access to the codebase, use it to give Diffie's test generator a head start — reducing exploration time and improving reliability.

#### ZERO TOLERANCE FOR HALLUCINATED SELECTORS

**NEVER invent, guess, or assume a selector exists.** Every selector hint you include MUST come from an actual grep/search result that you executed and verified. A wrong selector is worse than no selector — it causes the test generator to waste time trying selectors that don't exist, then fall back to manual discovery anyway.

**The rule is simple: if you didn't see it in a grep result, don't include it.**

#### How to extract selectors

For each test, you MUST run actual searches against the source code. Do not skip this step or fabricate results.

**Step 1: Find the relevant component files.**
```bash
# Find components related to the feature
Glob: **/components/**/*Schedule*  or  **/pages/availability*  etc.
```

**Step 2: Grep for testids and attributes in those files.**
```bash
# Search for data-testid in the relevant files
Grep: data-testid  in the component files you found
Grep: aria-label  in those files
Grep: name=  in form elements
```

**Step 3: Read the grep output. Only use selectors you see verbatim in the results.**

For dynamic testids like `` data-testid={`${weekday}-switch`} ``, you can infer the concrete values (e.g., `Sunday-switch`, `Monday-switch`) — but note in the hint that it's a dynamic pattern.

#### What to extract (priority order)
1. **`data-testid`** — most stable, purpose-built for testing
2. **`aria-label` / `role`** — accessible and Playwright-friendly
3. **`name` attributes** — especially on form inputs
4. **`id` attributes** — if stable and not auto-generated
5. **Specific CSS classes** — only if semantic (e.g., `.booking-calendar`, not `.css-1a2b3c`)

#### What to ignore
- Auto-generated classes (CSS modules hashes, Tailwind utilities)
- Framework internals (React keys, Vue refs)
- Selectors that look dynamic or positional

#### How to include hints in the test description

**These go inside the `description` string you send to `POST /ci/tests`.** There is no separate API field — the description is free-form text. Append a `Selector Hints` section at the end of each test description with only verified selectors:

```
Selector Hints:
- Schedule name input: [data-testid="availablity-title"]
- Sunday toggle: [data-testid="Sunday-switch"]
- Save button: [form="availability-form"][type="submit"]
- Delete option: [data-testid="delete-schedule"]
```

**Do NOT include file names or line numbers in the description** — those are implementation details that add noise. The hints should only contain the element label and the selector.

**Rules:**
- **ONLY include selectors you found via grep/search** — verify each one exists before adding it
- If you cannot find a selector for a step, **omit it entirely** — do NOT guess what it "might" be
- For dynamic patterns like `` `${weekday}-switch` ``, infer the concrete values (e.g., `Sunday-switch`)
- It is completely fine to have a `Selector Hints` section with only 2-3 entries, or even to omit it entirely if no testids were found in the source code
- **A test description with zero selector hints is better than one with fabricated hints**

### Step 4: Get User Approval

Wait for the user to review and approve the test plan (including selector hints). They may want to:
- Add or remove tests
- Modify steps
- Provide credentials
- Clarify expected behaviors

**Do NOT proceed to create tests until the user approves the plan.**

### Step 5: Store Credentials as Secrets

If the application requires login or any credentials, store them as secrets BEFORE creating tests. Secrets are encrypted and securely available during test execution.

**NEVER put actual credentials in the test description.** Always reference secret keys instead.

**Create an account-level secret** (available to all tests — upserts if key already exists):

```
POST /ci/secrets
Content-Type: application/json

{
  "key": "LOGIN_EMAIL",
  "value": "user@example.com",
  "description": "Login email for Cal.com"
}
```

**List existing secrets** (values are masked in the response):

```
GET /ci/secrets
```

In test descriptions, reference secrets by their key name. The test runner automatically injects them. Example:

> "Navigate to the login page.\nEnter the email from LOGIN_EMAIL secret and the password from LOGIN_PASSWORD secret.\nClick 'Sign In'.\nVerify the dashboard loads."

### Step 6: Create Tests

**STOP — Before creating any test, verify you have completed Step 3 (Extract Selector Hints).** If you haven't scanned the source code for selectors yet, do it now. Every test `description` string MUST end with a `\n\nSelector Hints:\n- ...` block. There is NO separate API field for hints — they go inside the `description` value.

Convert each approved test case into an API call. The `description` field should have each step on its own line (separated by `\n`), followed by `\n\nSelector Hints:\n` with the selectors you extracted in Step 3. This makes the spec readable for both the AI generator and humans reviewing the test.

```
POST /ci/tests
Content-Type: application/json

{
  "name": "Cal.com > Book a Meeting with Valid Details",
  "description": "Login with the given credentials (use LOGIN_EMAIL and LOGIN_PASSWORD secrets).\nNavigate to the public booking page from the main sidebar.\nClick on an available event type (e.g., 'Test Meeting').\nSelect an available date from the calendar.\nClick on an available time slot (e.g., '5:15pm').\nVerify that the booking form appears with pre-filled name and email fields.\nVerify that the selected date and time are displayed correctly.\nFill in any required fields if not pre-filled.\nClick the 'Confirm' button.\nVerify that a booking confirmation message appears.\nMake sure the booking is created successfully.\n\nSelector Hints:\n- Event type link: [data-testid=\"event-type-link\"]\n- Confirm booking: [data-testid=\"confirm-book-button\"]",
  "spec_url": "https://app.cal.com"
}
```

Response includes the test `id` and `processingStatus: "processing"`.

You can also pass secrets inline during test creation:

```json
{
  "name": "...",
  "description": "...",
  "spec_url": "...",
  "secrets": [
    { "key": "API_KEY", "value": "sk-test-123", "description": "Stripe test key" }
  ]
}
```

**Description formatting rules:**
- Write each step on its own line, separated by `\n` — do NOT write a single long paragraph
- Each line should be one action or one verification, ending with a period
- Reference secret keys explicitly: "use LOGIN_EMAIL and LOGIN_PASSWORD secrets"
- Be specific about UI elements and expected outcomes
- Include verification steps — don't just do actions, verify results
- **MANDATORY: Append a `\n\nSelector Hints:\n` section at the end** with selectors extracted from source code (see Step 3). Do NOT create a test without selector hints — go back and scan the source code first if you haven't already

### Step 7: Wait for Processing and Run

After creating a test, poll until processing is complete:

```
GET /ci/tests/{testId}
```

Check `processingStatus` in the response:
- `"processing"` — still generating code, poll again in 5 seconds
- `"processed"` — ready to run
- `"error"` — generation failed, check `processingError`

Once processed, execute the test:

```
POST /ci/tests/{testId}/execute
```

Then poll the latest run:

```
GET /ci/runs?testId={testId}&limit=1
```

Check the run's `status`:
- `"pending"` or `"running"` — still executing, poll again in 5 seconds
- `"passed"` — test passed
- `"failed"` — test failed, check `errorMessage`

Get full run details:

```
GET /ci/runs/{runId}
```

### Step 8: Handle Failures

If a test fails, get the run details to understand the error:

```
GET /ci/runs/{runId}
```

Then reprocess with fix instructions:

```
POST /ci/tests/{testId}/reprocess
Content-Type: application/json

{
  "fixPrompt": "The login button text is 'Log in' not 'Sign In'. Also the calendar uses next-month arrow button to navigate."
}
```

Poll `GET /ci/tests/{testId}` until `processingStatus` is `"processed"` again, then re-run.

## Full End-to-End Workflow (Recommended)

This is the typical flow when a user says "create tests for my app":

1. **Check auth** — read `~/.diffie/credentials.json`, prompt for token if missing
2. **Read `.diffie-qa.md`** — check if tests already exist for this app
3. **Ask** what app, URL, credentials, and key flows to test (skip if state file already has this)
4. **Think** through test cases — present a structured test plan
5. **Mine source code** for selector hints — scan components/pages for `data-testid`, `aria-label`, `name`, `id` attributes and append to test descriptions
6. **Wait** for user approval
7. **Store secrets** via `POST /ci/secrets` → **write `.diffie-qa.md`**
8. **Create tests** via `POST /ci/tests` (descriptions include selector hints) → **write `.diffie-qa.md`** (add each test as you create it)
9. **Poll** `GET /ci/tests/{id}` until processed → **write `.diffie-qa.md`** (update processing column)
10. **Create a suite** via `POST /ci/suites` → **write `.diffie-qa.md`**
11. **Run the suite** via `POST /ci/suites/{id}/execute`, poll results → **write `.diffie-qa.md`** (update Last Suite Run)
12. **Fix** any failing tests via `POST /ci/tests/{id}/reprocess` → **write `.diffie-qa.md`**, re-run

### Returning Sessions

When the user comes back in a new session and says "run my tests" or "check test status":

1. **Check auth** — read `~/.diffie/credentials.json`
2. **Read `.diffie-qa.md`** — get test IDs, suite IDs directly, no API calls needed
3. **Act** — run the suite or check status using stored IDs
4. **Write `.diffie-qa.md`** — update with fresh results

## PR Testing Mode (Autonomous)

This mode runs in CI (GitHub Actions) when someone comments `/diffie test` on a PR. It is **fully autonomous** — no user approval, no interactive prompts.

### How It Gets Triggered

A GitHub Action workflow triggers on `/diffie test` comments. Claude Code runs with a prompt that includes:
- The preview deployment URL (auto-detected from Vercel/Netlify, or provided in the comment like `/diffie test https://staging.myapp.com`)
- The PR number and repo context

### Detection: Is This PR Mode?

You are in PR mode if ALL of these are true:
- You are running in a CI environment (check `CI=true` env var)
- The prompt mentions a PR or contains a preview URL
- There is no interactive user to prompt

When in PR mode, **never ask for user input**. Act autonomously.

### PR Mode Workflow

#### Step 1: Read Context

```bash
# Get the PR diff
git diff origin/main...HEAD

# Get changed files list
git diff origin/main...HEAD --name-only

# Get PR number from environment
echo $PR_NUMBER
```

Read `.diffie-qa.md` for existing app config, secrets, and known tests.

#### Step 2: Analyze the Diff

Read the diff and changed files to understand what was built or changed. Focus on:
- New or modified pages/routes
- New or modified UI components
- Changes to user-facing flows (forms, buttons, navigation)
- Changes to API endpoints that have corresponding UI

**Ignore** changes that are not user-facing:
- Documentation/README changes
- CI/CD config changes
- Backend-only refactors with no UI impact
- Test file changes
- Dependency updates
- Code style/formatting changes

#### Step 3: Decide If a Test Is Applicable

If the PR changes do NOT affect any user-facing flow, **post a comment and exit**:

```bash
gh pr comment $PR_NUMBER --body "$(cat <<'EOF'
## Diffie QA

No E2E test generated — this PR does not appear to affect user-facing flows.

Changes detected: refactor / docs / backend-only / config

> [Diffie](https://diffie.ai) — AI-powered E2E testing
EOF
)"
```

**Stop here.** Do not create a test.

#### Step 4: Extract Selector Hints from Changed Files

Follow the same selector extraction process as interactive mode (Step 3 of "How to Think About Test Cases"), but **scoped to the changed files only**.

```bash
# Only grep for selectors in files that changed
git diff origin/main...HEAD --name-only | xargs grep -l 'data-testid\|aria-label'
```

Read those files and extract `data-testid`, `aria-label`, `name`, `id` attributes relevant to the feature.

#### Step 5: Create and Run the Test

Determine the preview URL from one of these sources (in priority order):
1. URL passed in the `/diffie test <url>` comment → available as `$PREVIEW_URL` env var
2. Auto-detected from preview deployment step → available as `$PREVIEW_URL` env var
3. Default app URL from `.diffie-qa.md`

If no URL is available from any source, **post a comment and exit**:

```bash
gh pr comment $PR_NUMBER --body "$(cat <<'EOF'
## Diffie QA

❌ No preview URL available. Either:
- Configure a preview deployment (Vercel, Netlify, etc.) in the workflow
- Pass a URL directly: `/diffie test https://your-staging-url.com`

> [Diffie](https://diffie.ai) — AI-powered E2E testing
EOF
)"
```

Create the test:

```bash
curl -s -X POST "$API_URL/ci/tests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PR #'$PR_NUMBER' — <short description of the feature>",
    "description": "<steps derived from diff analysis>\n\nSelector Hints:\n- <hints from step 4>",
    "spec_url": "'$PREVIEW_URL'"
  }'
```

Poll `GET /ci/tests/{id}` until `processingStatus` is `processed` or `error`.

If processed, execute the test:

```bash
curl -s -X POST "$API_URL/ci/tests/$TEST_ID/execute" \
  -H "Authorization: Bearer $TOKEN"
```

Poll `GET /ci/runs?testId=$TEST_ID&limit=1` until the run reaches a terminal status.

Get full run details including recording:

```bash
curl -s "$API_URL/ci/runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

#### Step 6: Post Results to PR

Check if a previous Diffie QA comment exists on the PR (to update instead of creating a new one):

```bash
# Find existing Diffie QA comment
EXISTING_COMMENT=$(gh api repos/$REPO/issues/$PR_NUMBER/comments --jq '.[] | select(.body | startswith("## Diffie QA")) | .id' | head -1)
```

**On success (passed):**

```bash
BODY="$(cat <<'EOF'
## Diffie QA

**Test:** <test name>
**Status:** ✅ Passed (<duration>s)
**Recording:** [Watch test run](<recording URL or app URL for the run>)

> Tested against `<preview URL>` — [Diffie](https://diffie.ai)
EOF
)"

if [ -n "$EXISTING_COMMENT" ]; then
  gh api repos/$REPO/issues/comments/$EXISTING_COMMENT -X PATCH -f body="$BODY"
else
  gh pr comment $PR_NUMBER --body "$BODY"
fi
```

**On failure (failed):**

```bash
BODY="$(cat <<'EOF'
## Diffie QA

**Test:** <test name>
**Status:** ❌ Failed (<duration>s)
**Error:** <error message from run>
**Recording:** [Watch test run](<recording URL or app URL for the run>)

> Tested against `<preview URL>` — [Diffie](https://diffie.ai)
EOF
)"
```

**On processing error:**

```bash
BODY="$(cat <<'EOF'
## Diffie QA

**Status:** ⚠️ Could not generate test
**Error:** <processing error>

> [Diffie](https://diffie.ai) — AI-powered E2E testing
EOF
)"
```

#### Step 7: Clean Up

After posting the result, delete the PR test to avoid cluttering the user's test list:

```bash
curl -s -X DELETE "$API_URL/ci/tests/$TEST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Do NOT update `.diffie-qa.md` for PR tests — they are ephemeral.

### Important Rules for PR Mode

- **Never ask for user input** — you are running in CI, there is no one to respond
- **Never skip posting a comment** — always post a result, even if it's "no test applicable"
- **Update existing comments** — don't spam the PR with multiple Diffie comments
- **Delete PR tests after posting** — PR tests are one-off, not persistent
- **One test per PR** — focus on the single most important user-facing flow changed
- **Use the preview URL** — never test against production

## Setting Up PR Testing

When a user says "set up Diffie PR testing" or "set up PR testing for this repo", follow these steps:

### Step 1: Check Prerequisites

- Verify Diffie auth is set up (`~/.diffie/credentials.json` exists with a valid token)
- Read `.diffie-qa.md` to check if the app URL and secrets are already configured

### Step 2: Ask for Preview URL Variable

Ask the user: **"How does your CI get the preview deployment URL?"**

They should provide the GitHub Actions expression that resolves to their preview URL. Examples:
- Vercel: `${{ steps.vercel.outputs.url }}` (from `patrickedqvist/wait-for-vercel-preview`)
- Netlify: `${{ steps.netlify.outputs.url }}` (from `jakepartusch/wait-for-netlify-action`)
- Railway: `${{ steps.railway.outputs.url }}`
- Custom: any `steps.<id>.outputs.<field>` from their existing workflow

If they don't have preview deployments, they can leave it blank — users will pass the URL directly in the `/diffie test <url>` comment.

### Step 3: Generate the GitHub Action Workflow

Create `.github/workflows/diffie-qa.yml` using the template at `${CLAUDE_SKILL_DIR}/templates/diffie-qa.yml`.

Replace `__PREVIEW_URL_VARIABLE__` in the template with the user's provided expression, or remove the preview URL step entirely if they don't have one.

### Step 4: Instruct User on Repo Secrets

Tell the user to add these secrets to their GitHub repo (Settings → Secrets and variables → Actions):

| Secret | Value | Where to get it |
|--------|-------|-----------------|
| `ANTHROPIC_API_KEY` | Anthropic API key | https://console.anthropic.com |
| `DIFFIE_API_TOKEN` | Diffie API token | `cat ~/.diffie/credentials.json` or https://app.diffie.ai/settings/api-tokens |

### Step 5: Confirm Setup

After generating the workflow file, tell the user:

> PR testing is set up. Commit the workflow file and push. From now on, comment `/diffie test` on any PR to trigger an E2E test with a recording.
>
> If you want to pass a specific URL: `/diffie test https://your-url.com`

## API Reference

All routes are under `/ci/` and use API token auth (`Authorization: Bearer dif_...`).

### Tests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ci/tests?limit=50&processing_status={status}&name={search}` | List tests |
| `POST` | `/ci/tests` | Create test. Body: `{ name, description, spec_url, secrets? }` |
| `GET` | `/ci/tests/{id}` | Get test details (includes `processingStatus`, `generatedCode`, `recentRuns`) |
| `POST` | `/ci/tests/{id}/execute` | Run test |
| `POST` | `/ci/tests/execute-bulk` | Run multiple. Body: `{ testIds: [...] }` |
| `POST` | `/ci/tests/{id}/reprocess` | Reprocess. Body: `{ fixPrompt? }` |
| `DELETE` | `/ci/tests/{id}` | Delete test |

### Runs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ci/runs?testId={id}&limit=20` | List runs, optionally filtered by test |
| `GET` | `/ci/runs/{id}` | Get run details (`status`, `errorMessage`, `duration`, `executionLogs`) |

Run statuses: `pending`, `running`, `passed`, `failed`, `cancelled`

### Secrets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ci/secrets` | List account secrets (values masked) |
| `POST` | `/ci/secrets` | Upsert account secret. Body: `{ key, value, description? }` |
| `DELETE` | `/ci/secrets/{key}` | Delete secret by key name |

Secret key format: must match `^[a-zA-Z_][a-zA-Z0-9_]*$` (e.g., `LOGIN_EMAIL`, `API_KEY`)

### Suites

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ci/suites` | List suites |
| `POST` | `/ci/suites` | Create suite. Body: `{ name, description?, testIds? }` |
| `GET` | `/ci/suites/{id}` | Get suite with tests and run history |
| `POST` | `/ci/suites/{id}/tests` | Add tests. Body: `{ testIds: [...] }` |
| `DELETE` | `/ci/suites/{id}/tests` | Remove tests. Body: `{ testIds: [...] }` |
| `POST` | `/ci/suites/{id}/execute` | Run suite. Body: `{ baseUrl }` (required). Returns `{ suiteRunId, url }` |
| `GET` | `/ci/suite-runs/{suiteRunId}` | Get suite run status with per-test results |

## Key Concepts

- **Processing**: After creating a test, Diffie's AI generates Playwright code asynchronously (30-120 seconds). Poll `GET /ci/tests/{id}` and check `processingStatus`.
- **Running**: Executing a test runs the generated code against the target URL in a real browser (10-60 seconds). Poll `GET /ci/runs/{id}` and check `status`.
- **Suites**: Group multiple tests. Running a suite executes all tests in parallel. Poll `GET /ci/suite-runs/{id}`.
- **Secrets**: Encrypted credential storage. Account-level secrets are available to all tests. Reference by key name in descriptions — never hardcode credentials.
- **Polling pattern**: For any async operation, poll every 5 seconds. Terminal statuses are `processed`/`error` (for processing) and `passed`/`failed`/`cancelled` (for runs).

## Troubleshooting

- **401 from API**: Token is invalid or expired. Ask the user to create a new one at `https://app.diffie.ai/settings/api-tokens`.
- **Test stuck in processing**: `GET /ci/tests/{id}` — if `processingStatus` is `error`, use `POST /ci/tests/{id}/reprocess` with a `fixPrompt`.
- **Run failed**: `GET /ci/runs/{runId}` — check `errorMessage`, then `POST /ci/tests/{testId}/reprocess` if the generated code needs fixing.
- **LIMIT_EXCEEDED error (403)**: Account has hit test or run quota.
