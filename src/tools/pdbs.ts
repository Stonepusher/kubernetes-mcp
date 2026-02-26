import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPolicyV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerPdbTools(server: McpServer): void {
  // k8s_list_pod_disruption_budgets
  server.tool(
    'k8s_list_pod_disruption_budgets',
    'List PodDisruptionBudgets in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getPolicyV1Api();
        const res = await api.listNamespacedPodDisruptionBudget({ namespace, labelSelector });
        const pdbs = res.items.map((pdb) => ({
          name: pdb.metadata?.name,
          namespace: pdb.metadata?.namespace,
          minAvailable: pdb.spec?.minAvailable,
          maxUnavailable: pdb.spec?.maxUnavailable,
          currentHealthy: pdb.status?.currentHealthy,
          desiredHealthy: pdb.status?.desiredHealthy,
          disruptionsAllowed: pdb.status?.disruptionsAllowed,
          createdAt: pdb.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(pdbs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_pod_disruption_budget
  server.tool(
    'k8s_get_pod_disruption_budget',
    'Get full details of a specific PodDisruptionBudget',
    {
      name: z.string().describe('PodDisruptionBudget name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getPolicyV1Api();
        const res = await api.readNamespacedPodDisruptionBudget({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
