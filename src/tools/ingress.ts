import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getNetworkingV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerIngressTools(server: McpServer): void {
  // k8s_list_ingresses
  server.tool(
    'k8s_list_ingresses',
    'List Ingresses in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getNetworkingV1Api();
        const res = await api.listNamespacedIngress({ namespace, labelSelector });
        const ingresses = res.items.map((ing) => ({
          name: ing.metadata?.name,
          namespace: ing.metadata?.namespace,
          ingressClassName: ing.spec?.ingressClassName,
          rules: ing.spec?.rules?.map((rule) => ({
            host: rule.host,
            paths: rule.http?.paths?.map((p) => ({
              path: p.path,
              pathType: p.pathType,
              backend: {
                service: p.backend?.service?.name,
                port: p.backend?.service?.port?.number ?? p.backend?.service?.port?.name,
              },
            })),
          })),
          tls: ing.spec?.tls?.map((t) => ({
            hosts: t.hosts,
            secretName: t.secretName,
          })),
          createdAt: ing.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(ingresses, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_ingress
  server.tool(
    'k8s_get_ingress',
    'Get details of a specific Ingress',
    {
      name: z.string().describe('Ingress name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getNetworkingV1Api();
        const res = await api.readNamespacedIngress({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
