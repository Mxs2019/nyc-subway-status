---
name: plan-issues
description: Plan and create new issues for the task tracking system. Use this skill when the user wants to plan new features, create issues, add tasks to the queue, or break down work into trackable issues.
---

# Plan Issues

Plan and create new issues for the task tracking system.

## Instructions

**⚠️ CRITICAL: NEVER UPDATE EXISTING ISSUES**

This skill is for **creating NEW issues only**. You must NEVER:
- Update an issue that is `in_progress` (someone is working on it)
- Update an issue that is `completed` (it's done)
- Update an issue in the backlog (`pending` status)

**Default behavior**: Always create a NEW issue. If work is related to an existing issue, create a follow-up issue instead.

**Only exception**: User EXPLICITLY requests "update issue 005" or similar. Even then, confirm before modifying.

---

You are helping the user plan new issues. Follow this workflow:

### Step 1: Understand the Request
The user will describe what they want to build at a high level. This could be a single feature or multiple related features.

### Step 2: Research (Codebase + Existing Issues)
Before asking questions, gather context from TWO sources:

**2a. Explore the codebase** to understand:
- Existing patterns and architecture
- Related code that might be affected
- Files that will likely need modification

Use the Explore agent to gather this context efficiently.

**2b. Review existing issues** by reading:
- `tasks/issues-to-complete.json` - all pending/in-progress issues
- The actual plan files in `tasks/issues/` for any related issues

**2c. Check for conflicts or overlaps:**
- Does this new work overlap with an existing issue?
- Would this change something another issue depends on?
- Are there issues that should block or be blocked by this?

**If conflicts found**: Present them to the user before proceeding:
```
⚠️ Potential conflict with existing issues:
- Issue 003 (add-user-profiles) also modifies src/lib/auth.ts
- This feature might need to wait for 002 (database-migration) to complete

How should we proceed?
```

### Step 3: Evaluate Task Scope
Before creating issues, assess whether the request should be a single issue or split into multiple smaller issues.

**Size indicators - consider splitting if ANY apply:**
- **6+ files** need modification
- **10+ implementation steps** required
- **Multiple distinct components** (e.g., backend API + frontend UI + database schema)
- **Clearly separable phases** (e.g., data layer, business logic, presentation)
- **Independent sub-features** that could be completed and tested separately

**Keep as single issue when:**
- 1-5 files modified
- Clear single responsibility
- Tightly coupled changes that can't work independently
- Simple feature with linear implementation

**Splitting guidelines:**
- Maximum 2-3 issues per split (don't over-fragment)
- Each sub-issue must be independently completable and testable
- Use `blocked_by` to express dependencies between split issues
- Keep related work together (don't split just to split)

**When unsure, ask the user:**
```
This task appears fairly large (affects ~8 files, spans backend + frontend + tests).
I could approach this in two ways:

1. **Single issue**: One comprehensive issue covering everything
2. **Split into 2-3 issues**:
   - 007-feature-backend: API and database layer
   - 008-feature-frontend: UI components (blocked by 007)
   - 009-feature-tests: Integration tests (blocked by 008)

Which approach would you prefer?
```

### Step 4: Plan Each Issue (or Group of Split Issues)
For each issue (or group of related issues if splitting) the user wants to create:

1. **Ask at least 2 clarifying questions** before writing any plan. Use the `AskUserQuestion` tool for questions with discrete options (e.g., "which approach?", "include X or not?"). Free-form questions (e.g., "what should the behavior be?") can be asked as regular text.

   Focus on non-obvious decisions that affect implementation:
   - What's explicitly OUT of scope?
   - What happens when things fail? (retry, show error, fail silently?)
   - Edge cases: empty states, concurrent access, partial failures?
   - How does this interact with existing features?

   **Tips for good questions**:
   - Frame as decisions with concrete options and use `AskUserQuestion` for those
   - Ask 2-4 questions per round, follow up as needed
   - Skip questions you can answer by reading the codebase
   - You MUST ask at least 2 questions total — do not skip this step even if the request seems clear

2. **Present a minimal confirmation** BEFORE creating any files:
   - 1 sentence high-level summary
   - Bullet list of ONLY non-obvious design decisions (things user might disagree with)
   - Keep it short - sacrifice grammar for clarity
   - Don't show: file lists, obvious steps, full implementation details
   - Ask: "Good?" or similar brief confirmation
   - **IMPORTANT: Wait for user confirmation before proceeding**
   - User can ask follow-up questions if they want more detail

3. **Only after user confirms**, write the plan file at `tasks/issues/{id}-{slug}.md`. The plan should be detailed enough that implementation can proceed without further clarification:

   ```markdown
   # Issue {ID}: {Title}

   ## Summary
   1-2 sentence description of what this issue accomplishes.

   ## Context
   Why this is needed. Reference existing code patterns or related issues.

   ## Scope
   **In scope:**
   - Specific thing 1
   - Specific thing 2

   **Out of scope:**
   - Thing explicitly not included
   - Future enhancement deferred

   ## Key Decisions
   - **Decision 1**: What was decided and why
   - **Error handling**: How failures are handled
   - **Edge case X**: How it's handled

   ## Implementation Plan
   Detailed steps with specific file paths and what changes in each:

   1. **Create/modify `path/to/file.ts`**
      - Add function X that does Y
      - Export it from the module

   2. **Update `path/to/other.ts`**
      - Import and call the new function
      - Handle the response by doing Z

   3. **Add tests in `path/to/file.test.ts`**
      - Test case for happy path
      - Test case for error handling

   ## Files to Modify
   - `path/to/file1.ts` - (new) description
   - `path/to/file2.ts` - (modify) description
   - `path/to/file3.ts` - (modify) description

   ## Acceptance Criteria
   - [ ] Specific testable criterion 1
   - [ ] Specific testable criterion 2
   - [ ] Error case is handled correctly
   ```

4. **Register the issue** using the CLI:
   ```bash
   issues new --name "{slug}" [--blocked-by {id}]
   ```
   This creates the issue with proper UTC timestamps and returns the assigned ID.

   To see current issues during planning:
   ```bash
   issues list --json
   ```

5. **Repeat** for each additional issue

6. **Commit the created files** after all issues are created:
   - Stage the new issue files: `git add tasks/issues/{id}-{slug}.md`
   - Stage the updated JSON: `git add tasks/issues-to-complete.json`
   - Commit with message format: `Add issue(s): {list of issue names}`
   - Example: `Add issue(s): 001-user-signup, 002-user-login`

### ID and Slug Format
- ID: Zero-padded 3-digit number (e.g., "001", "002", "023")
- Slug: Lowercase, hyphen-separated description (e.g., "add-dark-mode", "fix-login-bug")
- Filename: `{id}-{slug}.md` (e.g., "001-add-dark-mode.md")

### Example Session
```
User: I want to add user authentication with login and signup flows

Agent: [Explores codebase with Explore agent]
Agent: [Reads tasks/issues-to-complete.json and existing issue files]

Agent: I've reviewed the codebase and existing issues. Found:
- Codebase uses React + Express, no existing auth
- Existing issue 001 (add-database) is in progress - we'll need to wait for that
- No conflicts with other planned work

I'll plan this as two issues. Signup will be blocked by the database issue.

[Uses AskUserQuestion]
1. "Auth method" - Email/password, Social login, Both
2. "Email verification" - Required before access, Optional, Not needed

User: Email/password, required before access

[Uses AskUserQuestion - follow-up]
1. "If verification email fails to send?" - Block signup, Create account and retry later
2. "Existing email signup?" - Show "email taken", Send password reset instead

User: Create account and retry, show "email taken"

Agent: Email/password signup with email verification required.

Non-obvious decisions:
- SMTP fails → create account anyway, queue retry
- Duplicate email → show error (not password reset link)
- Unverified users blocked from all routes

Good?

User: yes

Agent: [Creates 002-user-signup.md with blocked_by: "001"]
Agent: [Updates issues-to-complete.json]

Now for login. [Continues with similar flow...]
```

### Example: Keeping as Single Issue (Appropriate Size)
```
User: Add a dark mode toggle to the settings page

Agent: [Explores codebase, reviews existing issues]

I've reviewed the codebase. This is a focused feature:
- Adds a toggle component to settings
- Creates theme context for state
- Updates CSS variables

This affects about 3-4 files with a clear single responsibility.
I'll plan this as a single issue.

[Proceeds with clarifying questions and creates one issue]
```

### Example: Splitting a Large Task
```
User: Add user authentication with signup, login, password reset, and OAuth

Agent: [Explores codebase, reviews existing issues]

This is a substantial feature spanning multiple components:
- Database schema for users and sessions (~3 files)
- Backend API endpoints (~4 files)
- Frontend forms and state (~6 files)
- Email service for verification/reset (~2 files)
- OAuth integration (~3 files)

That's roughly 18 files across 4-5 distinct subsystems.

I'd recommend splitting this into 2-3 focused issues:

1. **007-auth-core**: Signup + login (database, API, basic forms)
2. **008-password-reset**: Password reset flow (blocked by 007)
3. **009-oauth-integration**: OAuth providers (blocked by 007)

Each can be completed and tested independently.
Would you like me to split it this way, or keep it as one large issue?

User: split please

Agent: Great! Let me plan each issue, starting with auth-core...

[Creates three issues with appropriate blocked_by relationships]
```

### Example: Asking When Unsure
```
User: Add analytics tracking to the application

Agent: [Explores codebase, reviews existing issues]

I've reviewed the request. This could go either way:
- Core analytics: ~4-5 files (tracking service, event definitions)
- UI dashboard: ~3-4 files (charts, analytics page)
- Total: ~8-9 files

I could approach this as:
1. **Single issue**: Everything together (simpler, but larger)
2. **Two issues**:
   - 007-analytics-core: Tracking service and events
   - 008-analytics-dashboard: UI for viewing data (blocked by 007)

The core tracking could be useful immediately even without the dashboard.
Which approach would you prefer?

User: Two issues makes sense

Agent: [Plans and creates two issues with dependency]
```
