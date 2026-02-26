import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runCommand } from '../utils/shell.js';

export function registerMetricsTools(server: McpServer): void {
  // k8s_top_nodes
  server.tool(
    'k8s_top_nodes',
    'Show CPU and memory usage for all nodes (requires metrics-server)',
    {},
    async () => {
      try {
        const result = await runCommand('kubectl', ['top', 'nodes', '--no-headers']);
        const lines = (result.stdout ?? '').trim().split('\n').filter(Boolean);
        const nodes = lines.map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            name: parts[0],
            cpu: parts[1],
            cpuPercent: parts[2],
            memory: parts[3],
            memoryPercent: parts[4],
          };
        });
        return { content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );

  // k8s_top_pods
  server.tool(
    'k8s_top_pods',
    'Show CPU and memory usage for pods (requires metrics-server)',
    {
      namespace: z.string().optional().describe('Kubernetes namespace (ignored if allNamespaces=true)'),
      allNamespaces: z
        .boolean()
        .default(false)
        .describe('Show pods across all namespaces (default: false)'),
    },
    async ({ namespace, allNamespaces }) => {
      try {
        let args: string[];
        if (allNamespaces) {
          args = ['top', 'pods', '--no-headers', '--all-namespaces'];
        } else {
          args = ['top', 'pods', '--no-headers', '-n', namespace ?? 'default'];
        }
        const result = await runCommand('kubectl', args);
        const lines = (result.stdout ?? '').trim().split('\n').filter(Boolean);
        const pods = lines.map((line) => {
          const parts = line.trim().split(/\s+/);
          if (allNamespaces) {
            return { namespace: parts[0], name: parts[1], cpu: parts[2], memory: parts[3] };
          }
          return { name: parts[0], cpu: parts[1], memory: parts[2] };
        });
        return { content: [{ type: 'text', text: JSON.stringify(pods, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );
}
