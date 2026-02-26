import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getNetworkingV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerNetworkPolicyTools(server: McpServer): void {
  // k8s_list_network_policies
  server.tool(
    'k8s_list_network_policies',
    'List NetworkPolicies in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getNetworkingV1Api();
        const res = await api.listNamespacedNetworkPolicy({ namespace, labelSelector });
        const policies = res.items.map((np) => ({
          name: np.metadata?.name,
          namespace: np.metadata?.namespace,
          podSelector: np.spec?.podSelector,
          policyTypes: np.spec?.policyTypes,
          ingressRules: np.spec?.ingress?.length ?? 0,
          egressRules: np.spec?.egress?.length ?? 0,
          createdAt: np.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(policies, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_network_policy
  server.tool(
    'k8s_get_network_policy',
    'Get full details of a specific NetworkPolicy',
    {
      name: z.string().describe('NetworkPolicy name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getNetworkingV1Api();
        const res = await api.readNamespacedNetworkPolicy({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
