import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAutoscalingV2Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerHpaTools(server: McpServer): void {
  // k8s_list_hpas
  server.tool(
    'k8s_list_hpas',
    'List HorizontalPodAutoscalers in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getAutoscalingV2Api();
        const res = await api.listNamespacedHorizontalPodAutoscaler({ namespace, labelSelector });
        const hpas = res.items.map((hpa) => ({
          name: hpa.metadata?.name,
          namespace: hpa.metadata?.namespace,
          scaleTargetRef: {
            kind: hpa.spec?.scaleTargetRef?.kind,
            name: hpa.spec?.scaleTargetRef?.name,
          },
          minReplicas: hpa.spec?.minReplicas,
          maxReplicas: hpa.spec?.maxReplicas,
          currentReplicas: hpa.status?.currentReplicas,
          desiredReplicas: hpa.status?.desiredReplicas,
          createdAt: hpa.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(hpas, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_hpa
  server.tool(
    'k8s_get_hpa',
    'Get details of a specific HorizontalPodAutoscaler',
    {
      name: z.string().describe('HPA name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getAutoscalingV2Api();
        const res = await api.readNamespacedHorizontalPodAutoscaler({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
