import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runCommand } from '../utils/shell.js';

const resourceTypeEnum = z
  .enum(['deployment', 'daemonset', 'statefulset'])
  .default('deployment')
  .describe('Resource type to restart (deployment, daemonset, statefulset)');

export function registerRolloutTools(server: McpServer): void {
  // k8s_rollout_restart
  server.tool(
    'k8s_rollout_restart',
    'Trigger a rolling restart of a Deployment, DaemonSet, or StatefulSet',
    {
      name: z.string().describe('Resource name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      resourceType: resourceTypeEnum,
    },
    async ({ name, namespace, resourceType }) => {
      try {
        const result = await runCommand('kubectl', [
          'rollout',
          'restart',
          `${resourceType}/${name}`,
          '-n',
          namespace,
        ]);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return {
          content: [
            {
              type: 'text',
              text: output || `${resourceType}/${name} restarted successfully.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );

  // k8s_rollout_status
  server.tool(
    'k8s_rollout_status',
    'Check the rollout status of a Deployment, DaemonSet, or StatefulSet',
    {
      name: z.string().describe('Resource name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      resourceType: resourceTypeEnum,
      timeoutSeconds: z
        .number()
        .int()
        .min(1)
        .default(60)
        .describe('Timeout in seconds to wait for rollout (default: 60)'),
    },
    async ({ name, namespace, resourceType, timeoutSeconds }) => {
      try {
        const result = await runCommand('kubectl', [
          'rollout',
          'status',
          `${resourceType}/${name}`,
          '-n',
          namespace,
          `--timeout=${timeoutSeconds}s`,
        ]);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return { content: [{ type: 'text', text: output || 'Rollout complete.' }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );
}
