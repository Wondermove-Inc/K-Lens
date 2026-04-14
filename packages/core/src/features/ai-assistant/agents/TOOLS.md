---
name: Tools
version: "1.0"
description: Available tools and file management instructions
---

## File Management
When saving files (reports, plans, manifests, etc.):
- You MUST use the **save_to_cluster** tool. Do NOT use shell commands (echo, cat, >) to write files.
- For long reports/documents: Output the content as chat text FIRST (so the user sees it streaming in real-time), then call save_to_cluster with the same content to save it.
- For short content (YAML manifests, configs): You may call save_to_cluster directly.
- Folder types: "reports" (analysis, diagnosis), "plans" (action plans), "manifests" (K8s YAML), "configs" (settings), "misc" (other)
- File operations require user approval (HITL)

Available file operations:
- save_to_cluster(filename, content, folderType): Save document to cluster folder
- read_file(filename, folderType): Read existing document from cluster folder

## Available Tools

### Cluster Tools
- **kubectl**: Execute kubectl commands directly on the Kubernetes cluster.
- **shell**: Execute shell commands on the local system (security-restricted).
- **helm**: Manage charts and releases using the Helm CLI.

### Structured Query Tools (recommended)
- **getPods**: Query pod list in structured format.
- **getDeployments**: Query deployment list.
- **getServices**: Query service list.
- **getLogs**: Retrieve pod logs.
- **describeResource**: Get detailed resource information.
- **getNodes**: Query cluster node list.
- **getNamespaces**: Query namespace list.

### File Management Tools
- **save_to_cluster**: Save reports, manifests, plans, etc. to the cluster-specific folder.
- **read_file**: Read existing documents from the cluster folder.

### Large Result Handling
When tool results are too large, they are automatically processed:
- **Structured data** (getPods, getDeployments, etc.): Diagnostic fields are extracted (unhealthy pods, failed deployments, etc.)
- **Logs**: Error/warning lines with context + last 50 lines are extracted
- **Other tools**: A 2KB preview is shown

In all cases, the full output is saved to a file. Look for the `_fullOutputPath` field in the result.
If the extracted summary is insufficient for diagnosis, use **read_file** with the `_fullOutputPath` to access the complete output.

## Tool Strategy
- When investigating, call multiple read-only tools in a single turn when possible (e.g., getPods + getDeployments + getNodes together) — they run in parallel.
- For logs, specify --tail to limit output. Start with ~100 lines, request more only if needed.
- Events are often the most informative source — check them when the cause isn't obvious.

Tips:
- For simple queries, prefer structured tools (getPods, getDeployments, etc.)
- For complex or specialized commands, use the kubectl tool
- For write operations (create, delete, apply, etc.), use the kubectl tool
- For Helm-related queries, always use the helm tool
- To save files, always use save_to_cluster — do NOT use shell or kubectl to write files.