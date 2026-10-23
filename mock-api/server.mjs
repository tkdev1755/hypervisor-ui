// =============================================================================
// Une fausse hypervisor-api, pour développer le front sans Linux ni libvirt.
//
//   npm run mock        se comporte comme la vraie API sans hyperviseur réel :
//                       authentification, hyperviseurs et utilisateurs OK, mais
//                       VM / disques / réseaux en 501.
//   npm run mock:full   renvoie aussi des VM, disques et réseaux d'exemple,
//                       pour construire les écrans avant que l'API soit prête.
//
// Mêmes routes, même port (3000) et même format d'erreur { status, content }
// que l'API Rust. Les données sont en mémoire : elles disparaissent à l'arrêt.
// Aucune dépendance : seulement le module http de Node.
//
// AUTHENTIFICATION (comme la vraie API : voir docs/AUTH.md dans son dépôt)
//   Comptes d'exemple (le mot de passe est le nom, ou « admin-password » pour l'admin) :
//       admin / admin-password   administrateur
//       alice / alice            utilisateur : a accès à « kvm-local », possède « web-01 »
//       bob   / bob              utilisateur : possède « bob-vm », prêtée à alice
//   - POST /api/auth/login → jeton d'accès (courte durée) + refresh token (à USAGE UNIQUE).
//     ACCESS_TTL=20 npm run mock fait expirer le jeton en 20 s : pratique pour voir le refresh.
//   - Un mauvais mot de passe 5 fois de suite : 429 (le compteur se vide au redémarrage).
//   - Les droits suivent la matrice de l'API : 401 sans jeton, 403 « pas le droit »,
//     404 « aucun droit sur cette ressource ».
// =============================================================================
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 3000);
const FULL = process.env.MOCK_FULL === '1';
const ACCESS_TTL = Number(process.env.ACCESS_TTL ?? 900); // secondes
const MAX_FAILURES = 5;

const now = () => Math.floor(Date.now() / 1000);

// --- Données en mémoire --------------------------------------------------------
const jobs = new Map(); // jobId -> Job (les tâches de clonage), avec owner_id (interne, jamais renvoyé)
const hypervisors = new Map();
const vms = new Map(); // hypervisorId -> VM[] ; chaque VM garde owner_id (interne) et shares
const networks = new Map(); // hypervisorId -> Network[]
const disks = new Map(); // hypervisorId -> Disk[]
const access = new Map(); // hypervisorId -> Map(userId -> created_at) : qui peut y créer des VM

const users = new Map(); // userId -> { id, username, password, role, disabled, created_at, quota }
const accessTokens = new Map(); // jeton -> { userId, expires }
const refreshTokens = new Map(); // refresh token -> { userId, expires }
const failures = new Map(); // nom d'utilisateur -> nombre d'échecs
const settings = { registration_open: false };
const audit = []; // le plus récent en premier

const NO_QUOTA = () => ({ max_vms: null, max_vcpus: null, max_memory_mb: null, max_disk_gb: null });

function addUser(username, password, role) {
  const user = { id: randomUUID(), username, password, role, disabled: false, created_at: now(), quota: NO_QUOTA() };
  users.set(user.id, user);
  return user;
}
const admin = addUser('admin', 'admin-password', 'admin');
const alice = addUser('alice', 'alice', 'user');
const bob = addUser('bob', 'bob', 'user');

