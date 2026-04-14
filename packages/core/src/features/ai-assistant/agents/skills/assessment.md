---
id: assessment
name: Cluster Assessment
description: "Comprehensive Kubernetes cluster inventory and analysis report. MUST USE when: user requests cluster info, cluster status, cluster report, inventory, cluster summary, cluster analysis, full status overview. Covers: CSP/region/nodes/kernel/AMI/instance-types/spot/resource-usage/scaling(CA,Karpenter)/NodeGroup/KEDA/workload-types/per-resource-usage/CNI/service-mesh/permissions. DO NOT USE for: specific Pod debugging, simple resource listing, deployment operations."
category: infrastructure
type: react
---

## When to Apply
Use this skill whenever the user requests a full cluster status overview, inventory report, or cluster analysis.
Works on **all Kubernetes environments**: EKS, GKE, AKS, OKE (OCI), k3s, kind, Rancher, OpenShift, etc.

## Why This Matters
Without a cluster overview, operational risks (spot node ratio, resource shortage, missing autoscaler config) are invisible.
Simple kubectl queries alone cannot reveal CSP environment, autoscaler presence, service mesh setup, and other critical context.
This skill operates on the principle: **collect as much as possible within permission scope → explicitly mark items that cannot be collected**.

---

## Steps

### PHASE 1 — Cluster Basic Information

Execute the following **simultaneously** (parallel execution):

1. **Full node query** (JSON)
   - `kubectl get nodes -o json`
   - Extract:
     - Node name, status, role, kubelet version, OS, architecture, kernel version, containerRuntime
     - capacity (cpu/memory), allocatable
     - `spec.providerID` → CSP detection:
       | providerID prefix | CSP |
       |------------------|-----|
       | `aws://` | AWS EKS |
       | `azure://` | Azure AKS |
       | `gce://` | Google GKE |
       | `oci://` | Oracle OKE (OCI) |
       | `k3s://` | k3s (local/lightweight) |
       | `kind://` | kind (local dev) |
       | `vsphere://` | VMware vSphere |
       | `openstack://` | OpenStack |
       | None or other | On-premise / Unknown |
     - Region/AZ: `topology.kubernetes.io/region`, `topology.kubernetes.io/zone` labels
     - Instance type (CSP-specific label priority):
       - `node.kubernetes.io/instance-type` (universal standard)
       - `beta.kubernetes.io/instance-type` (legacy compat)
       - OCI specific: `oci.oraclecloud.com/fault-domain`, `oci.oraclecloud.com/node-shape`
     - AMI/Image:
       - EKS: `eks.amazonaws.com/nodegroup-image`, `alpha.eksctl.io/ami-id`
       - OKE: `oci.oraclecloud.com/node-image-id` (if label missing → N/A)
     - Spot/preemptible node detection (check all CSP labels):
       | CSP | Label/Method |
       |-----|-------------|
       | EKS | `eks.amazonaws.com/capacityType=SPOT` |
       | Karpenter | `karpenter.sh/capacity-type=spot` |
       | GKE | `cloud.google.com/gke-spot=true` |
       | AKS | `kubernetes.azure.com/scalesetpriority=spot` |
       | OKE | `oci.oraclecloud.com/capacity-type=preemptible` |
       | Universal | `node.kubernetes.io/lifecycle=spot` |
     - Fargate detection (EKS): `eks.amazonaws.com/compute-type=fargate` or providerID contains `fargate`
     - NodeGroup labels (CSP-specific):
       | CSP | Label |
       |-----|-------|
       | EKS Managed NG | `eks.amazonaws.com/nodegroup` |
       | EKS eksctl | `alpha.eksctl.io/nodegroup-name` |
       | Karpenter | `karpenter.sh/nodepool` |
       | GKE | `cloud.google.com/gke-nodepool` |
       | AKS | `agentpool` |
       | OKE | `oci.oraclecloud.com/node-pool-id`, `name` label, or `oke-pool-name` |
     - GKE Autopilot detection: `cloud.google.com/gke-autopilot=true` label
     - OKE Virtual Node detection: `node.kubernetes.io/instance-type=virtual-node` or providerID pattern

