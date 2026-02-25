import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';
import { PassThrough } from 'stream';
import { getKubeConfig } from '../k8s-client.js';
import { formatK8sError } from '../utils/errors.js';

interface ExecResult {
  stdout: string;
  stderr: string;
  status: k8s.V1Status | null;
}

function execInPod(
  kc: k8s.KubeConfig,
  namespace: string,
  podName: string,
  containerName: string | undefined,
  command: string[],
  timeoutMs: number,
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const exec = new k8s.Exec(kc);
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    stdoutStream.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    stderrStream.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`exec timed out after ${timeoutMs / 1000}s`));
      }
    }, timeoutMs);

    exec
      .exec(
        namespace,
        podName,
        containerName ?? '',
        command,
        stdoutStream,
        stderrStream,
        null,
        false,
        (status: k8s.V1Status) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
            stderr: Buffer.concat(stderrChunks).toString('utf-8'),
            status,
          });
        },
      )
      .catch((err: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

export function registerExecTools(server: McpServer): void {
  server.tool(
    'k8s_exec',
    'Execute a command in a running pod container',
    {
      podName: z.string().describe('Pod name'),
      namespace: z.string().default('default').describe('Kubernetes namespace'),
      containerName: z.string().optional().describe('Container name (required for multi-container pods)'),
      command: z.array(z.string()).min(1).describe('Command and arguments to execute, e.g. ["ls", "-la"]'),
      timeoutSeconds: z.number().int().min(1).max(300).default(30).describe('Execution timeout in seconds (max 300)'),
    },
    async ({ podName, namespace, containerName, command, timeoutSeconds }) => {
      try {
        const kc = getKubeConfig();
        const result = await execInPod(kc, namespace, podName, containerName, command, timeoutSeconds * 1000);

        const output: Record<string, unknown> = {
          stdout: result.stdout,
          stderr: result.stderr,
        };

        if (result.status) {
          output.exitStatus = result.status.status;
          if (result.status.message) {
            output.message = result.status.message;
          }
        }

        return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