function addHypervisor(name, uri) {
  const hypervisor = { id: randomUUID(), name, uri, status: uri.includes('offline') ? 'disconnected' : 'connected' };
  hypervisors.set(hypervisor.id, hypervisor);
  vms.set(hypervisor.id, []);
  access.set(hypervisor.id, new Map());
  networks.set(hypervisor.id, [
    { id: 'n1', hypervisor_id: hypervisor.id, name: 'default', bridge: 'virbr0', status: 'active' },
    { id: 'n2', hypervisor_id: hypervisor.id, name: 'isolated', bridge: null, status: 'inactive' },
  ]);
  disks.set(hypervisor.id, [
    { id: 'd1', hypervisor_id: hypervisor.id, name: 'web-01.qcow2', size_gb: 20, format: 'qcow2' },
    { id: 'd2', hypervisor_id: hypervisor.id, name: 'db-01.raw', size_gb: 100, format: 'raw' },
  ]);
  return hypervisor;
}
function addVm(hypervisorId, name, memory_mb, vcpus, status, owner) {
  const vm = { id: randomUUID(), hypervisor_id: hypervisorId, name, memory_mb, vcpus, status, owner_id: owner?.id ?? null, shares: [] };
  vms.get(hypervisorId).push(vm);
  return vm;
}
const local = addHypervisor('kvm-local', 'qemu:///system');
addHypervisor('kvm-lab', 'qemu+ssh://admin@192.168.1.20/system');
access.get(local.id).set(alice.id, now());
addVm(local.id, 'web-01', 4096, 2, 'running', alice);
addVm(local.id, 'db-01', 8192, 4, 'shutoff', null); // créée « hors de l'API » : sans propriétaire
const bobVm = addVm(local.id, 'bob-vm', 2048, 1, 'shutoff', bob);
bobVm.shares.push({ user_id: alice.id, username: 'alice', created_at: now(), expires_at: null });

// --- Réponses ---------------------------------------------------------------
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const message = (status, content) => ({ status, content });
const err = (res, status, content, headers) => send(res, status, message('error', content), headers);
const notImplemented = (res, what) => send(res, 501, message('not_implemented', `${what} will be connected to libvirt`));
const unreachable = (res) => err(res, 502, 'Could not connect to libvirt with this URI');
const malformed = (res) => send(res, 422, 'Failed to deserialize the JSON body');

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

// --- Authentification ------------------------------------------------------------
function issueTokens(user) {
  const access_token = `acc_${randomUUID()}`;
  const refresh_token = `ref_${randomUUID()}${randomUUID()}`.replaceAll('-', '');
  accessTokens.set(access_token, { userId: user.id, expires: now() + ACCESS_TTL });
  refreshTokens.set(refresh_token, { userId: user.id, expires: now() + 7 * 86400 });
  return { access_token, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token };
}

/** L'utilisateur du jeton Bearer, ou null (jeton absent, expiré, ou compte désactivé). */
function authenticate(req) {
  const header = req.headers.authorization ?? '';
  const entry = header.startsWith('Bearer ') ? accessTokens.get(header.slice(7)) : null;
  if (!entry || entry.expires < now()) return null;
  const user = users.get(entry.userId);
  return user && !user.disabled ? user : null;
}

function logAudit(user, action, target = null, detail = null, success = true) {
  audit.unshift({ id: audit.length + 1, at: now(), action, success, user_id: user?.id ?? null, username: user?.username ?? null, target, detail });
}

const isAdmin = (user) => user.role === 'admin';

/** Ce que l'API appelle UserView : le compte, son quota et sa consommation (sans mot de passe). */
function userView(user) {
  const owned = [...vms.values()].flat().filter((vm) => vm.owner_id === user.id);
  return {
    id: user.id, username: user.username, role: user.role, disabled: user.disabled, created_at: user.created_at, quota: user.quota,
    usage: {
      vms: owned.length,
      vcpus: owned.reduce((sum, vm) => sum + vm.vcpus, 0),
      memory_mb: owned.reduce((sum, vm) => sum + vm.memory_mb, 0),
      disk_gb: owned.length * 20, // le mock compte 20 Go par VM
    },
  };
}

// --- Droits -------------------------------------------------------------------
const activeShare = (vm, user) => vm.shares.find((share) => share.user_id === user.id && (!share.expires_at || share.expires_at > now()));

