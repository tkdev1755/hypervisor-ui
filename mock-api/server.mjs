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

const PORT = 3000;
const FULL = process.env.MOCK_FULL === '1';

const hypervisors = new Map();
const vms = new Map(); // hypervisorId -> VM[]

function addHypervisor(name, uri) {
  const hypervisor = { id: randomUUID(), name, uri, status: uri.includes('offline') ? 'disconnected' : 'connected' };
  hypervisors.set(hypervisor.id, hypervisor);
  vms.set(hypervisor.id, [
    { id: randomUUID(), hypervisor_id: hypervisor.id, name: 'web-01', memory_mb: 4096, vcpus: 2, status: 'running' },
    { id: randomUUID(), hypervisor_id: hypervisor.id, name: 'db-01', memory_mb: 8192, vcpus: 4, status: 'shutoff' },
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

  if (resource === 'vms') {
    const list = vms.get(id) ?? [];
    if (!subId && method === 'GET') return send(res, 200, list);
    if (!subId && method === 'POST') {
      const body = await readJson(req);
      const vm = { id: randomUUID(), hypervisor_id: id, name: body.name, memory_mb: body.memory_mb, vcpus: body.vcpus, status: 'shutoff' };
      list.push(vm);
      return send(res, 201, vm);
    }
    const vm = list.find((candidate) => candidate.id === subId);
    if (!vm) return send(res, 404, message('error', 'VM not found'));
    if (method === 'POST' && (action === 'start' || action === 'stop')) {
      vm.status = action === 'start' ? 'running' : 'shutoff';
      return send(res, 200, message('ok', `VM ${action}ed`));
    }
    if (method === 'DELETE') {
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
    return send(res, 200, [
      { id: 'n1', hypervisor_id: id, name: 'default', bridge: 'virbr0', status: 'active' },
      { id: 'n2', hypervisor_id: id, name: 'isolated', bridge: null, status: 'inactive' },
    ]);
  }
  return notImplemented(res, `${resource} ${method}`);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Fausse hypervisor-api sur http://127.0.0.1:${PORT} (mode ${FULL ? 'complet' : 'fidèle à l’API actuelle'})`);
  console.log('Astuce : une URI contenant « fail » simule un hôte injoignable (502).');
});
