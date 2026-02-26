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
    'k8s_delete_resource',
    'Delete a Kubernetes resource by type and name without needing a manifest',
    {
      resourceType: z
        .string()
        .describe('Resource type (e.g. pod, deployment, service, job, configmap, secret)'),
      name: z.string().describe('Resource name'),
      namespace: z
        .string()
        .optional()
        .describe('Namespace (omit for cluster-scoped resources such as nodes or namespaces)'),
      force: z
        .boolean()
        .default(false)
        .describe('Force delete with --force --grace-period=0 (default: false)'),
      ignoreNotFound: z
        .boolean()
        .default(true)
        .describe('Do not error if the resource does not exist (default: true)'),
    },
    async ({ resourceType, name, namespace, force, ignoreNotFound }) => {
      try {
        const args = ['delete', resourceType, name];
        if (namespace) args.push('-n', namespace);
        if (force) args.push('--force', '--grace-period=0');
        if (ignoreNotFound) args.push('--ignore-not-found=true');
        const result = await runCommand('kubectl', args);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return {
          content: [{ type: 'text', text: output || `${resourceType}/${name} deleted.` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
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