/** 'admin' | 'owner' | 'shared' | null (aucun droit : 404). */
function vmAccess(vm, user) {
  if (isAdmin(user)) return 'admin';
  if (vm.owner_id === user.id) return 'owner';
  return activeShare(vm, user) ? 'shared' : null;
}
/** Un utilisateur voit un hyperviseur s'il y a l'accès, ou s'il y a une VM (à lui ou prêtée). */
function canSeeHypervisor(id, user) {
  return isAdmin(user) || access.get(id)?.has(user.id) || (vms.get(id) ?? []).some((vm) => vmAccess(vm, user));
}
const canCreateVm = (id, user) => isAdmin(user) || access.get(id)?.has(user.id);

function vmView(vm, user) {
  const { owner_id, shares, ...rest } = vm;
  return { ...rest, owner: users.get(owner_id)?.username ?? null, access: vmAccess(vm, user) };
}
function hypervisorView(hypervisor, user) {
  return isAdmin(user) ? hypervisor : { ...hypervisor, uri: '' };
}

/** Le message de l'API quand une limite est dépassée, ou null si tout va bien. */
function quotaViolation(owner, extra) {
  const usage = userView(owner).usage;
  const checks = [
    ['max_vms', usage.vms + 1], ['max_vcpus', usage.vcpus + extra.vcpus],
    ['max_memory_mb', usage.memory_mb + extra.memory_mb], ['max_disk_gb', usage.disk_gb + extra.disk_gb],
  ];
  for (const [field, requested] of checks) {
    const limit = owner.quota[field];
    if (limit !== null && requested > limit) return `Quota exceeded: ${field} is limited to ${limit} (${requested} requested)`;
  }
  return null;
}

// --- Serveur -------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean); // ex. ['api', 'hypervisors', id, 'vms']
  const method = req.method;
  console.log(`${method} ${url.pathname}`);
  await new Promise((resolve) => setTimeout(resolve, 250)); // un peu de latence, pour voir les chargements

  // --- Routes publiques ---
  if (url.pathname === '/ping' && method === 'GET') {
    return send(res, 200, message('ok', 'pong'));
  }
  // Une fausse page « noVNC », ouverte par la console de l'interface (mode full).
  if (url.pathname === '/mock-novnc' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<body style="margin:0;background:#111;color:#7CFC00;font:16px monospace;padding:16px">'
      + `Fausse console VNC (mock)<br>VM : ${url.searchParams.get('token')}<br><br>debian login: _</body>`);
  }
  if (parts[0] !== 'api') return err(res, 404, 'Route not found');

  if (parts[1] === 'auth') {
    return handleAuth(req, res, parts, method);
  }

  // --- Tout le reste demande un jeton ---
  const user = authenticate(req);
  if (!user) {
    return err(res, 401, 'Missing, expired or invalid token', { 'WWW-Authenticate': 'Bearer' });
  }
  const forbidden = (text = 'Administrator rights are required') => err(res, 403, text);
  const adminOnly = () => (isAdmin(user) ? false : (forbidden(), true));

  // /api/me
  if (parts[1] === 'me') {
    if (!parts[2] && method === 'GET') return send(res, 200, userView(user));
    if (parts[2] === 'password' && method === 'PUT') {
      const body = await readJson(req);
      if (!body?.current_password || !body?.new_password) return malformed(res);
      if (body.current_password !== user.password) return err(res, 401, 'Current password is incorrect');
      if (body.new_password.length < 8 || body.new_password.length > 128) return err(res, 400, 'Password must be 8 to 128 characters');
      user.password = body.new_password;
      // Comme l'API : toutes les sessions du compte sont fermées.
      for (const [token, entry] of refreshTokens) if (entry.userId === user.id) refreshTokens.delete(token);
      logAudit(user, 'user.password', user.username);
      return send(res, 204);
    }
  }

  // /api/users...
  if (parts[1] === 'users') {
    if (adminOnly()) return;
    return handleUsers(req, res, parts, method, user);
  }
  if (parts[1] === 'settings') {
    if (adminOnly()) return;
    if (method === 'GET') return send(res, 200, settings);
    if (method === 'PUT') {
      const body = await readJson(req);
      if (typeof body?.registration_open !== 'boolean') return malformed(res);
      settings.registration_open = body.registration_open;
      logAudit(user, 'settings.update', 'registration_open', String(body.registration_open));
      return send(res, 200, settings);
    }
  }
  if (parts[1] === 'audit' && method === 'GET') {
    if (adminOnly()) return;
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const action = url.searchParams.get('action');
    const userId = url.searchParams.get('user_id');
    const rows = audit.filter((row) => (!action || row.action === action) && (!userId || row.user_id === userId));
    return send(res, 200, rows.slice(offset, offset + limit));
  }

  // GET /api/jobs/{id} : réservé à celui qui l'a lancé, et aux admins
  if (parts[1] === 'jobs' && parts[2] && method === 'GET') {
    const job = jobs.get(parts[2]);
    if (!job || (!isAdmin(user) && job.owner_id !== user.id)) return err(res, 404, 'Job not found');
    const { owner_id, ...visible } = job;
    return send(res, 200, visible);
  }
  if (parts[1] !== 'hypervisors') return err(res, 404, 'Route not found');

  return handleHypervisors(req, res, parts, method, url, user, { forbidden, adminOnly });
});

