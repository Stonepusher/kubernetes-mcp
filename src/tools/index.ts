import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerKubernetesTools } from './kubernetes.js';
import { registerLogsTools } from './logs.js';
import { registerExecTools } from './exec.js';
import { registerPortForwardTools } from './port-forward.js';
import { registerManifestTools } from './manifests.js';
import { registerHelmTools } from './helm.js';
import { registerNodeTools } from './nodes.js';
import { registerWorkloadTools } from './workloads.js';
import { registerStorageTools } from './storage.js';
import { registerIngressTools } from './ingress.js';
import { registerBatchTools } from './batch.js';
import { registerRolloutTools } from './rollout.js';
import { registerRbacTools } from './rbac.js';
import { registerContextTools } from './contexts.js';
import { registerMetricsTools } from './metrics.js';
import { registerHpaTools } from './hpa.js';
import { registerCrdTools } from './crds.js';

export function registerAllTools(server: McpServer): void {
  registerKubernetesTools(server);
  registerLogsTools(server);
  registerExecTools(server);
  registerPortForwardTools(server);
  registerManifestTools(server);
  registerHelmTools(server);
  registerNodeTools(server);
  registerWorkloadTools(server);
  registerStorageTools(server);
  registerIngressTools(server);
  registerBatchTools(server);
  registerRolloutTools(server);
  registerRbacTools(server);
  registerContextTools(server);
  registerMetricsTools(server);
  registerHpaTools(server);
  registerCrdTools(server);
}
