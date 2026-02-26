import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCoreV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerQuotaTools(server: McpServer): void {
  // k8s_list_resource_quotas
  server.tool(
    'k8s_list_resource_quotas',
    'List ResourceQuotas in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedResourceQuota({ namespace });
        const quotas = res.items.map((rq) => ({
          name: rq.metadata?.name,
          namespace: rq.metadata?.namespace,
          hard: rq.spec?.hard,
          used: rq.status?.used,
          createdAt: rq.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(quotas, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_resource_quota
  server.tool(
    'k8s_get_resource_quota',
    'Get full details of a specific ResourceQuota',
    {
      name: z.string().describe('ResourceQuota name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedResourceQuota({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_limit_ranges
  server.tool(
    'k8s_list_limit_ranges',
    'List LimitRanges in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedLimitRange({ namespace });
        const limitRanges = res.items.map((lr) => ({
          name: lr.metadata?.name,
          namespace: lr.metadata?.namespace,
          limits: lr.spec?.limits,
          createdAt: lr.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(limitRanges, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_limit_range
  server.tool(
    'k8s_get_limit_range',
    'Get full details of a specific LimitRange',
    {
      name: z.string().describe('LimitRange name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedLimitRange({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