// --- /api/auth/* ------------------------------------------------------------
async function handleAuth(req, res, parts, method) {
  const route = parts[2];
  if (route === 'config' && method === 'GET') {
    return send(res, 200, { registration_open: settings.registration_open });
  }
  const body = method === 'POST' ? await readJson(req) : {};
  if (body === null) return malformed(res);

  if (route === 'login' && method === 'POST') {
    if (!body.username || !body.password) return malformed(res);
    const name = String(body.username).toLowerCase();
    if ((failures.get(name) ?? 0) >= MAX_FAILURES) return err(res, 429, 'Too many failed attempts, try again later');
    const user = [...users.values()].find((candidate) => candidate.username.toLowerCase() === name);
    if (!user || user.disabled || user.password !== body.password) {
      failures.set(name, (failures.get(name) ?? 0) + 1);
      logAudit(user ?? null, 'auth.login', name, null, false);
      return err(res, 401, 'Invalid username or password'); // même message, que le nom existe ou non
    }
    failures.delete(name);
    logAudit(user, 'auth.login');
    return send(res, 200, issueTokens(user));
  }
  if (route === 'refresh' && method === 'POST') {
    const entry = refreshTokens.get(body.refresh_token);
    refreshTokens.delete(body.refresh_token); // à usage unique : détruit dès qu'il est présenté
    const user = entry && entry.expires > now() ? users.get(entry.userId) : null;
    if (!user || user.disabled) return err(res, 401, 'Invalid refresh token');
    return send(res, 200, issueTokens(user));
  }
  if (route === 'logout' && method === 'POST') {
    refreshTokens.delete(body.refresh_token);
    return send(res, 204);
  }
  if (route === 'register' && method === 'POST') {
    if (!settings.registration_open) return err(res, 403, 'Registration is closed');
    return createUser(res, body, 'user', null);
  }
  return err(res, 404, 'Route not found');
}

/** Crée un compte (inscription libre ou création par un admin) en appliquant les règles de l'API. */
function createUser(res, body, role, actor) {
  if (!body?.username || !body?.password) return malformed(res);
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(body.username)) return err(res, 400, 'Username must be 3 to 32 characters (letters, digits, . _ -)');
  if (body.password.length < 8 || body.password.length > 128) return err(res, 400, 'Password must be 8 to 128 characters');
  if (![...users.values()].every((user) => user.username.toLowerCase() !== body.username.toLowerCase())) return err(res, 409, 'Username already taken');
  const created = addUser(body.username, body.password, role);
  logAudit(actor ?? created, 'user.create', created.username);
  return send(res, 201, userView(created));
}

