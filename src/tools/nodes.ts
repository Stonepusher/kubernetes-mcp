import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCoreV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';
import { runCommand } from '../utils/shell.js';

export function registerNodeTools(server: McpServer): void {
  // k8s_list_nodes
  server.tool(
    'k8s_list_nodes',
    'List all nodes in the cluster with status, roles, and version info',
    {},
    async () => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNode({});
        const nodes = res.items.map((node) => {
          const labels = node.metadata?.labels ?? {};
          const roleKeys = Object.keys(labels).filter((k) =>
            k.startsWith('node-role.kubernetes.io/'),
          );
          const roles =
            roleKeys.length > 0
              ? roleKeys.map((k) => k.replace('node-role.kubernetes.io/', ''))
              : ['worker'];
          const readyCond = node.status?.conditions?.find((c) => c.type === 'Ready');
          return {
            name: node.metadata?.name,
            status: readyCond?.status === 'True' ? 'Ready' : 'NotReady',
            roles,
            kubeletVersion: node.status?.nodeInfo?.kubeletVersion,
            osImage: node.status?.nodeInfo?.osImage,
            unschedulable: node.spec?.unschedulable ?? false,
            createdAt: node.metadata?.creationTimestamp,
          };
        });
        return { content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_node
  server.tool(
    'k8s_get_node',
    'Get full details of a specific node',
    {
      name: z.string().describe('Node name'),
    },
    async ({ name }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNode({ name });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_cordon_node
  server.tool(
    'k8s_cordon_node',
    'Cordon a node to prevent new pods from being scheduled on it',
    {
      name: z.string().describe('Node name'),
    },
    async ({ name }) => {
      try {
        const api = getCoreV1Api();
        await api.patchNode(
          { name, body: { spec: { unschedulable: true } } },
          { headers: { 'Content-Type': 'application/merge-patch+json' } },
        );
        return { content: [{ type: 'text', text: `Node '${name}' cordoned successfully.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_uncordon_node
  server.tool(
    'k8s_uncordon_node',
    'Uncordon a node to allow pods to be scheduled on it again',
    {
      name: z.string().describe('Node name'),
    },
    async ({ name }) => {
      try {
        const api = getCoreV1Api();
        // null removes the field via JSON merge-patch, matching kubectl behaviour
        await api.patchNode(
          { name, body: { spec: { unschedulable: null } } },
          { headers: { 'Content-Type': 'application/merge-patch+json' } },
        );
        return { content: [{ type: 'text', text: `Node '${name}' uncordoned successfully.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_drain_node
  server.tool(
    'k8s_drain_node',
    'Drain a node by evicting all pods (cordons the node first)',
    {
      name: z.string().describe('Node name'),
      ignoreDaemonsets: z
        .boolean()
        .default(true)
        .describe('Ignore DaemonSet-managed pods (default: true)'),
      deleteEmptydirData: z
        .boolean()
        .default(false)
        .describe('Delete pods using emptyDir volumes (default: false)'),
      force: z
        .boolean()
        .default(false)
        .describe('Force deletion of pods not managed by a ReplicationController (default: false)'),
      timeoutSeconds: z
        .number()
        .int()
        .min(0)
        .default(300)
        .describe('Timeout in seconds; 0 means no timeout (default: 300)'),
    },
    async ({ name, ignoreDaemonsets, deleteEmptydirData, force, timeoutSeconds }) => {
      try {
        const args: string[] = ['drain', name];
        if (ignoreDaemonsets) args.push('--ignore-daemonsets');
        if (deleteEmptydirData) args.push('--delete-emptydir-data');
        if (force) args.push('--force');
        if (timeoutSeconds > 0) args.push(`--timeout=${timeoutSeconds}s`);

        const result = await runCommand('kubectl', args);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        return { content: [{ type: 'text', text: output || `Node '${name}' drained successfully.` }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );
}
