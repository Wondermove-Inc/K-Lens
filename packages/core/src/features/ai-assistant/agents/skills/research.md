---
id: research
name: Research
description: Systematic technical research with key insights
category: research
type: react
---

## Command: /research
You are executing the "/research" command.

### Purpose:
Conduct systematic technical research with multi-angle search, source evaluation, and structured findings report.

### When to Apply:
- User wants to understand a technology, pattern, or best practice
- Comparing alternatives or making technology decisions
- Learning about a new concept, framework, or tool
- User says "research", "compare", "what is", "best practice", "how does X work"

### Why This Matters:
Ad-hoc Googling produces shallow, potentially outdated answers. Systematic research with multiple search angles, source quality evaluation, and structured output ensures decisions are based on comprehensive, verified information — not the first Stack Overflow answer.

### Workflow Steps:
Step 1 - Scope: Define research question, identify key angles to investigate
Step 2 - Search: Multi-angle web search (3-10 queries depending on depth)
Step 3 - Evaluate: Assess source quality (official docs > blog posts > forums)
Step 4 - Synthesize: Extract key insights, identify consensus and controversies
Step 5 - Report: Generate structured report with sources and recommendations

### Required Actions:
- Define clear research question and sub-questions
- Search from multiple angles (definition, pros/cons, alternatives, best practices, gotchas)
- Prioritize sources: official documentation > reputable tech blogs > community posts
- Note publication dates — flag information older than 2 years as potentially outdated
- Generate actionable recommendations based on findings

### Search Strategy:
| Angle | Query Pattern | Purpose |
|-------|--------------|---------|
| Definition | "what is [topic]" | Core understanding |
| Best Practices | "[topic] best practices [year]" | Current recommendations |
| Comparison | "[topic] vs [alternative]" | Decision making |
| Gotchas | "[topic] common mistakes pitfalls" | Risk awareness |
| Implementation | "[topic] tutorial example" | Practical guidance |
| Production | "[topic] production experience" | Real-world insights |

### Decision Points:
- If `--quick` → 3 searches, summary only, no alternatives comparison
- If `--deep` → 10 searches, full report with all sections
- If `--compare` → focus on alternatives comparison with decision matrix
- If `--implementation` → include code examples and step-by-step guide
- If topic is Kubernetes-related → include Kubernetes-specific context and tools
- If topic has major version changes → note version differences and migration paths

### Source Quality Scoring:
| Score | Source Type | Trust Level |
|-------|-----------|-------------|
| ⭐⭐⭐ | Official documentation, RFCs, specification | High — authoritative |
| ⭐⭐ | Major tech blogs (engineering blogs from known companies) | Medium-High |
| ⭐ | Community posts, tutorials, Stack Overflow | Medium — verify claims |
| ⚠️ | Undated posts, personal blogs, AI-generated content | Low — cross-reference |

### Output Format:
## Research Report: [topic]

### Key Definition
Concise, accurate definition of the topic (2-3 sentences).

### Key Findings
Numbered list of the most important insights discovered.

### Best Practices
Numbered list of recommended practices with brief rationale.

### Pros and Cons
| Pros | Cons |
|------|------|
| [advantage with context] | [disadvantage with context] |

### Alternatives Comparison (if --compare or relevant)
| Solution | Complexity | Scale Fit | Community | Maturity |
|----------|------------|-----------|-----------|----------|

### Implementation Guide (if --implementation)
Step-by-step guide with code examples where applicable.

### Gotchas & Common Mistakes
Numbered list of things to watch out for.

### Recommendations
Prioritized recommendations with rationale.

### Sources
| # | Title | URL | Quality | Date |
|---|-------|-----|---------|------|

### Boundary:
This skill does NOT cover:
- Generating production-ready code (use coding tools)
- Making architectural decisions without user context
- Conducting security audits (use security-specific tools)
- Replacing hands-on proof-of-concept work

### Available Options:
- --quick: Quick research (3 searches, summary only)
- --deep: Deep research (10 searches, full report)
- --compare: Include alternative comparison with decision matrix
- --implementation: Include implementation guide with code examples

### Usage Examples:
- /research OAuth 2.0
- /research Kubernetes HPA --quick
- /research Clean Architecture --deep
- /research Redis vs Memcached --compare
- /research gRPC getting started --implementation

### Related Commands:
After completing this task, you may suggest: /solve, /devops

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
