---
id: diagnose
name: Resource Diagnose
description: "Diagnose any situation in Kubernetes where things are not working as expected. MUST USE when: ① Explicit failures — error, crash, restart, deploy failure, CrashLoopBackOff, OOMKilled, Pending, Evicted, Terminating, NotReady, ImagePullBackOff, Failed ② Implicit anomalies — service not responding, no traffic, slow response, intermittent failures, deployment not reflected, scaling not working, connection refused ③ Compound/cascading failures — multiple pods affected simultaneously, node and pod issues together, problems after deployment, time-specific patterns. Handles single symptoms, compound causes, undefined patterns, performance degradation, and intermittent errors. DO NOT USE for: simple resource listing, new resource creation, cluster inventory reports."
category: diagnostics
type: react
---

## When to Apply

Apply this skill whenever the user reports **anything not working as expected** in a Kubernetes environment.

### Explicit Failure Expressions
Error, crash, failure, restart, deploy failed, rollback, broken, down, dead

### Status Code Mentions
CrashLoopBackOff, OOMKilled, Pending, Evicted, Terminating, NotReady, ImagePullBackOff, Failed, Error, Unknown

### Implicit Anomaly Expressions (Key)
"Service is down", "not responding", "got slow", "intermittent failures", "traffic not flowing",
"deployment not reflected", "scaling not working", "logs not showing", "connection refused",
"something is wrong", "not sure what happened"

### Compound Failure Expressions
"Multiple pods at the same time", "node issues and pods too", "started after deployment", "only at certain times"

**DO NOT USE**: Simple resource listing, new resource creation, cluster inventory reports

---

## Why This Matters

Real characteristics of Kubernetes failures:
- **80% have compound causes**: Not a single component issue — Node → Scheduler → Pod → Container → App layers cascade
- **20% are undefined patterns**: Performance degradation, intermittent errors, config drift without known status codes
- **Problems often come without the word "failure"**: Users describe symptoms, not technical terms

This skill follows the flow: **Symptom → Layer decomposition → Cross-analysis → Root cause → Resolution** to handle any pattern.

---

## Steps

### Phase 0 — Problem Framing

Classify user input into 3 categories to determine diagnosis strategy:

```
A. Clear single symptom → Go directly to Phase 2 status-specific diagnosis tree
B. Vague symptom → Phase 1 broad scan to collect anomaly signals
C. Compound/cascading symptoms → Phase 1 broad scan + Phase 3 cross-layer analysis
```

**Compound failure criteria** (classify as C if any match):
- Spans multiple namespaces/nodes
- Occurred after specific time/event (deployment, scaling)
- Intermittent or non-reproducible symptoms
- Multiple resource types affected simultaneously

---

### Phase 1 — Broad State Scan

Must run for vague or compound failures. Useful for context even with clear single symptoms.

```bash
# 1. Query all non-running pods
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded

# 2. Collect Warning events (most recent)
kubectl get events -A --field-selector type=Warning --sort-by='.lastTimestamp' | tail -40

# 3. Check node status
kubectl get nodes -o wide

# 4. Recent change history (Deployment rollouts)
kubectl rollout history deployment --all-namespaces 2>/dev/null | head -30

# 5. Resource usage (if available)
kubectl top nodes
kubectl top pods -A --sort-by=memory | head -20
```

**Anomaly clustering** from scan results:
- Multiple pod issues on same node → Suspect node-level cause
- Multiple issues in same namespace → Suspect network/RBAC/ResourceQuota
- Concentrated at specific time → Suspect external event (deploy, traffic spike, cronjob)
- Cluster-wide impact → Suspect control plane or CNI

---

### Phase 2 — Status-Specific Diagnosis Tree

Use the corresponding tree when a known status code is present.

#### 🔴 CrashLoopBackOff
```bash
kubectl logs <pod> -n <ns> --tail=100
kubectl logs <pod> -n <ns> --previous
kubectl describe pod <pod> -n <ns>
```
Exit Code interpretation:
| Code | Meaning | Next Investigation |
|------|---------|-------------------|
| 1 | App error | Log stack trace |
| 137 | OOMKilled | Compare memory limit/usage |
| 139 | Segfault | Image version, libraries |
| 143 | SIGTERM unhandled | Implement graceful shutdown |
| 0 | Normal exit | Check restartPolicy |

#### 🟡 Pending
```bash
kubectl describe pod <pod> -n <ns>
kubectl describe nodes | grep -A5 "Allocated"
kubectl get pvc -n <ns>
kubectl get nodes -o json | jq '.items[].spec.taints'
```
Cause branching:
- `Insufficient cpu/memory` → Node resource shortage or excessive requests
- `no nodes match pod topology` → nodeSelector/affinity mismatch
- `had untolerated taint` → Missing toleration
- `pod has unbound PVC` → PVC/StorageClass issue

#### 🔴 OOMKilled
```bash
kubectl top pod <pod> -n <ns>
kubectl describe pod <pod> -n <ns>
kubectl top nodes
```

#### 🟠 ImagePullBackOff / ErrImagePull
```bash
kubectl describe pod <pod> -n <ns>
kubectl get secret -n <ns> | grep docker
```

#### 🔴 Evicted
```bash
kubectl describe pod <pod> -n <ns>
kubectl describe node <node>
kubectl top node
kubectl delete pods --field-selector=status.phase=Failed -n <ns>
```

#### 🟡 Terminating (stuck)
```bash
kubectl get pod <pod> -n <ns> -o json | jq '.metadata.finalizers'
kubectl patch pod <pod> -n <ns> -p '{"metadata":{"finalizers":[]}}' --type=merge
kubectl delete pod <pod> -n <ns> --grace-period=0 --force
```

