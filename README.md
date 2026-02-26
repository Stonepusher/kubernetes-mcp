# kubernetes-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives Claude (or any MCP client) full access to a Kubernetes cluster and Helm. Exposes **73 tools** covering pods, deployments, services, config, secrets, events, logs, exec, port-forwarding, manifest apply/delete, Helm lifecycle management, nodes, workloads, storage, ingress, batch jobs, rollouts, RBAC, kubeconfig contexts, metrics, HPAs, and CRDs.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [`kubectl`](https://kubernetes.io/docs/tasks/tools/) configured with a valid kubeconfig
- [`helm`](https://helm.sh/docs/intro/install/) 3.x in PATH

## Installation

```bash
git clone https://github.com/Stonepusher/kubernetes-mcp.git
cd kubernetes-mcp
npm install
npm run build
```

## Usage with Claude Code

A `.mcp.json` is included in the repo root. When you open the project directory in Claude Code the `kubernetes` server is registered automatically. Run `/mcp` inside Claude Code to confirm it is active, then talk to Claude naturally:

> "List all pods in the default namespace"
> "Scale the echo-server deployment to 3 replicas"
> "Show me the logs from the nginx pod"
> "Install bitnami/nginx as my-release in the staging namespace"
> "What CRDs are installed in this cluster?"
> "Show me all ClusterRoles and their rule counts"

### Manual registration

To register the server globally (outside this directory) add the following to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "kubernetes": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/kubernetes-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### Kubernetes — core resources

| Tool | Description |
|---|---|
| `k8s_list_namespaces` | List all namespaces |
| `k8s_list_pods` | List pods in a namespace (optional label selector) |
| `k8s_get_pod` | Get full details of a pod |
| `k8s_list_deployments` | List deployments in a namespace |
| `k8s_get_deployment` | Get full details of a deployment |
| `k8s_scale_deployment` | Scale a deployment to N replicas |
| `k8s_list_services` | List services in a namespace |
| `k8s_get_service` | Get full details of a service |
| `k8s_list_configmaps` | List ConfigMaps in a namespace |
| `k8s_get_configmap` | Get a ConfigMap including its data |
| `k8s_list_secrets` | List Secrets in a namespace (names/types only) |
| `k8s_get_secret` | Get a Secret (values are base64-encoded) |
| `k8s_get_events` | Get events in a namespace, optionally filtered by object name |

### Kubernetes — operations

| Tool | Description |
|---|---|
| `k8s_get_pod_logs` | Stream or tail logs from a pod container |
| `k8s_exec` | Execute a command inside a running pod |
| `k8s_port_forward_start` | Start a local port-forward tunnel to a pod |
| `k8s_port_forward_list` | List active port-forward sessions |
| `k8s_port_forward_stop` | Stop a port-forward session |
| `k8s_apply_manifest` | Apply a YAML/JSON manifest (`kubectl apply -f -`) |
| `k8s_delete_manifest` | Delete resources defined in a manifest |
| `k8s_delete_resource` | Delete any resource by type, name, and namespace (no manifest needed) |

### Kubernetes — nodes

| Tool | Description |
|---|---|
| `k8s_list_nodes` | List all nodes with status, roles, and version info |
| `k8s_get_node` | Get full details of a node |
| `k8s_cordon_node` | Cordon a node to prevent new pod scheduling |
| `k8s_uncordon_node` | Uncordon a node to re-enable pod scheduling |
| `k8s_drain_node` | Drain a node by evicting all pods |

### Kubernetes — workloads

| Tool | Description |
|---|---|
| `k8s_list_daemonsets` | List DaemonSets in a namespace |
| `k8s_get_daemonset` | Get full details of a DaemonSet |
| `k8s_list_statefulsets` | List StatefulSets in a namespace |
| `k8s_get_statefulset` | Get full details of a StatefulSet |

### Kubernetes — batch

| Tool | Description |
|---|---|
| `k8s_list_jobs` | List Jobs in a namespace |
| `k8s_get_job` | Get full details of a Job |
| `k8s_list_cronjobs` | List CronJobs in a namespace |
| `k8s_get_cronjob` | Get full details of a CronJob |
| `k8s_suspend_cronjob` | Suspend a CronJob to stop it scheduling new Jobs |
| `k8s_resume_cronjob` | Resume a suspended CronJob |

### Kubernetes — rollouts

| Tool | Description |
|---|---|
| `k8s_rollout_restart` | Trigger a rolling restart of a Deployment, DaemonSet, or StatefulSet |
| `k8s_rollout_status` | Check rollout status and wait for completion |
| `k8s_rollout_undo` | Roll back to a previous revision |

### Kubernetes — storage

| Tool | Description |
|---|---|
| `k8s_list_persistent_volumes` | List all PersistentVolumes |
| `k8s_get_persistent_volume` | Get full details of a PersistentVolume |
| `k8s_list_persistent_volume_claims` | List PersistentVolumeClaims in a namespace |
| `k8s_get_persistent_volume_claim` | Get full details of a PersistentVolumeClaim |
| `k8s_list_storage_classes` | List all StorageClasses |
| `k8s_get_storage_class` | Get full details of a StorageClass |

### Kubernetes — networking

| Tool | Description |
|---|---|
| `k8s_list_ingresses` | List Ingresses in a namespace |
| `k8s_get_ingress` | Get full details of an Ingress |

### Kubernetes — autoscaling

| Tool | Description |
|---|---|
| `k8s_list_hpas` | List HorizontalPodAutoscalers in a namespace |
| `k8s_get_hpa` | Get full details of a HorizontalPodAutoscaler |

### Kubernetes — RBAC

| Tool | Description |
|---|---|
| `k8s_list_cluster_roles` | List all ClusterRoles |
| `k8s_get_cluster_role` | Get full details of a ClusterRole |
| `k8s_list_cluster_role_bindings` | List all ClusterRoleBindings |
| `k8s_get_cluster_role_binding` | Get full details of a ClusterRoleBinding |
| `k8s_list_roles` | List Roles in a namespace |
| `k8s_get_role` | Get full details of a Role |
| `k8s_list_role_bindings` | List RoleBindings in a namespace |
| `k8s_get_role_binding` | Get full details of a RoleBinding |

### Kubernetes — custom resources

| Tool | Description |
|---|---|
| `k8s_list_crds` | List all CustomResourceDefinitions |
| `k8s_get_crd` | Get full details of a CustomResourceDefinition |

### Kubernetes — contexts & metrics

| Tool | Description |
|---|---|
| `k8s_list_contexts` | List all kubeconfig contexts and show which is active |
| `k8s_use_context` | Switch the active kubeconfig context |
| `k8s_top_nodes` | Show CPU/memory usage for all nodes (requires metrics-server) |
| `k8s_top_pods` | Show CPU/memory usage for pods in a namespace (requires metrics-server) |

### Helm

| Tool | Description |
|---|---|
| `helm_list` | List releases (single namespace or all) |
| `helm_install` | Install a chart |
| `helm_upgrade` | Upgrade (or install) a release |
| `helm_rollback` | Roll back a release to a previous revision |
| `helm_uninstall` | Uninstall a release |
| `helm_get_values` | Get values for an installed release |
| `helm_history` | Get revision history of a release |
| `helm_show_chart_values` | Show default values for a chart before installing |
| `helm_repo_add` | Add a Helm chart repository |
| `helm_repo_update` | Update local Helm repository cache |

## Development

```bash
npm run build      # compile TypeScript → dist/index.js via esbuild
npm run dev        # rebuild on file changes
npm run typecheck  # tsc --noEmit (type-check only, no emit)
npm test           # smoke test — exercises all 73 tools against a live cluster
```

### Smoke test

`npm test` runs `test/smoke-test.mjs`, which spawns the MCP server over stdio and exercises all read-only tools against the currently configured cluster. It discovers real resource names dynamically (no hardcoded names) and skips dependent tests gracefully when resources are not found. Write operations (`k8s_rollout_restart`, `k8s_use_context`, etc.) are hard-skipped.

```
Kubernetes MCP Server — Smoke Test
==================================================

── Phase 1: Handshake ──────────────────────────────────────
  [PASS] initialize — serverInfo.name === "kubernetes"

── Phase 2: Tool inventory ─────────────────────────────────
  [PASS] tools/list — count === 73

── Phase 3: Tool assertions ────────────────────────────────
  [PASS] k8s_list_namespaces — returns non-empty array
  [PASS] k8s_list_pods — non-empty array in kube-system
  ...
==================================================
Results  (7.3s elapsed)
  Passed : 55
  Failed : 0
  Skipped: 10
```

### Build notes

`@kubernetes/client-node` v1.x ships ~54 MB of generated TypeScript types that OOM the TypeScript compiler. The project uses [esbuild](https://esbuild.github.io) to bundle to a single CJS file (`dist/index.js`) without type-checking overhead. Use `npm run typecheck` separately if you need full type validation.

## License

MIT
