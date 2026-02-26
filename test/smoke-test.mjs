#!/usr/bin/env node
/**
 * Kubernetes MCP Server — Smoke Test
 *
 * Tests read-only tools against a real cluster by driving the MCP server
 * over stdio. No cluster mutations are performed.
 *
 * Usage:  npm test
 * Exit:   0 = all assertions passed (skips are ok), 1 = any failure
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, '..', 'dist', 'index.js');
const TOOL_COUNT = 68;
const SYS_NS = 'kube-system';

// ─── MCP stdio client ────────────────────────────────────────────────────────

class McpClient {
  constructor(proc) {
    this.proc = proc;
    this.pending = new Map(); // id → { resolve, reject }
    this.nextId = 1;

    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    rl.on('line', (line) => {
      line = line.trim();
      if (!line) return;
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`RPC ${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    });

    proc.on('close', (code) => {
      // Reject any still-pending requests
      for (const [id, { reject }] of this.pending) {
        reject(new Error(`Server exited (code ${code}) while waiting for response id=${id}`));
      }
      this.pending.clear();
    });
  }

  async request(method, params = {}, timeoutMs = 30_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout (${timeoutMs}ms) on '${method}'`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject:  (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc.stdin.write(
        JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n',
      );
    });
  }

  notify(method, params = {}) {
    this.proc.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n',
    );
  }

  close() { this.proc.stdin.end(); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tryJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Call an MCP tool and return { text, isError, parsed }.
 * Never throws — server-level errors are returned as { isError: true }.
 */
async function call(client, toolName, args = {}, timeoutMs = 30_000) {
  try {
    const result = await client.request(
      'tools/call',
      { name: toolName, arguments: args },
      timeoutMs,
    );
    const text = result?.content?.[0]?.text ?? '';
    return { text, isError: result?.isError ?? false, parsed: tryJson(text) };
  } catch (err) {
    return { text: err.message, isError: true, parsed: null };
  }
}

