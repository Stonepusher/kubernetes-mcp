import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';
import * as net from 'net';
import { getKubeConfig } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

interface PortForwardSession {
  server: net.Server;
  namespace: string;
  podName: string;
  localPort: number;
  remotePort: number;
  createdAt: string;
}

const sessions = new Map<string, PortForwardSession>();

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', reject);
  });
}

function makeSessionId(namespace: string, podName: string, remotePort: number, localPort: number): string {
  return `${namespace}/${podName}:${remotePort}@${localPort}`;
}

export function registerPortForwardTools(server: McpServer): void {
  server.tool(
    'k8s_port_forward_start',
    'Start a port-forward tunnel to a pod',
    {
      podName: z.string().describe('Pod name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      remotePort: z.number().int().min(1).max(65535).describe('Port on the pod to forward to'),
      localPort: z.number().int().min(0).max(65535).default(0).describe('Local port to listen on (0 = auto-assign)'),
    },
    async ({ podName, namespace, remotePort, localPort }) => {
      try {
        const kc = getKubeConfig();
        const portForward = new k8s.PortForward(kc);

        const assignedPort = localPort === 0 ? await getFreePort() : localPort;

        const netServer = net.createServer((socket) => {
          portForward.portForward(namespace, podName, [remotePort], socket, null, socket).catch((err: unknown) => {
            socket.destroy(err instanceof Error ? err : new Error(String(err)));
          });
        });

        await new Promise<void>((resolve, reject) => {
          netServer.listen(assignedPort, '127.0.0.1', () => resolve());
          netServer.once('error', reject);
        });

        const sessionId = makeSessionId(namespace, podName, remotePort, assignedPort);
        sessions.set(sessionId, {
          server: netServer,
          namespace,
          podName,
          localPort: assignedPort,
          remotePort,
          createdAt: new Date().toISOString(),
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessionId,
                localPort: assignedPort,
                remotePort,
                podName,
                namespace,
                address: `127.0.0.1:${assignedPort}`,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  server.tool(
    'k8s_port_forward_stop',
    'Stop an active port-forward tunnel',
    {
      sessionId: z.string().describe('Session ID returned by k8s_port_forward_start'),
    },
    async ({ sessionId }) => {
      const session = sessions.get(sessionId);
      if (!session) {
        return {
          content: [{ type: 'text', text: `No active port-forward session found with ID: ${sessionId}` }],
          isError: true,
        };
      }

      await new Promise<void>((resolve) => session.server.close(() => resolve()));
      sessions.delete(sessionId);

      return {
        content: [{ type: 'text', text: `Port-forward session '${sessionId}' stopped successfully.` }],
      };
    },
  );

  server.tool(
    'k8s_port_forward_list',
    'List all active port-forward sessions',
    {},
    async () => {
      const list = Array.from(sessions.entries()).map(([id, s]) => ({
        sessionId: id,
        namespace: s.namespace,
        podName: s.podName,
        localPort: s.localPort,
        remotePort: s.remotePort,
        address: `127.0.0.1:${s.localPort}`,
        createdAt: s.createdAt,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    },
  );
}
