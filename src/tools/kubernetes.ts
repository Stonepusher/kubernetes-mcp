import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCoreV1Api, getAppsV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerKubernetesTools(server: McpServer): void {
  // k8s_list_namespaces
  server.tool(
    'k8s_list_namespaces',
    'List all Kubernetes namespaces in the cluster',
    {},
    async () => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespace({});
        const namespaces = res.items.map((ns) => ({
          name: ns.metadata?.name,
          status: ns.status?.phase,
          createdAt: ns.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(namespaces, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_pods
  server.tool(
    'k8s_list_pods',
    'List pods in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedPod({ namespace, labelSelector });
        const pods = res.items.map((pod) => ({
          name: pod.metadata?.name,
          namespace: pod.metadata?.namespace,
          phase: pod.status?.phase,
          conditions: pod.status?.conditions?.map((c) => ({ type: c.type, status: c.status })),
          podIP: pod.status?.podIP,
          nodeName: pod.spec?.nodeName,
          createdAt: pod.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(pods, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_pod
  server.tool(
    'k8s_get_pod',
    'Get details of a specific pod',
    {
      name: z.string().describe('Pod name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedPod({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_deployments
  server.tool(
    'k8s_list_deployments',
    'List deployments in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.listNamespacedDeployment({ namespace, labelSelector });
        const deployments = res.items.map((d) => ({
          name: d.metadata?.name,
          namespace: d.metadata?.namespace,
          replicas: d.spec?.replicas,
          readyReplicas: d.status?.readyReplicas,
          availableReplicas: d.status?.availableReplicas,
          createdAt: d.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(deployments, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_deployment
  server.tool(
    'k8s_get_deployment',
    'Get details of a specific deployment',
    {
      name: z.string().describe('Deployment name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.readNamespacedDeployment({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_scale_deployment
  server.tool(
    'k8s_scale_deployment',
    'Scale a deployment to a specific number of replicas',
    {
      name: z.string().describe('Deployment name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      replicas: z.number().int().min(0).describe('Desired number of replicas'),
    },
    async ({ name, namespace, replicas }) => {
      try {
        const api = getAppsV1Api();
        const res = await api.patchNamespacedDeployment(
          {
            name,
            namespace,
            body: { spec: { replicas } },
          },
          { headers: { 'Content-Type': 'application/merge-patch+json' } },
        );
        return {
          content: [
            {
              type: 'text',
              text: `Deployment '${name}' scaled to ${replicas} replicas. Current: ${res.spec?.replicas ?? 'unknown'}`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_services
  server.tool(
    'k8s_list_services',
    'List services in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedService({ namespace, labelSelector });
        const services = res.items.map((svc) => ({
          name: svc.metadata?.name,
          namespace: svc.metadata?.namespace,
          type: svc.spec?.type,
          clusterIP: svc.spec?.clusterIP,
          ports: svc.spec?.ports,
          externalIPs: svc.spec?.externalIPs,
          createdAt: svc.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(services, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_service
  server.tool(
    'k8s_get_service',
    'Get details of a specific service',
    {
      name: z.string().describe('Service name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedService({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_configmaps
  server.tool(
    'k8s_list_configmaps',
    'List ConfigMaps in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedConfigMap({ namespace });
        const configMaps = res.items.map((cm) => ({
          name: cm.metadata?.name,
          namespace: cm.metadata?.namespace,
          keys: cm.data ? Object.keys(cm.data) : [],
          createdAt: cm.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(configMaps, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_configmap
  server.tool(
    'k8s_get_configmap',
    'Get details of a specific ConfigMap including its data',
    {
      name: z.string().describe('ConfigMap name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedConfigMap({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_secrets
  server.tool(
    'k8s_list_secrets',
    'List Secrets in a namespace (names and types only, not values)',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedSecret({ namespace });
        const secrets = res.items.map((s) => ({
          name: s.metadata?.name,
          namespace: s.metadata?.namespace,
          type: s.type,
          keys: s.data ? Object.keys(s.data) : [],
          createdAt: s.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(secrets, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_secret
  server.tool(
    'k8s_get_secret',
    'Get a Secret by name (values are base64-encoded as stored in Kubernetes)',
    {
      name: z.string().describe('Secret name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedSecret({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_events
  server.tool(
    'k8s_get_events',
    'Get events in a namespace, optionally filtered by involved object name',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      involvedObjectName: z.string().optional().describe('Filter by involved object name (e.g. pod name)'),
    },
    async ({ namespace, involvedObjectName }) => {
      try {
        const api = getCoreV1Api();
        const fieldSelector = involvedObjectName
          ? `involvedObject.name=${involvedObjectName}`
          : undefined;
        const res = await api.listNamespacedEvent({ namespace, fieldSelector });
        const events = res.items.map((e) => ({
          name: e.metadata?.name,
          namespace: e.metadata?.namespace,
          type: e.type,
          reason: e.reason,
          message: e.message,
          involvedObject: {
            kind: e.involvedObject?.kind,
            name: e.involvedObject?.name,
          },
          count: e.count,
          firstTime: e.firstTimestamp,
          lastTime: e.lastTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
