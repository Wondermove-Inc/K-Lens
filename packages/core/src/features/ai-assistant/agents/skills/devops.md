---
id: devops
name: DevOps Operations
description: Safe infrastructure operations with rollback plans
category: infrastructure
type: react
---

## Command: /devops
You are executing the "/devops" command.

### Purpose:
Execute infrastructure operations safely with impact analysis, approval gates, rollback plans, and post-execution validation.

### When to Apply:
- User wants to apply, update, or delete Kubernetes resources
- Deploying new versions, scaling workloads, or modifying configs
- Infrastructure changes that could affect running services
- User says "deploy", "apply", "rollout", "scale", "update"

### Why This Matters:
Production infrastructure changes without safety checks cause outages. Every change needs: syntax verification, impact analysis, a rollback plan, and post-execution health checks. This skill enforces the "measure twice, cut once" principle — catching misconfigurations before they reach the cluster.

### Workflow Steps:
Step 1 - Assess: Parse the operation, inventory affected resources, verify syntax
Step 2 - Plan: Analyze impact, identify blast radius, create rollback plan
Step 3 - Approve: Present plan and require explicit approval for production changes
Step 4 - Execute: Apply changes with monitoring
Step 5 - Validate: Verify changes, check health, confirm rollback is ready

### Required Actions:
- Verify YAML syntax and Kubernetes best practices
- Analyze impact on dependent services (ingress, endpoints, HPA)
- Generate specific rollback commands
- Require approval for production namespace changes
- Validate health after execution

### Safety Checks:
Before execution, verify ALL of these:

| Check | What | Why |
|-------|------|-----|
| YAML Syntax | Valid YAML, correct indentation | Prevents parse errors |
| API Version | Non-deprecated apiVersion | Prevents future breakage |
| Resource Requests | CPU/Memory requests set | Prevents scheduling issues |
| Probe Config | Liveness/Readiness probes defined | Prevents undetected failures |
| PDB Exists | PodDisruptionBudget for critical workloads | Prevents full outage during drain |
| Image Tag | Not using `:latest` | Prevents unpredictable deployments |
| Namespace | Correct target namespace | Prevents accidental cross-env changes |

### Decision Points:
- If `--assess` → inventory only, no execution. Show current state and health
- If `--deploy` → full deployment pipeline with approval gate
- If `--optimize` → analyze for cost/performance improvements, suggest changes
- If `--dry-run` → generate execution plan without applying
- If target namespace is `production`, `prod`, or `kube-system` → ALWAYS require approval
- If operation is `delete` → require explicit confirmation with resource name echo
- If YAML has no resource limits → warn but don't block

### Rollback Plan Generation:
For every change, provide specific rollback commands:
- Deployment update → `kubectl rollout undo deployment/[name]`
- ConfigMap change → restore from pre-change backup
- Scale operation → `kubectl scale --replicas=[original] deployment/[name]`
- Resource deletion → provide the full YAML to re-create

### Output Format:
## DevOps: [Operation Type]

### Request Analysis
| Item | Value |
|------|-------|
| Operation | [create/update/delete/scale] |
| Target | [resource type and name] |
| Namespace | [target namespace] |
| Risk Level | [Low/Medium/High/Critical] |

### Pre-flight Checks
| Check | Status | Details |
|-------|--------|---------|
| YAML Syntax | ✅/❌ | ... |
| API Version | ✅/❌ | ... |
| Resource Limits | ✅/⚠️ | ... |

### Impact Analysis
| Resource | Current | After | Impact |
|----------|---------|-------|--------|
| Replicas | 3 | 5 | 2 additional pods |

### Affected Services
Services, Ingress rules, and expected downtime.

### Execution Plan
1. [step with specific command]
2. [step with specific command]

### Rollback Plan
If issues detected after execution:
```
[specific rollback commands]
```

### Approval Required (if production)
⚠️ This changes [namespace]. Execute? (yes/no)

### Boundary:
This skill does NOT cover:
- Helm chart management (use helm CLI directly)
- CI/CD pipeline configuration (use pipeline tools)
- Cloud provider resource management (use cloud console/CLI)
- Database migrations (requires application-specific tooling)

### Available Options:
- --assess: Assess infrastructure state and generate report
- --deploy: Execute safe deployment procedure with approval gates
- --optimize: Cost and performance optimization analysis
- --troubleshoot: Log-based troubleshooting
- --dry-run: Generate plan without execution (default: false)

### Usage Examples:
- /devops --assess
- /devops kubectl apply -f deployment.yaml
- /devops --deploy release/v2.1.0
- /devops kubectl scale deployment/api --replicas=5

### Related Commands:
After completing this task, you may suggest: /diagnose, /finops, /solve

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
