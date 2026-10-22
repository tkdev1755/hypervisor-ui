// =============================================================================
// Une fausse hypervisor-api, pour développer le front sans Linux ni libvirt.
//
//   npm run mock        se comporte comme la vraie API aujourd'hui :
//                       hyperviseurs OK, VM / disques / réseaux en 501.
//   npm run mock:full   renvoie aussi des VM, disques et réseaux d'exemple,
//                       pour construire les écrans avant que l'API soit prête.
//
// Mêmes routes, même port (3000) et même format d'erreur { status, content }
// que l'API Rust. Les données sont en mémoire : elles disparaissent à l'arrêt.
// Aucune dépendance : seulement le module http de Node.
// =============================================================================
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 3000);
const FULL = process.env.MOCK_FULL === '1';

const jobs = new Map(); // jobId -> Job (les tâches de clonage)
const hypervisors = new Map();
const vms = new Map(); // hypervisorId -> VM[]
const networks = new Map(); // hypervisorId -> Network[]

function addHypervisor(name, uri) {
  const hypervisor = { id: randomUUID(), name, uri, status: uri.includes('offline') ? 'disconnected' : 'connected' };
  hypervisors.set(hypervisor.id, hypervisor);
  vms.set(hypervisor.id, [
    { id: randomUUID(), hypervisor_id: hypervisor.id, name: 'web-01', memory_mb: 4096, vcpus: 2, status: 'running' },
    { id: randomUUID(), hypervisor_id: hypervisor.id, name: 'db-01', memory_mb: 8192, vcpus: 4, status: 'shutoff' },
  ]);
  networks.set(hypervisor.id, [
    { id: 'n1', hypervisor_id: hypervisor.id, name: 'default', bridge: 'virbr0', status: 'active' },
    { id: 'n2', hypervisor_id: hypervisor.id, name: 'isolated', bridge: null, status: 'inactive' },
  ]);
  return hypervisor;
}
addHypervisor('kvm-local', 'qemu:///system');
addHypervisor('kvm-lab', 'qemu+ssh://admin@192.168.1.20/system');

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const message = (status, content) => ({ status, content });
const notImplemented = (res, what) => send(res, 501, message('not_implemented', `${what} will be connected to libvirt`));
const notFound = (res) => send(res, 404, message('error', 'Hypervisor not found'));
const unreachable = (res) => send(res, 502, message('error', 'Could not connect to libvirt with this URI'));

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

