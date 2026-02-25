import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';
import { PassThrough } from 'stream';
import { getKubeConfig } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';
import { collectStream } from '../utils/stream-helpers.js';

export function registerLogsTools(server: McpServer): void {
  server.tool(
    'k8s_get_pod_logs',
    'Get logs from a pod container',
    {
      podName: z.string().describe('Pod name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      containerName: z.string().optional().describe('Container name (required for multi-container pods)'),
      tailLines: z.number().int().min(1).max(10000).optional().describe('Number of lines from end of logs'),
      follow: z.boolean().default(false).describe('Stream logs (collected for up to durationSeconds)'),
      durationSeconds: z.number().int().min(1).max(60).default(10).describe('How long to collect streamed logs (max 60s)'),
      sinceSeconds: z.number().int().min(1).optional().describe('Return logs newer than this many seconds'),
      previous: z.boolean().default(false).describe('Return logs from previous container instance'),
    },
    async ({ podName, namespace, containerName, tailLines, follow, durationSeconds, sinceSeconds, previous }) => {
      try {
        const kc = getKubeConfig();
        const log = new k8s.Log(kc);
        const stream = new PassThrough();

        await log.log(
          namespace,
          podName,
          containerName ?? '',
          stream,
          {
            follow,
            tailLines,
            sinceSeconds,
            previous,
          },
        );

        const text = await collectStream(stream, durationSeconds * 1000);
        return { content: [{ type: 'text', text: text || '(no logs)' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