// --- /api/users/* (admin) ------------------------------------------------------
async function handleUsers(req, res, parts, method, actor) {
  const [, , id, sub] = parts;
  if (!id) {
    if (method === 'GET') return send(res, 200, [...users.values()].map(userView));
    if (method === 'POST') {
      const body = await readJson(req);
      if (body === null) return malformed(res);
      if (body.role && !['admin', 'user'].includes(body.role)) return err(res, 400, 'Role must be admin or user');
      return createUser(res, body, body.role ?? 'user', actor);
    }
  }
  const target = users.get(id);
  if (!target) return err(res, 404, 'User not found');
  const activeAdmins = () => [...users.values()].filter((user) => user.role === 'admin' && !user.disabled);
  const isLastAdmin = target.role === 'admin' && !target.disabled && activeAdmins().length === 1;

  if (!sub) {
    if (method === 'GET') return send(res, 200, userView(target));
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (body === null) return malformed(res);
      if (body.role && !['admin', 'user'].includes(body.role)) return err(res, 400, 'Role must be admin or user');
      if (isLastAdmin && (body.role === 'user' || body.disabled === true)) return err(res, 409, 'The last active administrator cannot be removed');
      if (body.role) target.role = body.role;
      if (typeof body.disabled === 'boolean') target.disabled = body.disabled;
      logAudit(actor, 'user.update', target.id, `role=${body.role ?? 'None'} disabled=${body.disabled ?? 'None'}`);
      return send(res, 200, userView(target));
    }
    if (method === 'DELETE') {
      if (isLastAdmin) return err(res, 409, 'The last active administrator cannot be removed');
      if ([...vms.values()].flat().some((vm) => vm.owner_id === target.id)) return err(res, 409, 'This user still owns VMs');
      users.delete(target.id);
      logAudit(actor, 'user.delete', target.username);
      return send(res, 204);
    }
  }
  if (sub === 'password' && method === 'PUT') {
    const body = await readJson(req);
    if (!body?.new_password) return malformed(res);
    if (body.new_password.length < 8 || body.new_password.length > 128) return err(res, 400, 'Password must be 8 to 128 characters');
    target.password = body.new_password;
    for (const [token, entry] of refreshTokens) if (entry.userId === target.id) refreshTokens.delete(token);
    logAudit(actor, 'user.password', target.username);
    return send(res, 204);
  }
  if (sub === 'quota' && method === 'PUT') {
    const body = await readJson(req);
    if (body === null) return malformed(res);
    const quota = NO_QUOTA();
    for (const field of Object.keys(quota)) {
      const value = body[field] ?? null; // remplacement complet : un champ absent = illimité
      if (value !== null && (!Number.isInteger(value) || value < 0)) return err(res, 400, `${field} must be a non-negative integer`);
      quota[field] = value;
    }
    target.quota = quota;
    logAudit(actor, 'user.quota', target.id, JSON.stringify(quota));
    return send(res, 200, userView(target));
  }
  return err(res, 404, 'Route not found');
}

