import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { runCommand } from '../utils/shell.js';
import { formatK8sError } from '../utils/errors.js';

async function writeValuesFile(values: Record<string, unknown>): Promise<string> {
  const filePath = path.join(os.tmpdir(), `helm-values-${randomUUID()}.json`);
  await fs.writeFile(filePath, JSON.stringify(values), 'utf-8');
  return filePath;
}

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // best-effort cleanup
  }
}

export function registerHelmTools(server: McpServer): void {
  // helm_list
  server.tool(
    'helm_list',
    'List Helm releases',
    {
      namespace: z.string().optional().describe('Namespace to list releases from'),
      allNamespaces: z.boolean().default(false).describe('List releases across all namespaces'),
    },
    async ({ namespace, allNamespaces }) => {
      try {
        const args = ['list', '--output=json'];
        if (allNamespaces) {
          args.push('--all-namespaces');
        } else if (namespace) {
          args.push('--namespace', namespace);
        }
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_install
  server.tool(
    'helm_install',
    'Install a Helm chart',
    {
      releaseName: z.string().describe('Release name'),
      chart: z.string().describe('Chart name or path (e.g. bitnami/nginx or ./mychart)'),
      namespace: z.string().default('default').describe('Namespace to install into'),
      createNamespace: z.boolean().default(false).describe('Create namespace if it does not exist'),
      values: z.record(z.unknown()).optional().describe('Values to pass to the chart (as JSON object)'),
      version: z.string().optional().describe('Chart version to install'),
      wait: z.boolean().default(false).describe('Wait for resources to be ready'),
    },
    async ({ releaseName, chart, namespace, createNamespace, values, version, wait }) => {
      let valuesFile: string | undefined;
      try {
        const args = ['install', releaseName, chart, '--namespace', namespace, '--output=json'];
        if (createNamespace) args.push('--create-namespace');
        if (version) args.push('--version', version);
        if (wait) args.push('--wait');
        if (values && Object.keys(values).length > 0) {
          valuesFile = await writeValuesFile(values);
          args.push('--values', valuesFile);
        }
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      } finally {
        if (valuesFile) await cleanupFile(valuesFile);
      }
    },
  );

  // helm_upgrade
  server.tool(
    'helm_upgrade',
    'Upgrade (or install) a Helm release',
    {
      releaseName: z.string().describe('Release name'),
      chart: z.string().describe('Chart name or path'),
      namespace: z.string().default('default').describe('Namespace of the release'),
      install: z.boolean().default(true).describe('Install if release does not exist (--install flag)'),
      values: z.record(z.unknown()).optional().describe('Values to override (merged with existing)'),
      version: z.string().optional().describe('Chart version'),
      reuseValues: z.boolean().default(false).describe('Reuse previous release values'),
      wait: z.boolean().default(false).describe('Wait for resources to be ready'),
    },
    async ({ releaseName, chart, namespace, install, values, version, reuseValues, wait }) => {
      let valuesFile: string | undefined;
      try {
        const args = ['upgrade', releaseName, chart, '--namespace', namespace, '--output=json'];
        if (install) args.push('--install');
        if (version) args.push('--version', version);
        if (reuseValues) args.push('--reuse-values');
        if (wait) args.push('--wait');
        if (values && Object.keys(values).length > 0) {
          valuesFile = await writeValuesFile(values);
          args.push('--values', valuesFile);
        }
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      } finally {
        if (valuesFile) await cleanupFile(valuesFile);
      }
    },
  );

  // helm_rollback
  server.tool(
    'helm_rollback',
    'Rollback a Helm release to a previous revision',
    {
      releaseName: z.string().describe('Release name'),
      namespace: z.string().default('default').describe('Namespace of the release'),
      revision: z.number().int().min(0).default(0).describe('Revision to rollback to (0 = previous)'),
      wait: z.boolean().default(false).describe('Wait for resources to be ready'),
    },
    async ({ releaseName, namespace, revision, wait }) => {
      try {
        const args = ['rollback', releaseName, String(revision), '--namespace', namespace];
        if (wait) args.push('--wait');
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout || 'Rollback successful.' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_uninstall
  server.tool(
    'helm_uninstall',
    'Uninstall a Helm release',
    {
      releaseName: z.string().describe('Release name'),
      namespace: z.string().default('default').describe('Namespace of the release'),
      keepHistory: z.boolean().default(false).describe('Retain release history after uninstall'),
    },
    async ({ releaseName, namespace, keepHistory }) => {
      try {
        const args = ['uninstall', releaseName, '--namespace', namespace];
        if (keepHistory) args.push('--keep-history');
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout || 'Release uninstalled successfully.' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_get_values
  server.tool(
    'helm_get_values',
    'Get values for an installed Helm release',
    {
      releaseName: z.string().describe('Release name'),
      namespace: z.string().default('default').describe('Namespace of the release'),
      all: z.boolean().default(false).describe('Show all values including defaults'),
    },
    async ({ releaseName, namespace, all }) => {
      try {
        const args = ['get', 'values', releaseName, '--namespace', namespace, '--output=json'];
        if (all) args.push('--all');
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_show_chart_values
  server.tool(
    'helm_show_chart_values',
    'Show default values for a Helm chart (before installation)',
    {
      chart: z.string().describe('Chart name or path (e.g. bitnami/nginx)'),
      version: z.string().optional().describe('Chart version'),
    },
    async ({ chart, version }) => {
      try {
        const args = ['show', 'values', chart];
        if (version) args.push('--version', version);
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_repo_add
  server.tool(
    'helm_repo_add',
    'Add a Helm chart repository',
    {
      name: z.string().describe('Repository alias name'),
      url: z.string().url().describe('Repository URL'),
      username: z.string().optional().describe('Repository username (if auth required)'),
      password: z.string().optional().describe('Repository password (if auth required)'),
    },
    async ({ name, url, username, password }) => {
      try {
        const args = ['repo', 'add', name, url];
        if (username) args.push('--username', username);
        if (password) args.push('--password', password);
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout || `Repository '${name}' added successfully.` }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_repo_update
  server.tool(
    'helm_repo_update',
    'Update Helm chart repositories (helm repo update)',
    {},
    async () => {
      try {
        const result = await runCommand('helm', ['repo', 'update']);
        return { content: [{ type: 'text', text: result.stdout || 'Repositories updated successfully.' }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );

  // helm_history
  server.tool(
    'helm_history',
    'Get revision history of a Helm release',
    {
      releaseName: z.string().describe('Release name'),
      namespace: z.string().default('default').describe('Namespace of the release'),
      max: z.number().int().min(1).max(256).default(10).describe('Maximum number of revisions to return'),
    },
    async ({ releaseName, namespace, max }) => {
      try {
        const args = [
          'history',
          releaseName,
          '--namespace',
          namespace,
          '--max',
          String(max),
          '--output=json',
        ];
        const result = await runCommand('helm', args);
        return { content: [{ type: 'text', text: result.stdout }] };
      } catch (err) {
        return { content: [{ type: 'text', text: formatK8sError(err) }], isError: true };
      }
    },
  );
}
