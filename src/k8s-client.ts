import * as k8s from '@kubernetes/client-node';

let kubeConfig: k8s.KubeConfig | null = null;

export function getKubeConfig(): k8s.KubeConfig {
  if (!kubeConfig) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    kubeConfig = kc;
  }
  return kubeConfig;
}

export function getCoreV1Api(): k8s.CoreV1Api {
  return getKubeConfig().makeApiClient(k8s.CoreV1Api);
}

export function getAppsV1Api(): k8s.AppsV1Api {
  return getKubeConfig().makeApiClient(k8s.AppsV1Api);
}

export function getNetworkingV1Api(): k8s.NetworkingV1Api {
  return getKubeConfig().makeApiClient(k8s.NetworkingV1Api);
}

export function getStorageV1Api(): k8s.StorageV1Api {
  return getKubeConfig().makeApiClient(k8s.StorageV1Api);
}

export function invalidateKubeConfig(): void {
  kubeConfig = null;
}

export function getBatchV1Api(): k8s.BatchV1Api {
  return getKubeConfig().makeApiClient(k8s.BatchV1Api);
}

export function getRbacAuthorizationV1Api(): k8s.RbacAuthorizationV1Api {
  return getKubeConfig().makeApiClient(k8s.RbacAuthorizationV1Api);
}

export function getAutoscalingV2Api(): k8s.AutoscalingV2Api {
  return getKubeConfig().makeApiClient(k8s.AutoscalingV2Api);
}

export function getApiExtensionsV1Api(): k8s.ApiextensionsV1Api {
  return getKubeConfig().makeApiClient(k8s.ApiextensionsV1Api);
}