2. **Namespace list** query
   - `kubectl get namespaces`

3. **metrics-server resource usage** query
   - `kubectl top nodes` (on failure: record "metrics-server not installed or no permission")
   - `kubectl top pods -A` (on failure: record same)

4. **kubeconfig context info**
   - `kubectl config current-context`
   - `kubectl config view --minify`

### PHASE 2 — Scaling & Autoscaler Detection

Execute the following **simultaneously**:

5. **Cluster Autoscaler detection**
   - `kubectl get deployment -A --field-selector=metadata.name=cluster-autoscaler 2>/dev/null`
   - `kubectl get pods -A -l app=cluster-autoscaler 2>/dev/null`
   - `kubectl get pods -A -l app.kubernetes.io/name=cluster-autoscaler 2>/dev/null`
   - CA status ConfigMap: `kubectl get configmap -n kube-system cluster-autoscaler-status 2>/dev/null`
   - OKE CA: OKE uses console/OCI API-based Node Pool Autoscaling, so note separately if OKE environment even without CA pod

6. **Karpenter detection**
   - `kubectl get deployment -A 2>/dev/null | grep -i karpenter`
   - `kubectl get crd 2>/dev/null | grep karpenter`
   - NodePool: `kubectl get nodepools.karpenter.sh -A 2>/dev/null`
   - EC2NodeClass (EKS): `kubectl get ec2nodeclasses.karpenter.k8s.aws -A 2>/dev/null`
   - AzureNodeClass (AKS): `kubectl get azurenodeclasses.karpenter.azure.com -A 2>/dev/null`
   - OCI NodeClass (OKE): `kubectl get ocinodeclasses.karpenter.oci.oracle.com -A 2>/dev/null`

7. **KEDA detection**
   - `kubectl get deployment -A 2>/dev/null | grep -i keda`
   - `kubectl get crd 2>/dev/null | grep keda`
   - ScaledObject count: `kubectl get scaledobjects.keda.sh -A 2>/dev/null`
   - ScaledJob count: `kubectl get scaledjobs.keda.sh -A 2>/dev/null`

8. **HPA/VPA detection**
   - `kubectl get hpa -A 2>/dev/null`
   - `kubectl get vpa -A 2>/dev/null`

### PHASE 3 — Workload Inventory

Execute the following **simultaneously**:

9. **Full workload query by type**
   - Deployment: `kubectl get deployments -A`
   - StatefulSet: `kubectl get statefulsets -A`
   - DaemonSet: `kubectl get daemonsets -A`
   - Job: `kubectl get jobs -A`
   - CronJob: `kubectl get cronjobs -A`
   - All Pods: `kubectl get pods -A`
   - Argo Rollouts: `kubectl get rollouts.argoproj.io -A 2>/dev/null`
   - OpenShift DeploymentConfig: `kubectl get deploymentconfigs.apps.openshift.io -A 2>/dev/null`

10. **Per-resource usage** (requests/limits)
    - `kubectl get pods -A -o json` → Extract containers[].resources
    - Calculate per-namespace aggregate CPU/Memory requests & limits
    - Separately flag pods without requests (BestEffort QoS)

### PHASE 4 — Network & Service Mesh Detection

Execute the following **simultaneously**:

11. **CNI detection** (check in priority order)
    - `kubectl get pods -n kube-system -o wide 2>/dev/null`
    - `kubectl get daemonset -n kube-system 2>/dev/null`
    - `kubectl get configmap -n kube-system 2>/dev/null | grep -i cni`
    - Detection criteria:
      | CNI | Detection Method |
      |-----|-----------------|
      | Flannel | Image `flannel` or node annotation `flannel.alpha.coreos.com` |
      | Calico | Image `calico` or annotation `cni.projectcalico.org` |
      | Cilium | Image `cilium` or CRD `ciliumnetworkpolicies` |
      | Weave | Image `weave` |
      | AWS VPC CNI | DaemonSet `aws-node` in kube-system |
      | Azure CNI | DaemonSet `azure-cni` or image `azure-vnet` |
      | OCI VCN-Native CNI | DaemonSet `oci-native-cni` or image `oci-cni`, default CNI in OKE |
      | OCI Flannel (OKE) | OKE environment + Flannel image (one of OKE default options) |
      | GKE CNI | GKE environment + no separate CNI DaemonSet = default GKE CNI |
      | Antrea | Image `antrea` |