// Une URI contenant « fail » simule un hôte libvirt injoignable (502).
const reachable = (uri) => !uri.includes('fail');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean); // ex. ['api', 'hypervisors', id, 'vms']
  const method = req.method;
  console.log(`${method} ${url.pathname}`);
  await new Promise((resolve) => setTimeout(resolve, 250)); // un peu de latence, pour voir les chargements

  if (url.pathname === '/ping' && method === 'GET') {
    return send(res, 200, message('ok', 'pong'));
  }
  // Une fausse page « noVNC », ouverte par la console de l'interface (mode full).
  if (url.pathname === '/mock-novnc' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<body style="margin:0;background:#111;color:#7CFC00;font:16px monospace;padding:16px">'
      + `Fausse console VNC (mock)<br>VM : ${url.searchParams.get('token')}<br><br>debian login: _</body>`);
  }
  // GET /api/jobs/{id}
  if (parts[0] === 'api' && parts[1] === 'jobs' && parts[2] && method === 'GET') {
    const job = jobs.get(parts[2]);
    return job ? send(res, 200, job) : send(res, 404, message('error', 'Job not found'));
  }
  if (parts[0] !== 'api' || parts[1] !== 'hypervisors') {
    return send(res, 404, message('error', 'Route not found'));
  }

  const [, , id, resource, subId, action] = parts;

  // /api/hypervisors
  if (!id) {
    if (method === 'GET') return send(res, 200, [...hypervisors.values()].sort((a, b) => a.name.localeCompare(b.name)));
    if (method === 'POST') {
      const body = await readJson(req);
      if (!body?.name || !body?.uri) return send(res, 422, 'Failed to deserialize the JSON body');
      if (!reachable(body.uri)) return unreachable(res);
      return send(res, 201, addHypervisor(body.name, body.uri));
    }
  }

  const hypervisor = hypervisors.get(id);

  // /api/hypervisors/{id}
  if (id && !resource) {
    if (!hypervisor) return notFound(res);
    if (method === 'GET') return send(res, 200, hypervisor);
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (body === null) return send(res, 422, 'Failed to deserialize the JSON body');
      if (body.uri && !reachable(body.uri)) return unreachable(res);
      Object.assign(hypervisor, body.name ? { name: body.name } : {}, body.uri ? { uri: body.uri, status: 'connected' } : {});
      return send(res, 200, hypervisor);
    }
    if (method === 'DELETE') {
      hypervisors.delete(id);
      return send(res, 204);
    }
  }

  // Ressources d'un hyperviseur : 501, comme la vraie API, sauf en mode « full ».
  if (!FULL) {
    return notImplemented(res, `${resource ?? 'Resource'} ${method}`);
  }
  if (!hypervisor) return notFound(res);

  if (resource === 'vm-options' && method === 'GET') {
    return send(res, 200, {
      storage_pools: [
        { name: 'datastore', capacity_gb: 500, available_gb: 320, volumes: [] },
        { name: 'images', capacity_gb: 200, available_gb: 150, volumes: [{ name: 'debian.iso', format: 'iso', size_mb: 650, kind: 'iso', used_by: [] }] },
      ],
      networks: [{ name: 'default', bridge: 'virbr0' }, { name: 'isolated' }],
      firmware: ['bios', 'uefi'],
      limits: { memory_mb: { min: 128, max: 16384 }, vcpus: { min: 1, max: 8 }, disk_gb: { min: 1, max: 500 } },
      defaults: { network: 'default', firmware: 'bios', memory_mb: 2048, vcpus: 2, disk_gb: 20 },
    });
  }
  if (resource === 'vms') {
    const list = vms.get(id) ?? [];
    if (!subId && method === 'GET') return send(res, 200, list);
    if (!subId && method === 'POST') {
      const body = await readJson(req);
      if (!body?.name || !body?.disks?.length) return send(res, 400, message('error', 'At least one disk or an ISO is required'));
      if (list.some((candidate) => candidate.name === body.name)) return send(res, 409, message('error', 'VM name already taken'));
      const vm = { id: randomUUID(), hypervisor_id: id, name: body.name, memory_mb: body.memory_mb, vcpus: body.vcpus, status: body.start ? 'running' : 'shutoff' };
      list.push(vm);
      return send(res, 201, vm);
    }
    const vm = list.find((candidate) => candidate.id === subId);
    if (!vm) return send(res, 404, message('error', 'VM not found'));
    if (method === 'POST' && (action === 'start' || action === 'stop')) {
      if ((action === 'start') === (vm.status === 'running')) return send(res, 409, message('error', `VM already ${vm.status}`));
      vm.status = action === 'start' ? 'running' : 'shutoff';
      // Le vrai arrêt ACPI (sans ?force=true) est asynchrone : l'état renvoyé peut encore être « running ».
      if (action === 'stop' && url.searchParams.get('force') !== 'true') {
        const before = { ...vm, status: 'running' };
        return send(res, 200, before);
      }
      return send(res, 200, vm);
    }
    if (method === 'POST' && action === 'clone') {
      const body = await readJson(req);
      if (vm.status === 'running') return send(res, 409, message('error', 'The source VM must be stopped'));
      if (!body?.name) return send(res, 422, 'Failed to deserialize the JSON body');
      if (list.some((candidate) => candidate.name === body.name)) return send(res, 409, message('error', 'VM name already taken'));
      const job = { id: randomUUID(), kind: 'clone', status: 'running' };
      jobs.set(job.id, job);
      // La « copie des disques » dure 3 secondes.
      setTimeout(() => {
        const copy = { ...vm, id: randomUUID(), name: body.name, status: 'shutoff' };
        list.push(copy);
        Object.assign(job, { status: 'succeeded', result: copy });
      }, 3000);
      res.setHeader('Location', `/api/jobs/${job.id}`);
      return send(res, 202, job);
    }
    if (method === 'GET' && action === 'vnc') {
      if (vm.status !== 'running') return send(res, 409, message('error', 'The VM is not running'));
      return send(res, 200, {
        hypervisor_id: id, vm_id: vm.id, uuid: vm.id, host: '127.0.0.1', port: '5900', token: vm.id, status: 'connected',
        novnc_url: `http://127.0.0.1:${PORT}/mock-novnc?token=${vm.name}`,
      });
    }
    if (method === 'DELETE') {
      if (vm.status === 'running') return send(res, 409, message('error', 'The VM is running'));
      vms.set(id, list.filter((candidate) => candidate.id !== subId));
      return send(res, 204);
    }
    if (method === 'GET') return send(res, 200, vm);
  }
  if (resource === 'disks' && method === 'GET') {
    return send(res, 200, [
      { id: 'd1', hypervisor_id: id, name: 'web-01.qcow2', size_gb: 20, format: 'qcow2' },
      { id: 'd2', hypervisor_id: id, name: 'db-01.raw', size_gb: 100, format: 'raw' },
    ]);
  }
  if (resource === 'networks' && method === 'GET') {
    return send(res, 200, networks.get(id) ?? []);
  }
  if (resource === 'networks' && method === 'POST') {
    if (!FULL) return notImplemented(res, 'networks POST');
    const body = await readJson(req);
    if (!body?.name) return send(res, 422, 'Failed to deserialize the JSON body');
    const network = { id: randomUUID(), hypervisor_id: id, name: body.name, bridge: body.bridge ?? null, status: 'inactive' };
    networks.set(id, [...(networks.get(id) ?? []), network]);
    return send(res, 201, network);
  }
  if (resource === 'networks' && subId && method === 'DELETE') {
    if (!FULL) return notImplemented(res, 'networks DELETE');
    const list = networks.get(id) ?? [];
    if (!list.some((network) => network.id === subId)) return send(res, 404, message('error', 'Network not found'));
    networks.set(id, list.filter((network) => network.id !== subId));
    return send(res, 204);
  }
  return notImplemented(res, `${resource} ${method}`);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Fausse hypervisor-api sur http://127.0.0.1:${PORT} (mode ${FULL ? 'complet' : 'fidèle à l’API actuelle'})`);
  console.log('Astuce : une URI contenant « fail » simule un hôte injoignable (502).');
});
