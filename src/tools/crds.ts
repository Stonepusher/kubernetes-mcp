import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getApiExtensionsV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerCrdTools(server: McpServer): void {
  // k8s_list_crds
  server.tool(
    'k8s_list_crds',
    'List all CustomResourceDefinitions in the cluster',
    {},
    async () => {
      try {
        const api = getApiExtensionsV1Api();
        const res = await api.listCustomResourceDefinition({});
        const crds = res.items.map((crd) => ({
          name: crd.metadata?.name,
          group: crd.spec.group,
          scope: crd.spec.scope,
          versions: crd.spec.versions?.map((v) => v.name),
          createdAt: crd.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(crds, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_crd
  server.tool(
    'k8s_get_crd',
    'Get details of a specific CustomResourceDefinition',
    {
      name: z.string().describe('CRD name (e.g. certificates.cert-manager.io)'),
    },
    async ({ name }) => {
      try {
        const api = getApiExtensionsV1Api();
        const res = await api.readCustomResourceDefinition({ name });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
