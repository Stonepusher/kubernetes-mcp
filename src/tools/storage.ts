import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCoreV1Api, getStorageV1Api } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

export function registerStorageTools(server: McpServer): void {
  // k8s_list_persistent_volumes
  server.tool(
    'k8s_list_persistent_volumes',
    'List all PersistentVolumes in the cluster (cluster-scoped)',
    {},
    async () => {
      try {
        const api = getCoreV1Api();
        const res = await api.listPersistentVolume({});
        const pvs = res.items.map((pv) => ({
          name: pv.metadata?.name,
          capacity: pv.spec?.capacity,
          accessModes: pv.spec?.accessModes,
          storageClassName: pv.spec?.storageClassName,
          status: pv.status?.phase,
          claimRef: pv.spec?.claimRef
            ? { name: pv.spec.claimRef.name, namespace: pv.spec.claimRef.namespace }
            : null,
          reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
          createdAt: pv.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(pvs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_persistent_volume
  server.tool(
    'k8s_get_persistent_volume',
    'Get details of a specific PersistentVolume',
    {
      name: z.string().describe('PersistentVolume name'),
    },
    async ({ name }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readPersistentVolume({ name });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_persistent_volume_claims
  server.tool(
    'k8s_list_persistent_volume_claims',
    'List PersistentVolumeClaims in a namespace',
    {
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.listNamespacedPersistentVolumeClaim({ namespace });
        const pvcs = res.items.map((pvc) => ({
          name: pvc.metadata?.name,
          namespace: pvc.metadata?.namespace,
          status: pvc.status?.phase,
          volumeName: pvc.spec?.volumeName,
          capacity: pvc.status?.capacity,
          storageClassName: pvc.spec?.storageClassName,
          accessModes: pvc.spec?.accessModes,
          createdAt: pvc.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(pvcs, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_persistent_volume_claim
  server.tool(
    'k8s_get_persistent_volume_claim',
    'Get details of a specific PersistentVolumeClaim',
    {
      name: z.string().describe('PersistentVolumeClaim name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
    },
    async ({ name, namespace }) => {
      try {
        const api = getCoreV1Api();
        const res = await api.readNamespacedPersistentVolumeClaim({ name, namespace });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_list_storage_classes
  server.tool(
    'k8s_list_storage_classes',
    'List all StorageClasses in the cluster',
    {},
    async () => {
      try {
        const api = getStorageV1Api();
        const res = await api.listStorageClass({});
        const storageClasses = res.items.map((sc) => ({
          name: sc.metadata?.name,
          provisioner: sc.provisioner,
          reclaimPolicy: sc.reclaimPolicy,
          volumeBindingMode: sc.volumeBindingMode,
          allowVolumeExpansion: sc.allowVolumeExpansion ?? false,
          isDefault:
            sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
          createdAt: sc.metadata?.creationTimestamp,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(storageClasses, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // k8s_get_storage_class
  server.tool(
    'k8s_get_storage_class',
    'Get full details of a specific StorageClass',
    {
      name: z.string().describe('StorageClass name'),
    },
    async ({ name }) => {
      try {
        const api = getStorageV1Api();
        const res = await api.readStorageClass({ name });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
