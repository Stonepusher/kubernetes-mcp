import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runCommand } from '../utils/shell.js';
import { formatK8sError } from '../utils/errors.js';

export function registerManifestTools(server: McpServer): void {
  server.tool(
    'k8s_apply_manifest',
    'Apply a Kubernetes manifest (YAML or JSON) using kubectl apply -f -',
    {
      manifest: z.string().describe('YAML or JSON manifest content to apply'),
      dryRun: z.boolean().default(false).describe('Perform a dry-run (client-side)'),
    },
    async ({ manifest, dryRun }) => {
      try {
        const args = ['apply', '-f', '-'];
        if (dryRun) {
          args.push('--dry-run=client');
        }
        const result = await runCommand('kubectl', args, manifest);
        return {
          content: [
            {
              type: 'text',
              text: result.stdout || result.stderr || 'Manifest applied successfully.',
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  server.tool(
    'k8s_delete_manifest',
    'Delete Kubernetes resources defined in a manifest using kubectl delete -f -',
    {
      manifest: z.string().describe('YAML or JSON manifest content to delete'),
      ignoreNotFound: z.boolean().default(true).describe('Do not error if resources are not found'),
    },
    async ({ manifest, ignoreNotFound }) => {
      try {
        const args = ['delete', '-f', '-'];
        if (ignoreNotFound) {
          args.push('--ignore-not-found=true');
        }
        const result = await runCommand('kubectl', args, manifest);
        return {
          content: [
            {
              type: 'text',
              text: result.stdout || result.stderr || 'Resources deleted successfully.',
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