// --- /api/hypervisors/* ------------------------------------------------------------
async function handleHypervisors(req, res, parts, method, url, user, { forbidden, adminOnly }) {
  const [, , id, resource, subId, action, extra] = parts;

  // /api/hypervisors
  if (!id) {
    if (method === 'GET') {
      const visible = [...hypervisors.values()].filter((h) => canSeeHypervisor(h.id, user));
      return send(res, 200, visible.sort((a, b) => a.name.localeCompare(b.name)).map((h) => hypervisorView(h, user)));
    }
    if (method === 'POST') {
      if (adminOnly()) return;
      const body = await readJson(req);
      if (!body?.name || !body?.uri) return malformed(res);
      if (!reachable(body.uri)) return unreachable(res);
      const created = addHypervisor(body.name, body.uri);
      logAudit(user, 'hypervisor.create', created.id);
      return send(res, 201, created);
    }
  }

  // Modifier ou supprimer un hyperviseur, ses accès, disques, pools, réseaux : admin seulement. Ce contrôle
  // passe AVANT la visibilité : un simple utilisateur reçoit 403 même sur un hyperviseur qu'il ne voit pas.
  if (['access', 'disks', 'networks', 'pools'].includes(resource) || (!resource && method !== 'GET')) {
    if (adminOnly()) return;
  }

  const hypervisor = hypervisors.get(id);
  // Un hyperviseur qu'on ne voit pas « n'existe pas » : 404, jamais 403.
  if (!hypervisor || !canSeeHypervisor(id, user)) return err(res, 404, 'Hypervisor not found');

  // /api/hypervisors/{id}
  if (!resource) {
    if (method === 'GET') return send(res, 200, hypervisorView(hypervisor, user));
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (body === null) return malformed(res);
      if (body.uri && !reachable(body.uri)) return unreachable(res);
      Object.assign(hypervisor, body.name ? { name: body.name } : {}, body.uri ? { uri: body.uri, status: 'connected' } : {});
      return send(res, 200, hypervisor);
    }
    if (method === 'DELETE') {
      hypervisors.delete(id);
      return send(res, 204);
    }
  }

  // /api/hypervisors/{id}/access[/{user_id}] (admin) : qui peut y créer des VM
  if (resource === 'access') {
    const granted = access.get(id);
    if (!subId && method === 'GET') {
      return send(res, 200, [...granted].map(([userId, created_at]) => ({ user_id: userId, username: users.get(userId)?.username, created_at })));
    }
    if (subId && method === 'PUT') {
      if (!users.has(subId)) return err(res, 404, 'User not found');
      granted.set(subId, now());
      logAudit(user, 'hypervisor.grant', id, subId);
      return send(res, 204);
    }
    if (subId && method === 'DELETE') {
      if (!granted.delete(subId)) return err(res, 404, 'Access not found');
      logAudit(user, 'hypervisor.revoke', id, subId);
      return send(res, 204);
    }
  }

  // Les VM : pas besoin de droit d'admin, mais des droits sur chaque VM (ni disques ni réseaux).
  if (resource === 'vms' || resource === 'vm-options') {
    if (!FULL) return notImplemented(res, `${resource} ${method}`);
    return handleVms(req, res, { id, resource, subId, action, extra, method, url, user, forbidden });
  }

  // Disques, pools, réseaux (déjà réservés aux admins plus haut).
  if (resource === 'disks' || resource === 'networks' || resource === 'pools') {
    if (!FULL) return notImplemented(res, `${resource} ${method}`);
    return handleInfrastructure(req, res, { id, resource, subId, method });
  }
  return notImplemented(res, `${resource} ${method}`);
}