12. **Service mesh detection**
    - Istio: `kubectl get namespace -l istio-injection=enabled 2>/dev/null`, `kubectl get pods -n istio-system 2>/dev/null`
    - Linkerd: `kubectl get namespace -l linkerd.io/inject=enabled 2>/dev/null`, `kubectl get pods -n linkerd 2>/dev/null`
    - Consul Connect: `kubectl get pods -A 2>/dev/null | grep consul`
    - AWS App Mesh: `kubectl get meshes.appmesh.k8s.aws -A 2>/dev/null`
    - OCI Service Mesh: `kubectl get meshes.servicemesh.oci.oracle.com -A 2>/dev/null`
    - Kuma/Kong Mesh: `kubectl get meshes.kuma.io -A 2>/dev/null`

13. **Ingress detection**
    - `kubectl get ingressclass -A 2>/dev/null`
    - `kubectl get ingress -A 2>/dev/null`
    - OCI LB: IngressClass `oci` or annotation `kubernetes.io/ingress.class: oci`
    - OCI Native Ingress: `kubectl get ingressclassparameters.networking.k8s.io -A 2>/dev/null`

### PHASE 5 — Permission Check
14. **Current kubeconfig permission assessment**
    - `kubectl auth whoami 2>/dev/null` (K8s 1.28+)
    - `kubectl config current-context`
    - `kubectl auth can-i --list 2>/dev/null` → Collect full permission list
    - Analyze collected permissions to determine **Access Level**:
      - Full admin: `*.* in *` present
      - Read-only: Only get/list/watch, no create/update/delete
      - Limited access: Only self-subject review, API discovery, health check
    - **Allowed Operations**: List actual permissions with ✅
    - **Denied/Missing Operations**: Specify key operations that are not available
    - If permissions are limited, add **Note**: explain what operations are restricted

---

## Output Requirements

Organize collected data into the **markdown report format** below.
- Items that could not be collected: Mark with `❌` + reason
- Successfully collected items: Mark with `✅`
- **Never record guessed values as facts**

