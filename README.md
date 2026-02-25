# kubernetes-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives Claude (or any MCP client) full access to a Kubernetes cluster and Helm. Exposes **30 tools** covering pods, deployments, services, config, secrets, events, logs, exec, port-forwarding, manifest apply/delete, and Helm lifecycle management.

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
npm test           # smoke test — exercises all 30 tools against a live cluster
```

### Smoke test

`npm test` runs `test/smoke-test.mjs`, which spawns the MCP server over stdio and exercises all 22 read-only tools against the currently configured cluster. It discovers real resource names dynamically (no hardcoded names) and skips dependent tests gracefully when resources are not found.

```
Kubernetes MCP Server — Smoke Test
==================================================

── Phase 1: Handshake ──────────────────────────────────────
  [PASS] initialize — serverInfo.name === "kubernetes"

── Phase 2: Tool inventory ─────────────────────────────────
  [PASS] tools/list — count === 30

── Phase 3: Tool assertions ────────────────────────────────
  [PASS] k8s_list_namespaces — returns non-empty array
  [PASS] k8s_list_pods — non-empty array in kube-system
  ...
==================================================
Results  (3.4s elapsed)
  Passed : 23
  Failed : 0
  Skipped: 1
```

### Build notes

`@kubernetes/client-node` v1.x ships ~54 MB of generated TypeScript types that OOM the TypeScript compiler. The project uses [esbuild](https://esbuild.github.io) to bundle to a single CJS file (`dist/index.js`) without type-checking overhead. Use `npm run typecheck` separately if you need full type validation.

## License

MIT