// ─── Result tracking ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(label) {
  console.log(`  \x1b[32m[PASS]\x1b[0m ${label}`);
  passed++;
}
function fail(label, detail = '') {
  console.log(`  \x1b[31m[FAIL]\x1b[0m ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}
function skip(label, reason = '') {
  console.log(`  \x1b[33m[SKIP]\x1b[0m ${label}${reason ? ' — ' + reason : ''}`);
  skipped++;
}

/**
 * Assert a boolean condition; log PASS or FAIL.
 */
function assert(label, condition, failDetail = 'assertion failed') {
  if (condition) pass(label);
  else fail(label, failDetail);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Kubernetes MCP Server — Smoke Test');
  console.log('='.repeat(50));

  // Check dist/index.js exists
  const { existsSync } = await import('fs');
  if (!existsSync(SERVER_PATH)) {
    console.error(`\nERROR: ${SERVER_PATH} not found. Run 'npm run build' first.\n`);
    process.exit(1);
  }

  const proc = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  proc.on('error', (err) => {
    console.error('Failed to start MCP server:', err.message);
    process.exit(1);
  });

  const client = new McpClient(proc);
  const t0 = Date.now();

  try {
    // ── 1. Protocol handshake ─────────────────────────────────────────────────
    console.log('\n── Phase 1: Handshake ──────────────────────────────────────');

    const initResult = await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '1.0.0' },
    });

    assert(
      'initialize — serverInfo.name === "kubernetes"',
      initResult?.serverInfo?.name === 'kubernetes',
      `got: ${JSON.stringify(initResult?.serverInfo?.name)}`,
    );

    client.notify('notifications/initialized');

    // ── 2. Tool inventory ─────────────────────────────────────────────────────
    console.log('\n── Phase 2: Tool inventory ─────────────────────────────────');

    const toolsResult = await client.request('tools/list');
    const toolNames = (toolsResult?.tools ?? []).map((t) => t.name);

    assert(
      `tools/list — count === ${TOOL_COUNT}`,
      toolNames.length === TOOL_COUNT,
      `got ${toolNames.length}: ${toolNames.join(', ')}`,
    );

    // ── 3. Tool assertions ────────────────────────────────────────────────────
    console.log('\n── Phase 3: Tool assertions ────────────────────────────────');

    // ---- k8s_list_namespaces ------------------------------------------------
    const nsRes = await call(client, 'k8s_list_namespaces');
    const namespaces = nsRes.parsed ?? [];
    assert(
      'k8s_list_namespaces — returns non-empty array',
      !nsRes.isError && Array.isArray(namespaces) && namespaces.length > 0,
      nsRes.isError ? nsRes.text.slice(0, 120) : `count=${namespaces.length}`,
    );

    // ---- k8s_list_pods ------------------------------------------------------
    const podsRes = await call(client, 'k8s_list_pods', { namespace: SYS_NS });
    const pods = podsRes.parsed ?? [];
    assert(
      `k8s_list_pods — non-empty array in ${SYS_NS}`,
      !podsRes.isError && Array.isArray(pods) && pods.length > 0,
      podsRes.isError ? podsRes.text.slice(0, 120) : `count=${pods.length}`,
    );

    const firstPod = pods[0];
    const runningPod = pods.find((p) => p.phase === 'Running');

    // ---- k8s_get_pod --------------------------------------------------------
    if (firstPod?.name) {
      const r = await call(client, 'k8s_get_pod', { name: firstPod.name, namespace: SYS_NS });
      assert(
        `k8s_get_pod — metadata.name matches (${firstPod.name})`,
        !r.isError && r.parsed?.metadata?.name === firstPod.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_pod', 'no pods in kube-system');
    }

    // ---- k8s_list_deployments -----------------------------------------------
    const deploysRes = await call(client, 'k8s_list_deployments', { namespace: SYS_NS });
    const deployments = deploysRes.parsed ?? [];
    assert(
      `k8s_list_deployments — returns array for ${SYS_NS}`,
      !deploysRes.isError && Array.isArray(deployments),
      deploysRes.isError ? deploysRes.text.slice(0, 120) : 'not an array',
    );

    const firstDeploy = deployments[0];

    // ---- k8s_get_deployment -------------------------------------------------
    if (firstDeploy?.name) {
      const r = await call(client, 'k8s_get_deployment', { name: firstDeploy.name, namespace: SYS_NS });
      assert(
        `k8s_get_deployment — metadata.name matches (${firstDeploy.name})`,
        !r.isError && r.parsed?.metadata?.name === firstDeploy.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_deployment', `no deployments in ${SYS_NS}`);
    }

    // ---- k8s_list_services --------------------------------------------------
    const svcsRes = await call(client, 'k8s_list_services', { namespace: SYS_NS });
    const services = svcsRes.parsed ?? [];
    assert(
      `k8s_list_services — non-empty array in ${SYS_NS}`,
      !svcsRes.isError && Array.isArray(services) && services.length > 0,
      svcsRes.isError ? svcsRes.text.slice(0, 120) : `count=${services.length}`,
    );

    const firstSvc = services[0];

    // ---- k8s_get_service ----------------------------------------------------
    if (firstSvc?.name) {
      const r = await call(client, 'k8s_get_service', { name: firstSvc.name, namespace: SYS_NS });
      assert(
        `k8s_get_service — metadata.name matches (${firstSvc.name})`,
        !r.isError && r.parsed?.metadata?.name === firstSvc.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_service', `no services in ${SYS_NS}`);
    }

    // ---- k8s_list_configmaps ------------------------------------------------
    const cmsRes = await call(client, 'k8s_list_configmaps', { namespace: SYS_NS });
    const configmaps = cmsRes.parsed ?? [];
    assert(
      `k8s_list_configmaps — returns array for ${SYS_NS}`,
      !cmsRes.isError && Array.isArray(configmaps),
      cmsRes.isError ? cmsRes.text.slice(0, 120) : 'not an array',
    );

    const firstCm = configmaps[0];

    // ---- k8s_get_configmap --------------------------------------------------
    if (firstCm?.name) {
      const r = await call(client, 'k8s_get_configmap', { name: firstCm.name, namespace: SYS_NS });
      assert(
        `k8s_get_configmap — metadata.name matches (${firstCm.name})`,
        !r.isError && r.parsed?.metadata?.name === firstCm.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_configmap', `no configmaps in ${SYS_NS}`);
    }

    // ---- k8s_list_secrets ---------------------------------------------------
    const secretsRes = await call(client, 'k8s_list_secrets', { namespace: SYS_NS });
    const secrets = secretsRes.parsed ?? [];
    assert(
      `k8s_list_secrets — returns array for ${SYS_NS}`,
      !secretsRes.isError && Array.isArray(secrets),
      secretsRes.isError ? secretsRes.text.slice(0, 120) : 'not an array',
    );

    const firstSecret = secrets[0];

    // ---- k8s_get_secret -----------------------------------------------------
    if (firstSecret?.name) {
      const r = await call(client, 'k8s_get_secret', { name: firstSecret.name, namespace: SYS_NS });
      assert(
        `k8s_get_secret — metadata.name matches (${firstSecret.name})`,
        !r.isError && r.parsed?.metadata?.name === firstSecret.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_secret', `no secrets in ${SYS_NS}`);
    }

    // ---- k8s_get_events -----------------------------------------------------
    {
      const r = await call(client, 'k8s_get_events', { namespace: SYS_NS });
      assert(
        `k8s_get_events — returns array for ${SYS_NS} (may be empty)`,
        !r.isError && Array.isArray(r.parsed),
        r.isError ? r.text.slice(0, 120) : `got: ${typeof r.parsed}`,
      );
    }

    // ---- k8s_get_pod_logs ---------------------------------------------------
    if (runningPod?.name) {
      const r = await call(
        client,
        'k8s_get_pod_logs',
        { podName: runningPod.name, namespace: SYS_NS, tailLines: 10 },
        25_000,
      );
      assert(
        `k8s_get_pod_logs — returns text (${runningPod.name})`,
        !r.isError,
        r.text.slice(0, 120),
      );
    } else {
      skip('k8s_get_pod_logs', `no Running pods in ${SYS_NS}`);
    }

    // ---- k8s_exec -----------------------------------------------------------
    if (runningPod?.name) {
      const r = await call(
        client,
        'k8s_exec',
        { podName: runningPod.name, namespace: SYS_NS, command: ['sh', '-c', 'echo hello'], timeoutSeconds: 15 },
        25_000,
      );
      if (r.isError) {
        // Some system pods (etcd, kube-proxy) lack a shell — treat as skip
        skip('k8s_exec', `pod lacks shell or exec not supported: ${r.text.slice(0, 80)}`);
      } else {
        assert(
          `k8s_exec — stdout contains "hello" (${runningPod.name})`,
          r.parsed?.stdout?.includes('hello') === true,
          `stdout: ${JSON.stringify(r.parsed?.stdout)}`,
        );
      }
    } else {
      skip('k8s_exec', `no Running pods in ${SYS_NS}`);
    }

    // ---- k8s_port_forward_start / list / stop --------------------------------
    if (runningPod?.name) {
      const startR = await call(
        client,
        'k8s_port_forward_start',
        { podName: runningPod.name, namespace: SYS_NS, remotePort: 80, localPort: 0 },
        20_000,
      );

      if (startR.isError) {
        skip('k8s_port_forward_start', startR.text.slice(0, 80));
        skip('k8s_port_forward_list', 'start failed');
        skip('k8s_port_forward_stop', 'start failed');
      } else {
        const sessionId = startR.parsed?.sessionId;
        assert(
          'k8s_port_forward_start — returns sessionId',
          typeof sessionId === 'string' && sessionId.length > 0,
          `sessionId: ${JSON.stringify(sessionId)}`,
        );

        // list
        const listR = await call(client, 'k8s_port_forward_list');
        const sessions = listR.parsed ?? [];
        assert(
          'k8s_port_forward_list — active session appears in list',
          !listR.isError && Array.isArray(sessions) && sessions.some((s) => s.sessionId === sessionId),
          `sessions: ${JSON.stringify(sessions?.map((s) => s.sessionId))}`,
        );

        // stop
        if (sessionId) {
          const stopR = await call(client, 'k8s_port_forward_stop', { sessionId });
          assert(
            'k8s_port_forward_stop — reports success',
            !stopR.isError && stopR.text.toLowerCase().includes('stopped'),
            stopR.text.slice(0, 80),
          );
        } else {
          skip('k8s_port_forward_stop', 'no sessionId returned by start');
        }
      }
    } else {
      skip('k8s_port_forward_start', `no Running pods in ${SYS_NS}`);
      skip('k8s_port_forward_list', `no Running pods in ${SYS_NS}`);
      skip('k8s_port_forward_stop', `no Running pods in ${SYS_NS}`);
    }

    // ---- helm_list ----------------------------------------------------------
    const helmListRes = await call(client, 'helm_list', { allNamespaces: true });
    const releases = helmListRes.parsed ?? [];
    assert(
      'helm_list — returns array',
      !helmListRes.isError && Array.isArray(releases),
      helmListRes.isError ? helmListRes.text.slice(0, 120) : `got: ${typeof releases}`,
    );

    const firstRelease = releases[0];

    // ---- helm_get_values ----------------------------------------------------
    if (firstRelease?.name) {
      const ns = firstRelease.namespace || 'default';
      const r = await call(client, 'helm_get_values', { releaseName: firstRelease.name, namespace: ns });
      assert(
        `helm_get_values — returns without error (${firstRelease.name})`,
        !r.isError,
        r.text.slice(0, 120),
      );
    } else {
      skip('helm_get_values', 'no helm releases found');
    }

    // ---- helm_history -------------------------------------------------------
    if (firstRelease?.name) {
      const ns = firstRelease.namespace || 'default';
      const r = await call(client, 'helm_history', { releaseName: firstRelease.name, namespace: ns });
      assert(
        `helm_history — returns array of revisions (${firstRelease.name})`,
        !r.isError && Array.isArray(r.parsed),
        r.isError ? r.text.slice(0, 120) : `got: ${typeof r.parsed}`,
      );
    } else {
      skip('helm_history', 'no helm releases found');
    }

    // ---- helm_show_chart_values (OCI, requires network) ---------------------
    {
      const r = await call(
        client,
        'helm_show_chart_values',
        { chart: 'oci://registry-1.docker.io/bitnamicharts/nginx' },
        60_000,
      );
      if (r.isError) {
        skip('helm_show_chart_values', `network/registry error: ${r.text.slice(0, 80)}`);
      } else {
        assert(
          'helm_show_chart_values — returns non-empty YAML',
          r.text.length > 0,
          'empty response',
        );
      }
    }

    // ---- helm_repo_update ---------------------------------------------------
    {
      const r = await call(client, 'helm_repo_update', {}, 30_000);
      if (r.isError && /no repositories found/i.test(r.text)) {
        skip('helm_repo_update', 'no helm repos configured locally');
      } else {
        assert(
          'helm_repo_update — completes without unexpected error',
          !r.isError,
          r.text.slice(0, 120),
        );
      }
    }

    // ---- k8s_list_nodes -----------------------------------------------------
    const nodesRes = await call(client, 'k8s_list_nodes');
    const nodes = nodesRes.parsed ?? [];
    assert(
      'k8s_list_nodes — returns non-empty array',
      !nodesRes.isError && Array.isArray(nodes) && nodes.length > 0,
      nodesRes.isError ? nodesRes.text.slice(0, 120) : `count=${nodes.length}`,
    );

    const firstNode = nodes[0];

    // ---- k8s_get_node -------------------------------------------------------
    if (firstNode?.name) {
      const r = await call(client, 'k8s_get_node', { name: firstNode.name });
      assert(
        `k8s_get_node — metadata.name matches (${firstNode.name})`,
        !r.isError && r.parsed?.metadata?.name === firstNode.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_node', 'no nodes found');
    }

    // ---- k8s_list_daemonsets ------------------------------------------------
    const dsRes = await call(client, 'k8s_list_daemonsets', { namespace: SYS_NS });
    const daemonsets = dsRes.parsed ?? [];
    assert(
      `k8s_list_daemonsets — returns array for ${SYS_NS}`,
      !dsRes.isError && Array.isArray(daemonsets),
      dsRes.isError ? dsRes.text.slice(0, 120) : 'not an array',
    );

    const firstDs = daemonsets[0];

    // ---- k8s_get_daemonset --------------------------------------------------
    if (firstDs?.name) {
      const r = await call(client, 'k8s_get_daemonset', { name: firstDs.name, namespace: SYS_NS });
      assert(
        `k8s_get_daemonset — metadata.name matches (${firstDs.name})`,
        !r.isError && r.parsed?.metadata?.name === firstDs.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_daemonset', `no daemonsets in ${SYS_NS}`);
    }

    // ---- k8s_list_statefulsets ----------------------------------------------
    const ssRes = await call(client, 'k8s_list_statefulsets', { namespace: SYS_NS });
    const statefulsets = ssRes.parsed ?? [];
    assert(
      `k8s_list_statefulsets — returns array for ${SYS_NS}`,
      !ssRes.isError && Array.isArray(statefulsets),
      ssRes.isError ? ssRes.text.slice(0, 120) : 'not an array',
    );

    const firstSs = statefulsets[0];

    // ---- k8s_get_statefulset ------------------------------------------------
    if (firstSs?.name) {
      const r = await call(client, 'k8s_get_statefulset', { name: firstSs.name, namespace: SYS_NS });
      assert(
        `k8s_get_statefulset — metadata.name matches (${firstSs.name})`,
        !r.isError && r.parsed?.metadata?.name === firstSs.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_statefulset', `no statefulsets in ${SYS_NS}`);
    }

    // ---- k8s_list_persistent_volumes ----------------------------------------
    const pvsRes = await call(client, 'k8s_list_persistent_volumes');
    const pvs = pvsRes.parsed ?? [];
    assert(
      'k8s_list_persistent_volumes — returns array',
      !pvsRes.isError && Array.isArray(pvs),
      pvsRes.isError ? pvsRes.text.slice(0, 120) : 'not an array',
    );

    const firstPv = pvs[0];

    // ---- k8s_get_persistent_volume ------------------------------------------
    if (firstPv?.name) {
      const r = await call(client, 'k8s_get_persistent_volume', { name: firstPv.name });
      assert(
        `k8s_get_persistent_volume — metadata.name matches (${firstPv.name})`,
        !r.isError && r.parsed?.metadata?.name === firstPv.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_persistent_volume', 'no PersistentVolumes found');
    }

    // ---- k8s_list_persistent_volume_claims ----------------------------------
    const pvcsRes = await call(client, 'k8s_list_persistent_volume_claims', { namespace: 'default' });
    const pvcs = pvcsRes.parsed ?? [];
    assert(
      'k8s_list_persistent_volume_claims — returns array for default',
      !pvcsRes.isError && Array.isArray(pvcs),
      pvcsRes.isError ? pvcsRes.text.slice(0, 120) : 'not an array',
    );

    const firstPvc = pvcs[0];

    // ---- k8s_get_persistent_volume_claim ------------------------------------
    if (firstPvc?.name) {
      const r = await call(client, 'k8s_get_persistent_volume_claim', { name: firstPvc.name, namespace: 'default' });
      assert(
        `k8s_get_persistent_volume_claim — metadata.name matches (${firstPvc.name})`,
        !r.isError && r.parsed?.metadata?.name === firstPvc.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_persistent_volume_claim', 'no PVCs in default namespace');
    }

    // ---- k8s_list_storage_classes -------------------------------------------
    const scRes = await call(client, 'k8s_list_storage_classes');
    const storageClasses = scRes.parsed ?? [];
    assert(
      'k8s_list_storage_classes — returns array',
      !scRes.isError && Array.isArray(storageClasses),
      scRes.isError ? scRes.text.slice(0, 120) : 'not an array',
    );

    // ---- k8s_list_ingresses -------------------------------------------------
    const ingRes = await call(client, 'k8s_list_ingresses', { namespace: 'default' });
    const ingresses = ingRes.parsed ?? [];
    assert(
      'k8s_list_ingresses — returns array for default (may be empty)',
      !ingRes.isError && Array.isArray(ingresses),
      ingRes.isError ? ingRes.text.slice(0, 120) : 'not an array',
    );

    const firstIng = ingresses[0];

    // ---- k8s_get_ingress ----------------------------------------------------
    if (firstIng?.name) {
      const r = await call(client, 'k8s_get_ingress', { name: firstIng.name, namespace: 'default' });
      assert(
        `k8s_get_ingress — metadata.name matches (${firstIng.name})`,
        !r.isError && r.parsed?.metadata?.name === firstIng.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_ingress', 'no ingresses in default namespace');
    }

    // ---- k8s_list_jobs ------------------------------------------------------
    const jobsRes = await call(client, 'k8s_list_jobs', { namespace: 'default' });
    const jobs = jobsRes.parsed ?? [];
    assert(
      'k8s_list_jobs — returns array for default (may be empty)',
      !jobsRes.isError && Array.isArray(jobs),
      jobsRes.isError ? jobsRes.text.slice(0, 120) : 'not an array',
    );

    const firstJob = jobs[0];

    // ---- k8s_get_job --------------------------------------------------------
    if (firstJob?.name) {
      const r = await call(client, 'k8s_get_job', { name: firstJob.name, namespace: 'default' });
      assert(
        `k8s_get_job — metadata.name matches (${firstJob.name})`,
        !r.isError && r.parsed?.metadata?.name === firstJob.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_job', 'no jobs in default namespace');
    }

    // ---- k8s_list_cronjobs --------------------------------------------------
    const cjRes = await call(client, 'k8s_list_cronjobs', { namespace: 'default' });
    const cronjobs = cjRes.parsed ?? [];
    assert(
      'k8s_list_cronjobs — returns array for default (may be empty)',
      !cjRes.isError && Array.isArray(cronjobs),
      cjRes.isError ? cjRes.text.slice(0, 120) : 'not an array',
    );

    const firstCj = cronjobs[0];

    // ---- k8s_get_cronjob ----------------------------------------------------
    if (firstCj?.name) {
      const r = await call(client, 'k8s_get_cronjob', { name: firstCj.name, namespace: 'default' });
      assert(
        `k8s_get_cronjob — metadata.name matches (${firstCj.name})`,
        !r.isError && r.parsed?.metadata?.name === firstCj.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_cronjob', 'no cronjobs in default namespace');
    }

    // ---- k8s_rollout_status -------------------------------------------------
    {
      const r = await call(
        client,
        'k8s_rollout_status',
        { name: 'cilium-operator', namespace: SYS_NS, resourceType: 'deployment', timeoutSeconds: 10 },
        20_000,
      );
      if (r.isError) {
        skip('k8s_rollout_status', `error (deployment may not exist): ${r.text.slice(0, 80)}`);
      } else {
        assert(
          'k8s_rollout_status — returns text output',
          r.text.length > 0,
          'empty response',
        );
      }
    }

    // ---- k8s_list_cluster_roles ---------------------------------------------
    const crRes = await call(client, 'k8s_list_cluster_roles');
    const clusterRoles = crRes.parsed ?? [];
    assert(
      'k8s_list_cluster_roles — returns non-empty array',
      !crRes.isError && Array.isArray(clusterRoles) && clusterRoles.length > 0,
      crRes.isError ? crRes.text.slice(0, 120) : `count=${clusterRoles.length}`,
    );

    const firstCr = clusterRoles[0];

    // ---- k8s_get_cluster_role -----------------------------------------------
    if (firstCr?.name) {
      const r = await call(client, 'k8s_get_cluster_role', { name: firstCr.name });
      assert(
        `k8s_get_cluster_role — metadata.name matches (${firstCr.name})`,
        !r.isError && r.parsed?.metadata?.name === firstCr.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_cluster_role', 'no cluster roles found');
    }

    // ---- k8s_list_cluster_role_bindings -------------------------------------
    const crbRes = await call(client, 'k8s_list_cluster_role_bindings');
    const clusterRoleBindings = crbRes.parsed ?? [];
    assert(
      'k8s_list_cluster_role_bindings — returns non-empty array',
      !crbRes.isError && Array.isArray(clusterRoleBindings) && clusterRoleBindings.length > 0,
      crbRes.isError ? crbRes.text.slice(0, 120) : `count=${clusterRoleBindings.length}`,
    );

    const firstCrb = clusterRoleBindings[0];

    // ---- k8s_get_cluster_role_binding ---------------------------------------
    if (firstCrb?.name) {
      const r = await call(client, 'k8s_get_cluster_role_binding', { name: firstCrb.name });
      assert(
        `k8s_get_cluster_role_binding — metadata.name matches (${firstCrb.name})`,
        !r.isError && r.parsed?.metadata?.name === firstCrb.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_cluster_role_binding', 'no cluster role bindings found');
    }

    // ---- k8s_list_roles -----------------------------------------------------
    const rolesRes = await call(client, 'k8s_list_roles', { namespace: SYS_NS });
    const roles = rolesRes.parsed ?? [];
    assert(
      `k8s_list_roles — returns array for ${SYS_NS}`,
      !rolesRes.isError && Array.isArray(roles),
      rolesRes.isError ? rolesRes.text.slice(0, 120) : 'not an array',
    );

    const firstRole = roles[0];

    // ---- k8s_get_role -------------------------------------------------------
    if (firstRole?.name) {
      const r = await call(client, 'k8s_get_role', { name: firstRole.name, namespace: SYS_NS });
      assert(
        `k8s_get_role — metadata.name matches (${firstRole.name})`,
        !r.isError && r.parsed?.metadata?.name === firstRole.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_role', `no roles in ${SYS_NS}`);
    }

    // ---- k8s_list_role_bindings ---------------------------------------------
    const rbRes = await call(client, 'k8s_list_role_bindings', { namespace: SYS_NS });
    const roleBindings = rbRes.parsed ?? [];
    assert(
      `k8s_list_role_bindings — returns array for ${SYS_NS}`,
      !rbRes.isError && Array.isArray(roleBindings),
      rbRes.isError ? rbRes.text.slice(0, 120) : 'not an array',
    );

    const firstRb = roleBindings[0];

    // ---- k8s_get_role_binding -----------------------------------------------
    if (firstRb?.name) {
      const r = await call(client, 'k8s_get_role_binding', { name: firstRb.name, namespace: SYS_NS });
      assert(
        `k8s_get_role_binding — metadata.name matches (${firstRb.name})`,
        !r.isError && r.parsed?.metadata?.name === firstRb.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_role_binding', `no role bindings in ${SYS_NS}`);
    }

    // ---- k8s_list_contexts --------------------------------------------------
    const ctxRes = await call(client, 'k8s_list_contexts');
    const contexts = ctxRes.parsed ?? [];
    assert(
      'k8s_list_contexts — returns non-empty array',
      !ctxRes.isError && Array.isArray(contexts) && contexts.length > 0,
      ctxRes.isError ? ctxRes.text.slice(0, 120) : `count=${contexts.length}`,
    );
    assert(
      'k8s_list_contexts — at least one context has isCurrent=true',
      Array.isArray(contexts) && contexts.some((c) => c.isCurrent === true),
      'no current context found',
    );

    // ---- k8s_use_context ----------------------------------------------------
    skip('k8s_use_context', 'write operation — skipped in smoke test');

    // ---- k8s_top_nodes ------------------------------------------------------
    {
      const r = await call(client, 'k8s_top_nodes', {}, 20_000);
      if (r.isError && /metrics/i.test(r.text)) {
        skip('k8s_top_nodes', `metrics-server not available: ${r.text.slice(0, 80)}`);
      } else {
        assert(
          'k8s_top_nodes — returns array',
          !r.isError && Array.isArray(r.parsed),
          r.isError ? r.text.slice(0, 120) : `got: ${typeof r.parsed}`,
        );
      }
    }

    // ---- k8s_top_pods -------------------------------------------------------
    {
      const r = await call(client, 'k8s_top_pods', { namespace: SYS_NS }, 20_000);
      if (r.isError && /metrics/i.test(r.text)) {
        skip('k8s_top_pods', `metrics-server not available: ${r.text.slice(0, 80)}`);
      } else {
        assert(
          `k8s_top_pods — returns array for ${SYS_NS}`,
          !r.isError && Array.isArray(r.parsed),
          r.isError ? r.text.slice(0, 120) : `got: ${typeof r.parsed}`,
        );
      }
    }

    // ---- k8s_list_hpas ------------------------------------------------------
    const hpaRes = await call(client, 'k8s_list_hpas', { namespace: 'default' });
    const hpas = hpaRes.parsed ?? [];
    assert(
      'k8s_list_hpas — returns array for default (may be empty)',
      !hpaRes.isError && Array.isArray(hpas),
      hpaRes.isError ? hpaRes.text.slice(0, 120) : 'not an array',
    );

    const firstHpa = hpas[0];

    // ---- k8s_get_hpa --------------------------------------------------------
    if (firstHpa?.name) {
      const r = await call(client, 'k8s_get_hpa', { name: firstHpa.name, namespace: 'default' });
      assert(
        `k8s_get_hpa — metadata.name matches (${firstHpa.name})`,
        !r.isError && r.parsed?.metadata?.name === firstHpa.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_hpa', 'no HPAs in default namespace');
    }

    // ---- k8s_list_crds ------------------------------------------------------
    const crdRes = await call(client, 'k8s_list_crds');
    const crds = crdRes.parsed ?? [];
    assert(
      'k8s_list_crds — returns non-empty array',
      !crdRes.isError && Array.isArray(crds) && crds.length > 0,
      crdRes.isError ? crdRes.text.slice(0, 120) : `count=${crds.length}`,
    );

    const firstCrd = crds[0];

    // ---- k8s_get_crd --------------------------------------------------------
    if (firstCrd?.name) {
      const r = await call(client, 'k8s_get_crd', { name: firstCrd.name });
      assert(
        `k8s_get_crd — metadata.name matches (${firstCrd.name})`,
        !r.isError && r.parsed?.metadata?.name === firstCrd.name,
        r.isError ? r.text.slice(0, 120) : `got name: ${r.parsed?.metadata?.name}`,
      );
    } else {
      skip('k8s_get_crd', 'no CRDs found');
    }

    // ---- k8s_rollout_restart ------------------------------------------------
    skip('k8s_rollout_restart', 'write operation — skipped in smoke test');

  } catch (err) {
    console.error('\nFatal error during test run:', err.message);
    failed++;
  } finally {
    client.close();
    await new Promise((resolve) => proc.on('close', resolve));
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log(`Results  (${elapsed}s elapsed)`);
  console.log(`  \x1b[32mPassed : ${passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed : ${failed}\x1b[0m`);
  console.log(`  \x1b[33mSkipped: ${skipped}\x1b[0m`);
  console.log(`  Total  : ${passed + failed + skipped}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

main();
