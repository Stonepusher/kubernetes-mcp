import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getBatchV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerBatchTools(server: McpServer): void {
  // k8s_list_jobs
  server.tool(
    'k8s_list_jobs',
    'List Jobs in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getBatchV1Api();
        const res = await api.listNamespacedJob({ namespace, labelSelector });
        const jobs = res.items.map((job) => ({
          name: job.metadata?.name,
          namespace: job.metadata?.namespace,
          completions: job.spec?.completions,
          succeeded: job.status?.succeeded ?? 0,
          failed: job.status?.failed ?? 0,
          active: job.status?.active ?? 0,
          startTime: job.status?.startTime,
          completionTime: job.status?.completionTime,
          createdAt: job.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(jobs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_job
  server.tool(
    'k8s_get_job',
    'Get details of a specific Job',
    {
      name: z.string().describe('Job name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getBatchV1Api();
        const res = await api.readNamespacedJob({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_cronjobs
  server.tool(
    'k8s_list_cronjobs',
    'List CronJobs in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      labelSelector: z.string().optional().describe('Label selector filter (e.g. app=nginx)'),
    },
    async ({ namespace, labelSelector }) => {
      try {
        const api = getBatchV1Api();
        const res = await api.listNamespacedCronJob({ namespace, labelSelector });
        const cronjobs = res.items.map((cj) => ({
          name: cj.metadata?.name,
          namespace: cj.metadata?.namespace,
          schedule: cj.spec?.schedule,
          suspend: cj.spec?.suspend ?? false,
          active: cj.status?.active?.length ?? 0,
          lastScheduleTime: cj.status?.lastScheduleTime,
          createdAt: cj.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(cronjobs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_cronjob
  server.tool(
    'k8s_get_cronjob',
    'Get details of a specific CronJob',
    {
      name: z.string().describe('CronJob name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getBatchV1Api();
        const res = await api.readNamespacedCronJob({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