```markdown
# 🗂️ Cluster Inventory Report
> Generated: {datetime}
> Context: {current-context}

---

## 1. Cluster Basic Information
| Item | Value |
|------|-------|
| CSP | AWS EKS / GKE / AKS / OCI OKE / k3s / kind / On-premise / Other |
| Cluster Name | (kubeconfig context name) |
| Region | (topology label value or N/A) |
| Availability Zone / Fault Domain | (topology label value or N/A) |
| Kubernetes Version | vX.Y.Z |
| Container Runtime | containerd/docker vX.Y.Z |
| Notes | GKE Autopilot / EKS Fargate / OKE Virtual Node / Standard etc. |

---

## 2. Node Information
| Node Name | Role | Status | Instance Type/Shape | OS/Kernel | AMI/Image | NodeGroup/NodePool | Spot/Preemptible | CPU | Memory |
|-----------|------|--------|--------------------|-----------|-----------|--------------------|-----------------|-----|--------|

- **Total Nodes**: N (Control Plane: X, Worker: Y)
- **Spot/Preemptible Nodes**: N / Total N (XX%) — "None" if absent
- **Architecture**: arm64 / amd64 / mixed
- **Fargate / Virtual Nodes**: N (omit if not applicable)

---

## 3. Resource Usage
### 3-1. Per-Node Usage
| Node Name | CPU Used | CPU Allocatable | Memory Used | Memory Allocatable |
|-----------|----------|----------------|-------------|-------------------|

### 3-2. Per-Namespace Pod Resource Requests
| Namespace | Pod Count | CPU Req | Mem Req | CPU Limit | Mem Limit | BestEffort Pods |
|-----------|-----------|---------|---------|-----------|-----------|-----------------|

> ⚠️ If metrics-server not installed, only Requests/Limits shown instead of actual usage

---

## 4. Scaling Information
| Component | Status | Details |
|-----------|--------|---------|
| Cluster Autoscaler | ✅/❌ | Version, target NodeGroups |
| OKE Node Pool Autoscaling | ✅/❌/N/A | Show only in OKE environments |
| Karpenter | ✅/❌ | Version, NodePool/NodeClass list |
| HPA | ✅ N items / ❌ | Target workload list |
| VPA | ✅ N items / ❌ | Target workload list |
| KEDA | ✅/❌ | ScaledObject N, ScaledJob N |

---

## 5. NodeGroup / NodePool Information
| NodeGroup/Pool Name | Node Count | Instance Type/Shape | Spot/Preemptible | Key Labels/Taints |
|--------------------|-----------|--------------------|-----------------|--------------------|

> Show ❌ if NodeGroup info cannot be determined from labels

---

## 6. Workload Status
### 6-1. Summary by Type
| Type | Total | Running/Ready | Namespace Distribution |
|------|-------|--------------|----------------------|
| Deployment | N | N/N | ns1(n), ns2(n) |
| StatefulSet | N | N/N | ... |
| DaemonSet | N | N/N | ... |
| Job | N | Complete:N / Running:N | ... |
| CronJob | N | - | ... |
| Rollout (Argo) | N / ❌ Not installed | N/N | ... |
| DeploymentConfig (OpenShift) | N / ❌ Not installed | N/N | ... |
| Pod (All) | N | Running:N, Pending:N, Failed:N, Other:N | ... |

### 6-2. Per-Namespace Workload Details
(List key workloads per namespace)

---

## 7. Network Information
| Item | Value |
|------|-------|
| CNI | Flannel / Calico / Cilium / AWS VPC CNI / Azure CNI / OCI VCN-Native CNI / GKE CNI / Other |
| Pod CIDR | x.x.x.x/xx |
| Service CIDR | x.x.x.x/xx (❌ if unavailable) |
| Ingress Controller | nginx / traefik / alb / oci / none |
| Service Mesh | Istio / Linkerd / Consul / AWS App Mesh / OCI Service Mesh / ❌ None |

---

## 8. 🔑 Permissions
- **User/ServiceAccount**: (whoami result or context-based)
- **Access Level**: Full admin / Read-write / Read-only / Limited permissions
- **Allowed Operations**:
  - ✅ (list actual available permissions)
  - e.g.: Self-subject reviews, API discovery, Health checks, Version info, Get nodes, List pods etc.
- **Restricted Operations** (if applicable):
  - ❌ (list key operations that are unavailable)

**Note**: If permissions are limited, add explanation. e.g.: "You do NOT have full admin permissions. Your access is restricted to self-inspection and cluster health checks."

> 💡 Items that failed to collect due to insufficient permissions are marked `❌ No permission (forbidden)` in each report section

---

## 9. Key Findings & Recommendations
- ⚠️ [Finding]: Description
- 💡 [Recommendation]: Description
(Write based on collected data only — no guessing)
```

---

## Collection Failure Handling Principles
| Failure Cause | Notation |
|--------------|----------|
| Insufficient permissions | `❌ No permission (forbidden)` |
| CRD not installed | `❌ Not installed (no resource type)` |
| No metrics-server | `❌ metrics-server not installed` |
| Cloud-specific label missing | `N/A (not this CSP)` |
| Local/k3s environment | `N/A (local environment)` |

**Never record guessed values as facts.**

## Boundary
- This skill performs **read-only** queries only. Does not create/modify/delete resources.
- For individual Pod debugging, use the `diagnose` skill.
- For detailed security vulnerability analysis, use the `security expert`.
- Reports must be saved using `save_to_cluster`.
