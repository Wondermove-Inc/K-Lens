---
id: services
name: Service List
description: List services with endpoint status
category: kubernetes
type: react
---

## Command: /services
You are executing the "/services" command.

### Purpose:
Display Service list with endpoint health, connectivity analysis, and actionable recommendations.

### Workflow Steps:
Step 1 - Query: Get services and endpoints from cluster using kubectl
Step 2 - Classify: Categorize each service by connectivity status
Step 3 - Detect Issues: Identify services with no endpoints, pending LBs, and port mismatches
Step 4 - Report: Format output with type icons and next-step recommendations

### Required Actions:
- Query services with kubectl (`kubectl get svc -o wide`)
- Query endpoints for each service (`kubectl get endpoints`)
- Classify each service into health tiers (see Status Classification below)
- Suggest specific next commands for problematic services

### Status Classification:
Classify services using these rules:

| Icon | Type/Status | Condition |
|------|-------------|-----------|
| 🌐 | LoadBalancer (healthy) | External IP assigned, endpoints > 0 |
| ⏳ | LoadBalancer (pending) | External IP = `<pending>`, waiting for cloud provisioning |
| 🔌 | NodePort | Node port allocated, endpoints > 0 |
| 🏠 | ClusterIP | Internal only, endpoints > 0 |
| 🔗 | ExternalName | DNS CNAME redirect (no endpoints expected) |
| 🔴 | No Endpoints | Any type with 0 endpoints (broken service) |
| ⚠️ | Partial | Some endpoints not ready |

### Common Issues:
When you detect these patterns, include the cause and recommended action:

- **No Endpoints**: Service selector matches no pods → label mismatch or pods not running. Suggest: check selector with `kubectl get svc [name] -o yaml` then `/pods -l [selector]`
- **LoadBalancer Pending**: Cloud controller hasn't provisioned IP → check cloud quotas, service annotations, or if running on bare-metal without MetalLB. Common in local clusters (minikube, kind)
- **Port Mismatch**: Service targetPort doesn't match container port → pods receive traffic but app isn't listening. Suggest: `kubectl describe svc [name]` to verify port mapping
- **Stale Endpoints**: Endpoints exist but pods are in CrashLoopBackOff → traffic reaches unhealthy pods. Suggest: `/pods -l [selector]` to check pod health
- **ExternalName without target**: CNAME service with no externalName set → DNS resolution fails
- **Multiple Ports**: Service exposes multiple ports — ensure each has a unique name (required by Istio/mesh)

### Endpoint Health Analysis:
- Compare endpoint count vs pod count for the selector
- If endpoints < running pods: some pods failing readiness probes
- If endpoints = 0 but pods exist: selector mismatch (most common cause)
- If no pods match selector: pods may be in different namespace or have wrong labels

### Output Format:
## Service List: [namespace]

### Type Summary
| Type | Count |
|------|-------|
| 🌐 LoadBalancer | N |
| 🔌 NodePort | N |
| 🏠 ClusterIP | N |
| 🔗 ExternalName | N |

### Service List
| Type | NAME | CLUSTER-IP | EXTERNAL-IP | PORT(S) | ENDPOINTS |
|------|------|------------|-------------|---------|-----------|
| 🌐 | api-gateway | 10.96.0.10 | 203.0.113.5 | 443/TCP | 3 |
| 🔴 | orphan-svc | 10.96.0.20 | - | 8080/TCP | 0 |

### Attention Required
For each problematic service, show:
- Service name and issue type
- Likely cause (from Common Issues above)
- Recommended command (e.g., `/pods -l app=orphan-svc`, `/diagnose service/orphan-svc`)

### Available Options:
- --namespace: Target specific namespace
- --all-namespaces: Query all namespaces (default: false)
- --selector: Filter by label selector

### Usage Examples:
- /services
- /services -n kube-system
- /services -A
- /services -l tier=frontend

### Related Commands:
After completing this task, you may suggest: /pods, /diagnose, /events

### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.

Follow these guidelines while responding to the user's request.
