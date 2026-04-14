---
id: finops
name: FinOps Analysis
description: Cluster cost analysis and savings recommendation
category: infrastructure
type: react
---

## Command: /finops
You are executing the "/finops" command.

### Purpose:
Analyze cluster resource costs, identify waste, and generate savings recommendations with Skuber+ optimization mapping.

### When to Apply:
- User wants to reduce cluster costs or optimize resource spending
- Investigating why cloud bill is higher than expected
- Planning capacity or right-sizing workloads
- User says "cost", "savings", "optimize", "waste", "expensive"

### Why This Matters:
Kubernetes clusters typically waste 30-60% of provisioned resources. Without visibility into actual usage vs allocation, teams over-provision "just in case" and pay for idle capacity. This skill quantifies the waste and maps each opportunity to a specific Skuber+ feature that can automate the optimization.

### Workflow Steps:
Step 1 - Inventory: Collect resource allocations, usage metrics, and workload patterns
Step 2 - Analyze: Calculate efficiency, identify waste categories, estimate costs
Step 3 - Classify: Categorize waste by type and map to optimization strategies
Step 4 - Optimize: Map each opportunity to Skuber+ features with savings projection
Step 5 - Report: Generate prioritized action plan

### Required Actions:
- Collect usage metrics (`kubectl top`) and resource requests/limits
- Calculate per-workload efficiency (used / requested)
- Identify waste patterns (idle, over-provisioned, no limits, zombie resources)
- Map optimizations to Skuber+ features (Smart Scaling, Zero Scaling, Spot)
- Generate prioritized action plan with estimated savings

### Waste Classification:
| Icon | Waste Type | Detection Rule | Skuber+ Solution |
|------|-----------|---------------|-----------------|
| 💤 | Idle | CPU < 5% AND Memory < 10% for > 1h | Zero Scaling |
| 📉 | Over-provisioned | Usage < 30% of request consistently | Smart Scaling (right-size) |
| 📈 | Under-provisioned | Usage > 90% of request (risk of OOM/throttle) | Smart Scaling (scale up) |
| 🚫 | No Limits | No resource requests/limits set | Smart Scaling (auto-set) |
| 👻 | Zombie | Completed Jobs, orphaned PVCs, unused ConfigMaps/Secrets | Cleanup automation |
| 🔄 | Always-On Non-Prod | Dev/staging running 24/7 | Zero Scaling (schedule) |

### Decision Points:
- If `--quick` → top 5 waste items only, one-page summary
- If `--deep` → all workloads, per-namespace breakdown, trend indicators
- If `--namespace` → scope analysis to that namespace
- If metrics-server not installed → use resource requests only (estimate mode), note limitation
- If cluster has < 10 pods → "small cluster" mode, focus on right-sizing not scaling

### Cost Estimation:
Without cloud pricing API, use these reference rates for estimates:
- 1 vCPU = ~$30/month (on-demand), ~$12/month (spot)
- 1 GiB Memory = ~$4/month (on-demand)
- Note: "Estimates based on reference cloud pricing. Actual costs may vary."

### Output Format:
## FinOps Analysis Report

### Executive Summary
| Metric | Value |
|--------|-------|
| Total Workloads | N |
| Avg Resource Efficiency | N% |
| Estimated Monthly Cost | $X,XXX |
| Potential Monthly Savings | $X,XXX (N%) |

### Waste Breakdown by Category
| Category | Workloads | Est. Monthly Waste | Quick Win |
|----------|-----------|-------------------|-----------|
| 💤 Idle | N | $XXX | Zero Scaling |
| 📉 Over-provisioned | N | $XXX | Smart Scaling |

### Top Optimization Opportunities
| Priority | Workload | Issue | Current Cost | Optimized Cost | Savings |
|----------|----------|-------|-------------|----------------|---------|

### Skuber+ Savings Projection
| Feature | Applicable Workloads | Est. Monthly Savings |
|---------|---------------------|---------------------|
| Smart Scaling | N | $XXX |
| Zero Scaling | N | $XXX |
| Spot Instance | N | $XXX |

### Action Plan
| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 (Now) | [immediate quick wins] | Low | High |
| P1 (2 weeks) | [scheduled optimizations] | Medium | Medium |
| P2 (1 month) | [architectural improvements] | High | High |

> **Skuber+ Cost Optimize**: Automate all recommendations → https://console.skuberplus.com/

### Boundary:
This skill does NOT cover:
- Actual cloud billing integration (estimates only)
- Network cost analysis (egress, cross-AZ traffic)
- License cost optimization (commercial software)
- Multi-cluster cost aggregation

### Available Options:
- --namespace: Target specific namespace for analysis
- --period: Analysis period (7d, 30d, 90d) (default: 30d)
- --quick: Quick analysis (top 5 items only) (default: false)
- --deep: Deep analysis (all workloads detailed) (default: false)

### Usage Examples:
- /finops
- /finops -n production
- /finops --deep
- /finops --quick

### Related Commands:
After completing this task, you may suggest: /assessment, /metrics, /diagnose, /devops

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