async function handleVms(req, res, { id, resource, subId, action, extra, method, url, user, forbidden }) {
  const hypervisor = hypervisors.get(id);

  if (resource === 'vm-options' && method === 'GET') {
    if (!canCreateVm(id, user)) return forbidden('No access to create VMs on this hypervisor');
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

  const list = vms.get(id) ?? [];
  // Un utilisateur sans aucune VM visible ici ne voit pas l'hyperviseur : déjà traité plus haut (404).
  if (!subId) {
    if (method === 'GET') return send(res, 200, list.filter((vm) => vmAccess(vm, user)).map((vm) => vmView(vm, user)));
    if (method === 'POST') {
      if (!canCreateVm(id, user)) return forbidden('No access to create VMs on this hypervisor');
      const body = await readJson(req);
      if (!body?.name || !body?.disks?.length) return err(res, 400, 'At least one disk or an ISO is required');
      if (body.owner_id && !isAdmin(user)) return forbidden('Only an administrator can create a VM for someone else');
      const owner = body.owner_id ? users.get(body.owner_id) : user;
      if (!owner) return err(res, 404, 'User not found');
      if (list.some((candidate) => candidate.name === body.name)) return err(res, 409, 'VM name already taken');
      const diskGb = body.disks.reduce((sum, disk) => sum + (disk.size_gb ?? 0), 0);
      const violation = quotaViolation(owner, { vcpus: body.vcpus, memory_mb: body.memory_mb, disk_gb: diskGb });
      if (violation) return forbidden(violation);
      const vm = addVm(id, body.name, body.memory_mb, body.vcpus, body.start ? 'running' : 'shutoff', owner);
      logAudit(user, 'vm.create', vm.id);
      return send(res, 201, vmView(vm, user));
    }
  }

  const vm = list.find((candidate) => candidate.id === subId);
  const level = vm ? vmAccess(vm, user) : null;
  if (!vm || !level) return err(res, 404, 'VM not found'); // aucun droit = comme si elle n'existait pas

  // Démarrer, arrêter, console : propriétaire, admin, emprunteur.
  if (method === 'POST' && (action === 'start' || action === 'stop')) {
    if ((action === 'start') === (vm.status === 'running')) return err(res, 409, `VM already ${vm.status}`);
    vm.status = action === 'start' ? 'running' : 'shutoff';
    logAudit(user, `vm.${action}`, vm.id);
    // Le vrai arrêt ACPI (sans ?force=true) est asynchrone : l'état renvoyé peut encore être « running ».
    if (action === 'stop' && url.searchParams.get('force') !== 'true') {
      return send(res, 200, vmView({ ...vm, status: 'running' }, user));
    }
    return send(res, 200, vmView(vm, user));
  }
  if (method === 'GET' && action === 'vnc') {
    if (vm.status !== 'running') return err(res, 409, 'The VM is not running');
    logAudit(user, 'vm.console', vm.id);
    // Un jeton à durée courte, comme l'API : l'adresse expire au bout de 2 minutes.
    return send(res, 200, {
      hypervisor_id: id, vm_id: vm.id, uuid: vm.id, host: '127.0.0.1', port: '5900', token: `vnc_${randomUUID()}`, status: 'connected',
      novnc_url: `http://127.0.0.1:${PORT}/mock-novnc?token=${vm.name}`, expires_at: now() + 120,
    });
  }
  if (method === 'GET' && !action) return send(res, 200, vmView(vm, user));

  // Le prêt : le propriétaire et les admins. L'emprunteur peut seulement « rendre » la VM (DELETE de son propre prêt).
  if (action === 'shares') {
    const own = level === 'owner' || level === 'admin';
    if (method === 'DELETE' && extra && (own || extra === user.id)) {
      const before = vm.shares.length;
      vm.shares = vm.shares.filter((share) => share.user_id !== extra);
      return vm.shares.length === before ? err(res, 404, 'Share not found') : send(res, 204);
    }
    if (!own) return forbidden('Only the owner can manage loans');
    if (method === 'GET') return send(res, 200, vm.shares.filter((share) => !share.expires_at || share.expires_at > now()));
    if (method === 'POST') {
      const body = await readJson(req);
      if (!body?.username) return malformed(res);
      const borrower = [...users.values()].find((candidate) => candidate.username.toLowerCase() === String(body.username).toLowerCase());
      if (!borrower) return err(res, 404, 'User not found');
      if (borrower.id === user.id || borrower.id === vm.owner_id) return err(res, 400, 'A VM cannot be lent to its owner');
      if (!vm.owner_id) return err(res, 409, 'This VM has no owner: give it to someone first');
      if (body.expires_at && body.expires_at <= now()) return err(res, 400, 'The end date is in the past');
      vm.shares = vm.shares.filter((share) => share.user_id !== borrower.id);
      const share = { user_id: borrower.id, username: borrower.username, created_at: now(), expires_at: body.expires_at ?? null };
      vm.shares.push(share);
      logAudit(user, 'vm.share', vm.id, borrower.username);
      return send(res, 201, share);
    }
  }

  // Tout le reste : le propriétaire ou un admin (un emprunteur reçoit 403).
  if (level === 'shared') return forbidden('Borrowers cannot do this');

  if (method === 'PUT' && action === 'owner') {
    if (!isAdmin(user)) return forbidden();
    const body = await readJson(req);
    const owner = users.get(body?.owner_id);
    if (!owner) return err(res, 404, 'User not found');
    vm.owner_id = owner.id;
    vm.shares = vm.shares.filter((share) => share.user_id !== owner.id);
    logAudit(user, 'vm.owner', vm.id, owner.username);
    return send(res, 200, vmView(vm, user));
  }
  if (method === 'POST' && action === 'clone') {
    const body = await readJson(req);
    if (vm.status === 'running') return err(res, 409, 'The source VM must be stopped');
    if (!body?.name) return malformed(res);
    if (list.some((candidate) => candidate.name === body.name)) return err(res, 409, 'VM name already taken');
    const violation = quotaViolation(user, { vcpus: vm.vcpus, memory_mb: vm.memory_mb, disk_gb: 20 });
    if (violation) return forbidden(violation);
    const job = { id: randomUUID(), kind: 'clone', status: 'running', owner_id: user.id };
    jobs.set(job.id, job);
    // La « copie des disques » dure 3 secondes. Le clone appartient à celui qui le demande.
    setTimeout(() => {
      const copy = addVm(id, body.name, vm.memory_mb, vm.vcpus, 'shutoff', user);
      Object.assign(job, { status: 'succeeded', result: vmView(copy, user) });
      logAudit(user, 'vm.clone', copy.id);
    }, 3000);
    res.setHeader('Location', `/api/jobs/${job.id}`);
    const { owner_id, ...visible } = job;
    return send(res, 202, visible);
  }
  if (method === 'DELETE' && !action) {
    if (vm.status === 'running') return err(res, 409, 'The VM is running');
    vms.set(id, list.filter((candidate) => candidate.id !== subId));
    logAudit(user, 'vm.delete', vm.id);
    return send(res, 204);
  }
  return notImplemented(res, `vms ${method}`);
}

async function handleInfrastructure(req, res, { id, resource, subId, method }) {
  if (resource === 'disks' && method === 'GET') {
    return send(res, 200, disks.get(id) ?? []);
  }
  if (resource === 'disks' && method === 'POST') {
    const body = await readJson(req);
    if (!body?.name || !Number.isInteger(body.size_gb) || body.size_gb < 1 || !['qcow2', 'raw'].includes(body.format)) return malformed(res);
    const disk = { id: randomUUID(), hypervisor_id: id, ...body };
    disks.set(id, [...(disks.get(id) ?? []), disk]);
    return send(res, 201, disk);
  }
  if (resource === 'disks' && subId && method === 'DELETE') {
    const list = disks.get(id) ?? [];
    if (!list.some((disk) => disk.id === subId)) return err(res, 404, 'Disk not found');
    disks.set(id, list.filter((disk) => disk.id !== subId));
    return send(res, 204);
  }
  if (resource === 'networks' && method === 'GET') {
    return send(res, 200, networks.get(id) ?? []);
  }
  if (resource === 'networks' && method === 'POST') {
    const body = await readJson(req);
    if (!body?.name) return malformed(res);
    const network = { id: randomUUID(), hypervisor_id: id, name: body.name, bridge: body.bridge ?? null, status: 'inactive' };
    networks.set(id, [...(networks.get(id) ?? []), network]);
    return send(res, 201, network);
  }
  // Pas de DELETE pour les réseaux : la vraie API n'a pas (encore) cette route.
  return err(res, 404, 'Route not found');
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Fausse hypervisor-api sur http://127.0.0.1:${PORT} (mode ${FULL ? 'complet' : 'fidèle à l’API actuelle'})`);
  console.log('Comptes : admin / admin-password, alice / alice, bob / bob (voir l’en-tête du fichier).');
  console.log(`Jeton d'accès valable ${ACCESS_TTL} s (ACCESS_TTL=20 pour tester le refresh). Une URI contenant « fail » simule un hôte injoignable (502).`);
});
