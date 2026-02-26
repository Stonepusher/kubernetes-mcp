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
}
