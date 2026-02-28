---
name: complete-next-issue
description: Implement the next unblocked issue from the task queue. Use this skill when the user wants to work on the next available task, complete an issue, or asks to implement something from the issue queue.
---

# Complete Next Issue

Implement an issue from the task queue.

## Instructions

### Step 1: Parse the Issue from the Prompt
The issue ID and name are provided in the prompt (e.g., "Complete issue 015: improve-analytics").
1. Extract the issue ID and name from the prompt
2. **Mark issue as started** by running:
   ```bash
   issues {id} started
   ```
   This sets the status to "in_progress" with a proper UTC timestamp.
3. If no issue ID was provided in the prompt, inform the user: "No issue ID provided. Use `issues list` to see available issues."

### Step 2: Read the Plan
1. Construct the filename: `tasks/issues/{id}-{name}.md`
2. Read the plan file to understand what needs to be implemented
3. Review the Implementation Plan and Acceptance Criteria

### Step 3: Implement the Issue
1. Follow the implementation plan step by step
2. Write the necessary code changes
3. **Write tests** for new functionality
4. Ensure all acceptance criteria are met

### Step 4: Verify Tests Pass
**REQUIRED before completing:**
1. Run the test suite (customize this command for your project - default: `pnpm test`)
2. **ALL tests must pass** - both existing tests and new tests you wrote
3. If any tests fail, fix them before proceeding
4. Do NOT skip this step - a passing test suite is mandatory for completion

### Step 5: Complete the Issue
After successful implementation:

1. **Mark issue as complete** by running:
   ```bash
   issues {id} complete --result "Brief summary of changes made"
   ```
   This command:
   - Moves the issue to `completed-issues.json` with proper timestamps
   - Removes it from `issues-to-complete.json`
   - Unblocks any dependent issues
   - Reports which issues were unblocked

2. **Commit the changes** with message:
   ```
   Completed issue {id}: {name}

   Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   ```

### Step 6: Update CLAUDE.md (If Applicable)
After completing the implementation, consider whether CLAUDE.md should be updated:

1. **Update if any of the following occurred:**
   - App architecture evolved (new patterns, folder structures, or conventions)
   - You discovered something that would make future work easier
   - New dependencies or tools were added that affect development workflow
   - You learned something important about the codebase that isn't documented

2. **What to add:**
   - New architectural patterns or conventions
   - Useful context about how components interact
   - Tips or gotchas that would help with future implementations
   - Updates to the project structure section if folders were added

3. **Keep CLAUDE.md concise** - only add information that provides lasting value

### Step 7: Report Completion
Inform the user:
- Which issue was completed
- Summary of changes made
- Which issues (if any) are now unblocked
- How many issues remain in the queue

### Example Flow
```
Agent: Received request to complete issue 001: add-dark-mode
Agent: Running `issues 001 started` to mark as in progress...
Agent: Reading plan from tasks/issues/001-add-dark-mode.md...

[Implements the feature]

Agent: Tests passing. Running `issues 001 complete --result "Added ThemeManager and dark mode palette"`
Agent: Output: Completed issue 001: add-dark-mode. Unblocked: 002
Agent: Committing changes...

Completed: 001-add-dark-mode
   - Added ThemeManager class
   - Updated AppDelegate with theme support
   - Created dark mode color palette

Now unblocked:
   - 002-theme-preferences (was blocked by 001)

Remaining issues: 3
```

### Error Handling
- If the plan file doesn't exist, inform the user and skip the issue
- If implementation fails, do NOT mark as complete - inform the user of what went wrong
- **If tests fail, do NOT commit** - fix the failing tests first, then re-run the full suite
- Never mark an issue complete with failing tests - this is a hard requirement