#### 🔴 Node NotReady
```bash
kubectl describe node <node>
kubectl get pods -n kube-system --field-selector spec.nodeName=<node>
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
```

#### 🟠 Service Unreachable / No Response
```bash
kubectl get endpoints <svc> -n <ns>
kubectl get svc <svc> -n <ns> -o yaml
kubectl get pods -n <ns> -l <selector>
kubectl get networkpolicy -n <ns>
kubectl exec <pod> -- nslookup <svc>.<ns>.svc.cluster.local
```

#### 🟡 PVC Pending
```bash
kubectl describe pvc <pvc> -n <ns>
kubectl get storageclass
kubectl get pv
```

#### 🔴 Probe Failure (Liveness / Readiness / Startup)
```bash
kubectl describe pod <pod> -n <ns>
kubectl exec <pod> -n <ns> -- curl -s http://localhost:<port><path>
```

---

### Phase 3 — Undefined Pattern & Compound Failure Analysis

**Must run this phase when no known status code exists, or symptoms are compound.**

#### 3-1. Layer-by-Layer Independent Diagnosis

Decompose Kubernetes into 5 layers and diagnose each independently:

```
Layer 5: Application   App logic, config, dependent services
Layer 4: Container      Image, env vars, resource limits
Layer 3: Pod            Scheduling, probes, lifecycle
Layer 2: Node           Kubelet, resources, kernel
Layer 1: Control Plane  API server, etcd, scheduler, CNI
```

After collecting anomalies from each layer, **cross-analyze**:
- Anomalies in multiple layers → Upper layer (node/control plane) likely root cause
- Anomaly in single layer only → Focus analysis on that layer

#### 3-2. Timeline Reconstruction

```bash
kubectl get events -n <ns> --sort-by='.lastTimestamp'
kubectl rollout history deployment/<name> -n <ns>
kubectl get pod <pod> -n <ns> -o json | jq '.status.containerStatuses[].restartCount'
```

Find **inflection points** in timeline:
- Right after deployment/scaling → Change content is the cause
- Periodic pattern → CronJob, HPA, external traffic
- Gradual degradation → Resource leak, disk growth

#### 3-3. Hypothesis-Driven Verification

```
Form hypothesis → Execute verification command → Interpret result → Accept/reject hypothesis → Repeat
```

#### 3-4. Performance Degradation / Intermittent Error Diagnosis

```bash
kubectl get hpa -n <ns>
kubectl describe hpa <name> -n <ns>
kubectl describe resourcequota -n <ns>
kubectl describe limitrange -n <ns>
kubectl get pods -n <ns> --sort-by='.status.containerStatuses[0].restartCount'
kubectl get events -n <ns> --field-selector reason=OOMKilling
kubectl get ingress -n <ns>
kubectl describe ingress <name> -n <ns>
```

---

### Phase 4 — Root Cause Confirmation

**Apply 5 Whys**:
```
Symptom: Service not responding
Why 1: Pod is Pending → Why?
Why 2: Node has insufficient resources → Why?
Why 3: Other pods consuming resources without limits → Why?
Why 4: LimitRange not configured → Why?
Why 5: Resource policies not established during initial cluster setup (Root Cause)
```

**For compound failures, express as causal chain**:
```
[Root Cause] → [Primary Impact] → [Secondary Impact] → [User-Perceived Symptom]
Example: Node disk pressure → Pod Eviction → Deployment replica shortage → Service response delay
```

---

### Phase 5 — Resolution

Provide 3 levels for each cause:

**① Immediate Fix (Quick Fix)** — Prioritize service recovery, note side effects
**② Permanent Fix** — Config/code changes to prevent recurrence
**③ Verification Method** — Commands to confirm resolution

> ⚠️ Destructive operations (drain, force delete, patch finalizer) must get user confirmation before execution

---

### Phase 6 — Prevention Recommendations

| Failure Type | Prevention Measures |
|-------------|-------------------|
| OOM / Resource shortage | Set Requests/Limits, VPA, LimitRange |
| Intermittent crashes | Tune Liveness/Readiness/Startup Probes |
| Single point of failure | Multi-replica + PodAntiAffinity + PDB |
| Scaling failure | HPA/KEDA config, ResourceQuota review |
| Node failure propagation | Taint/Toleration, node monitoring alerts |
| Post-deploy failure | RollingUpdate strategy, strengthen readinessProbe |
| Image issues | Pin tags (no :latest), image scanning |
| Network blocking | Document NetworkPolicy, periodic verification |
| Volume issues | Set StorageClass defaults, PVC monitoring |

---

## Output Format

```markdown
## 🔍 Diagnostic Report

### 1. Symptom Summary
| Item | Details |
|------|---------|
| Affected Resource | (Pod/Node/Service etc.) |
| Failure Type | (Single/Compound) |
| Occurrence Time | (Event timestamp) |
| Impact Scope | (Namespace/Node/Cluster-wide) |

### 2. Diagnosis Process
Layer-by-layer anomalies and collected evidence summary

### 3. Root Cause
- Single cause: Clear one-line summary
- Compound cause: Express as causal chain
  [Root Cause] → [Primary Impact] → [Secondary Impact] → [Symptom]

### 4. Immediate Fix
Step-by-step commands (note side effects)

### 5. Permanent Fix
Config changes or structural improvements

### 6. Verification
Post-fix confirmation commands

### 7. Prevention Recommendations
Priority-ordered prevention measures (High/Medium/Low)
```

---

## Boundary
- Focus on diagnosis and resolution guidance. Actual file modifications/code changes proceed after user approval
- Destructive operations (node drain, pod force delete) must get user confirmation before execution
- Cluster inventory reports use the `assessment` skill
- If information is insufficient, collect additional data first — never make unsupported guesses
- Even for undefined patterns, never say "I don't know" — pursue through hypothesis-driven verification
