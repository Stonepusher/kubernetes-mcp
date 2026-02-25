import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execa } from 'execa';
import { registerAllTools } from './tools/index.js';

async function checkPrerequisites(): Promise<void> {
  const checks = [
    { cmd: 'kubectl', args: ['version', '--client', '--output=json'], name: 'kubectl' },
    { cmd: 'helm', args: ['version', '--short'], name: 'helm' },
  ];

  for (const check of checks) {
    try {
      await execa(check.cmd, check.args);
    } catch {
      process.stderr.write(
        `ERROR: '${check.name}' is not installed or not found in PATH.\n` +
          `Please install ${check.name} before starting the kubernetes-mcp server.\n`,
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  await checkPrerequisites();

  const server = new McpServer({
    name: 'kubernetes',
    version: '1.0.0',
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
