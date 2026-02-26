import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getKubeConfig, invalidateKubeConfig } from '../k8s-client.js';
import { runCommand } from '../utils/shell.js';

export function registerContextTools(server: McpServer): void {
  // k8s_list_contexts
  server.tool(
    'k8s_list_contexts',
    'List all kubeconfig contexts and identify the current active context',
    {},
    async () => {
      try {
        const kc = getKubeConfig();
        const currentContext = kc.currentContext;
        const contexts = (kc.contexts ?? []).map((ctx) => ({
          name: ctx.name,
          cluster: ctx.cluster,
          user: ctx.user,
          isCurrent: ctx.name === currentContext,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(contexts, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );

  // k8s_use_context
  server.tool(
    'k8s_use_context',
    'Switch the active kubeconfig context',
    {
      name: z.string().describe('Context name to switch to'),
    },
    async ({ name }) => {
      try {
        const result = await runCommand('kubectl', ['config', 'use-context', name]);
        invalidateKubeConfig();
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return { content: [{ type: 'text', text: output || `Switched to context '${name}'.` }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );
}
