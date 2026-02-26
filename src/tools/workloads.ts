import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAppsV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerWorkloadTools(server: McpServer): void {
  // k8s_list_daemonsets
  server.tool(
    'k8s_list_daemonsets',
    'List DaemonSets in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.listNamespacedDaemonSet({ namespace, labelSelector });
        const daemonsets = res.items.map((ds) => ({
          name: ds.metadata?.name,
          namespace: ds.metadata?.namespace,
          desiredNumberScheduled: ds.status?.desiredNumberScheduled,
          numberReady: ds.status?.numberReady,
          numberAvailable: ds.status?.numberAvailable,
          createdAt: ds.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(daemonsets, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_daemonset
  server.tool(
    'k8s_get_daemonset',
    'Get details of a specific DaemonSet',
    {
      name: z.string().describe('DaemonSet name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.readNamespacedDaemonSet({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_statefulsets
  server.tool(
    'k8s_list_statefulsets',
    'List StatefulSets in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.listNamespacedStatefulSet({ namespace, labelSelector });
        const statefulsets = res.items.map((ss) => ({
          name: ss.metadata?.name,
          namespace: ss.metadata?.namespace,
          replicas: ss.spec?.replicas,
          readyReplicas: ss.status?.readyReplicas,
          currentReplicas: ss.status?.currentReplicas,
          createdAt: ss.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(statefulsets, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_statefulset
  server.tool(
    'k8s_get_statefulset',
    'Get details of a specific StatefulSet',
    {
      name: z.string().describe('StatefulSet name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.readNamespacedStatefulSet({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
