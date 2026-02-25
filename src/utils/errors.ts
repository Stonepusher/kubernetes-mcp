import * as k8s from '@kubernetes/client-node';

export function formatK8sError(err: unknown): string {
  // @kubernetes/client-node v1.x uses ApiException<T>
  if (err instanceof k8s.ApiException) {
    const body = err.body as { message?: string } | undefined;
    if (body?.message) {
      return `Kubernetes API error (${err.code}): ${body.message}`;
    }
    return `Kubernetes API error (${err.code}): ${JSON.stringify(err.body)}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
