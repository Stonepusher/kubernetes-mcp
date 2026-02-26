import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCoreV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerServiceAccountTools(server: McpServer): void {
  // k8s_list_service_accounts
  server.tool(
    'k8s_list_service_accounts',
    'List ServiceAccounts in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedServiceAccount({ namespace, labelSelector });
        const accounts = res.items.map((sa) => ({
          name: sa.metadata?.name,
          namespace: sa.metadata?.namespace,
          secrets: sa.secrets?.length ?? 0,
          imagePullSecrets: sa.imagePullSecrets?.length ?? 0,
          createdAt: sa.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_service_account
  server.tool(
    'k8s_get_service_account',
    'Get full details of a specific ServiceAccount',
    {
      name: z.string().describe('ServiceAccount name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedServiceAccount({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
