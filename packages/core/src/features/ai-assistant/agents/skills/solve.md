---
id: solve
name: Problem Solve
description: Systematic problem solving with root cause analysis
category: problem-solving
type: react
---

## Command: /solve
You are executing the "/solve" command.

### Purpose:
Systematically analyze problems, find root cause, implement fix, and generate postmortem with prevention measures.

### When to Apply:
- User reports a specific error, bug, or unexpected behavior
- Application returning error codes (500, 503, timeout)
- Performance degradation or intermittent failures
- User says "fix", "debug", "why is X happening", "X is broken"

### Why This Matters:
Ad-hoc debugging wastes time and misses root causes. A systematic approach (define → investigate → solve → document) ensures the actual root cause is found, not just symptoms patched. The postmortem prevents recurrence — the most expensive bugs are the ones you fix twice.

### Workflow Steps:
Step 1 - Define: Identify symptoms, impact scope, and reproduction conditions
Step 2 - Investigate: Gather evidence (logs, events, metrics, code, git history)
Step 3 - Analyze: Apply appropriate analysis method based on problem type
Step 4 - Solve: Implement fix with before/after verification
Step 5 - Document: Generate postmortem with prevention measures

### Required Actions:
- Gather context (logs, code, git history, events, metrics)
- Apply appropriate analysis method (see Decision Points)
- Implement fix with verification (tests, manual check)
- Generate postmortem with prevention measures

### Decision Points — Analysis Method Selection:
Choose method based on problem characteristics:

- **5 Whys** (`--5whys`): Best for straightforward failures with clear symptoms. Ask "Why?" iteratively until root cause is found. Use when: single error, clear reproduction steps.
- **RCA / Ishikawa** (`--rca`): Best for complex issues with multiple potential causes. Map causes to categories (People, Process, Technology, Environment). Use when: intermittent failures, multiple factors involved.
- **Hypothesis-based** (`--hypothesis`): Best for hard-to-reproduce issues. Form hypothesis → design test → validate. Use when: "works on my machine", environment-dependent issues.
- **Binary Search** (`--binary`): Best for regressions. Use git bisect approach to find the commit that introduced the issue. Use when: "it worked before", "broke after last deploy".

If no method specified, auto-select based on:
- Has reproduction steps → 5 Whys
- Intermittent/complex → RCA
- "It worked before" → Binary Search
- "Only in production" → Hypothesis

### Evidence Gathering Checklist:
Before analysis, collect as many as applicable:
- [ ] Error message / stack trace
- [ ] Recent logs (`/logs` or application logs)
- [ ] Recent events (`/events --type Warning`)
- [ ] Resource metrics (`/metrics` if performance issue)
- [ ] Recent code changes (`git log --oneline -10`)
- [ ] Configuration changes (env vars, configmaps, secrets)
- [ ] Infrastructure changes (scaling, node changes, network)

### Output Format:
## Problem Solving Report

### Problem Definition
| Item | Description |
|------|-------------|
| Symptom | [what the user observed] |
| Impact | [affected users/services/scope] |
| Severity | [Critical/High/Medium/Low] |
| First Observed | [timestamp or "user reported"] |
| Reproducible | [always/intermittent/unknown] |

### Evidence Collected
Summary of logs, events, metrics, code reviewed.

### Analysis ([method used])
Detailed reasoning chain showing how root cause was identified.

**Root Cause**: [root cause with specific file:line if applicable]

### Solution
Code/config fix with before/after comparison.

### Verification
How the fix was verified (test results, manual check).

### Prevention Measures
| Priority | Action | Type |
|----------|--------|------|
| P0 | [immediate fix] | Reactive |
| P1 | [monitoring/alert] | Detective |
| P2 | [architectural improvement] | Preventive |

### Boundary:
This skill does NOT cover:
- Performance optimization without a specific problem (use `/metrics` or `/finops`)
- General code review (use code review tools)
- Infrastructure provisioning (use `/devops`)

### Available Options:
- --5whys: Analyze root cause by asking 'Why?' 5 times
- --rca: Root Cause Analysis with Ishikawa diagram and timeline
- --hypothesis: Hypothesis-based debugging (Scientific Method)
- --binary: Binary Search debugging (git bisect style)

### Usage Examples:
- /solve Login returns 500 error
- /solve API response delay --hypothesis
- /solve Pods keep restarting after deploy --binary
- /solve Intermittent 503 on checkout --rca

### Related Commands:
After completing this task, you may suggest: /diagnose, /logs, /research

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
