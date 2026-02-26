import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRbacAuthorizationV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerRbacTools(server: McpServer): void {
  // k8s_list_cluster_roles
  server.tool(
    'k8s_list_cluster_roles',
    'List all ClusterRoles in the cluster',
    {},
    async () => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.listClusterRole({});
        const roles = res.items.map((cr) => ({
          name: cr.metadata?.name,
          rulesCount: cr.rules?.length ?? 0,
          createdAt: cr.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(roles, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_cluster_role
  server.tool(
    'k8s_get_cluster_role',
    'Get details of a specific ClusterRole',
    {
      name: z.string().describe('ClusterRole name'),
    },
    async ({ name }) => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.readClusterRole({ name });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_cluster_role_bindings
  server.tool(
    'k8s_list_cluster_role_bindings',
    'List all ClusterRoleBindings in the cluster',
    {},
    async () => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.listClusterRoleBinding({});
        const bindings = res.items.map((crb) => ({
          name: crb.metadata?.name,
          roleRef: { kind: crb.roleRef.kind, name: crb.roleRef.name },
          subjectsCount: crb.subjects?.length ?? 0,
          createdAt: crb.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(bindings, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_cluster_role_binding
  server.tool(
    'k8s_get_cluster_role_binding',
    'Get details of a specific ClusterRoleBinding',
    {
      name: z.string().describe('ClusterRoleBinding name'),
    },
    async ({ name }) => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.readClusterRoleBinding({ name });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_roles
  server.tool(
    'k8s_list_roles',
    'List Roles in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.listNamespacedRole({ namespace });
        const roles = res.items.map((role) => ({
          name: role.metadata?.name,
          namespace: role.metadata?.namespace,
          rulesCount: role.rules?.length ?? 0,
          createdAt: role.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(roles, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_role
  server.tool(
    'k8s_get_role',
    'Get details of a specific Role',
    {
      name: z.string().describe('Role name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.readNamespacedRole({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_role_bindings
  server.tool(
    'k8s_list_role_bindings',
    'List RoleBindings in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.listNamespacedRoleBinding({ namespace });
        const bindings = res.items.map((rb) => ({
          name: rb.metadata?.name,
          namespace: rb.metadata?.namespace,
          roleRef: { kind: rb.roleRef.kind, name: rb.roleRef.name },
          subjectsCount: rb.subjects?.length ?? 0,
          createdAt: rb.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(bindings, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_role_binding
  server.tool(
    'k8s_get_role_binding',
    'Get details of a specific RoleBinding',
    {
      name: z.string().describe('RoleBinding name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getRbacAuthorizationV1Api();
        const res = await api.readNamespacedRoleBinding({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
