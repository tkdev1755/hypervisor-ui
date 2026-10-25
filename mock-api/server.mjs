// =============================================================================
// Une fausse hypervisor-api, pour développer le front sans Linux ni libvirt.
//
//   npm run mock        se comporte comme la vraie API sans hyperviseur réel :
//                       authentification, hyperviseurs et utilisateurs OK, mais
//                       VM / disques / réseaux en 501.
//   npm run mock:full   renvoie aussi des VM, disques, réseaux et templates d'exemple,
//                       pour construire les écrans avant que l'API soit prête.
//
// TEMPLATES (mode full) : chaque construction crée une version. Une « construction Packer » dure
//   ~12 s (2 s en attente, puis un journal qui se remplit chaque seconde). Une configuration qui
//   contient le mot « fail » échoue, pour voir l'affichage de l'erreur. « debian-12 » a deux versions
//   prêtes ; « ubuntu-24 » est restreint (alice y a accès) et sa version 2 a raté ; « alpine-3 » est
//   désactivé (allow_vm_creation: false) : listé quand même, mais toute création de VM répond 409.
//
// Mêmes routes, même port (3000) et même format d'erreur { status, content }
// que l'API Rust. Les données sont en mémoire : elles disparaissent à l'arrêt.
// Aucune dépendance : seulement le module http de Node.
//
// GROUPES (comme groups.rs) : « etudiants » contient alice et le sous-groupe « promo-2026 » (bob) ;
//   « enseignants » est vide. Seuls les admins voient /api/groups ; chacun voit les siens (/api/me/groups).
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
const templates = new Map(); // hypervisorId -> Template[] ; chaque template garde versions[] et access (Map userId -> date)

const users = new Map(); // userId -> { id, username, password, role, disabled, created_at, quota }
const accessTokens = new Map(); // jeton -> { userId, expires }
const refreshTokens = new Map(); // refresh token -> { userId, expires }
const failures = new Map(); // nom d'utilisateur -> nombre d'échecs
const settings = { registration_open: false };
const audit = []; // le plus récent en premier
const groups = new Map(); // groupId -> { id, name, description, created_at, updated_at, members: Map(userId -> date), subgroups: Map(childId -> date) }

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
  templates.set(hypervisor.id, []);
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
addVm(local.id, 'db-01', 8192, 4, 'stopped', null); // créée « hors de l'API » : sans propriétaire
const bobVm = addVm(local.id, 'bob-vm', 2048, 1, 'stopped', bob);
function addTemplate(hypervisorId, name, visibility, versionStates, allowVmCreation = true) {
  const config = `source "qemu" "${name}" {\n  vm_name = "${name}.qcow2"\n}\n`;
  const template = {
    id: randomUUID(), hypervisor_id: hypervisorId, name, packer_config: config, disk_name: `${name}.qcow2`, pool: 'default',
    visibility, allow_vm_creation: allowVmCreation, created_at: now() - 86400, updated_at: now() - 86400, versions: [], access: new Map(),
  };
  versionStates.forEach((status, index) => {
    template.versions.push({
      template_id: template.id, version: index + 1, packer_config: config, disk_name: template.disk_name, pool: 'default',
      volume: `template-${name}-v${index + 1}.qcow2`, status, disk_size_gb: status === 'created' ? 10 : null,
      error: status === 'failed' ? "Build 'qemu.ubuntu' errored after 2 minutes: Timeout waiting for SSH." : null,
      log: `==> qemu.${name}: Downloading ISO...\n==> qemu.${name}: Starting VM...\n` + (status === 'failed' ? "Build 'qemu.ubuntu' errored after 2 minutes: Timeout waiting for SSH.\n" : '==> upload done\n'),
      created_at: now() - 86400 + index * 3600, started_at: now() - 86400 + index * 3600, finished_at: now() - 86000 + index * 3600,
    });
  });
  templates.get(hypervisorId).push(template);
  return template;
}
addTemplate(local.id, 'debian-12', 'hypervisor', ['created', 'created']);
addTemplate(local.id, 'ubuntu-24', 'restricted', ['created', 'failed']).access.set(alice.id, now());
addTemplate(local.id, 'alpine-3', 'hypervisor', ['created'], false);
function addGroup(name, description) {
  const group = { id: randomUUID(), name, description, created_at: now(), updated_at: now(), members: new Map(), subgroups: new Map() };
  groups.set(group.id, group);
  return group;
}
const etudiants = addGroup('etudiants', 'Tous les étudiants');
const promo = addGroup('promo-2026', 'La promotion 2026');
addGroup('enseignants', '');
etudiants.members.set(alice.id, now());
promo.members.set(bob.id, now());
etudiants.subgroups.set(promo.id, now());
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

  // GET /api/me/groups : chacun voit ses groupes (lecture seule).
  if (parts[1] === 'me' && parts[2] === 'groups' && method === 'GET') return send(res, 200, groupsOf(user.id));
  if (parts[1] === 'groups') {
    if (adminOnly()) return;
    return handleGroups(req, res, parts, method, user);
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
  if (sub === 'groups' && method === 'GET') return send(res, 200, groupsOf(target.id));
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
      for (const group of groups.values()) group.members.delete(target.id); // comme ON DELETE CASCADE
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

// --- /api/groups/* (comme groups.rs) -------------------------------------------------
/** Le groupe et tous ceux qu'il contient, à n'importe quelle profondeur (ids). */
function subtree(groupId) {
  const seen = new Set([groupId]);
  const queue = [groupId];
  while (queue.length) {
    for (const child of groups.get(queue.shift())?.subgroups.keys() ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return seen;
}
/** Les groupes d'un utilisateur : ceux où il est, puis ceux qui les contiennent, etc. (`direct` s'il y est lui-même). */
function groupsOf(userId) {
  return [...groups.values()]
    .map((group) => {
      const inside = [...subtree(group.id)].some((id) => groups.get(id)?.members.has(userId));
      return inside ? { id: group.id, name: group.name, description: group.description, direct: group.members.has(userId) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}
function groupView(group) {
  const { members, subgroups, ...rest } = group;
  return { ...rest, member_count: members.size, subgroup_count: subgroups.size };
}
const groupRefs = (entries) => [...entries].map(([id, added_at]) => ({ id, name: groups.get(id)?.name, added_at })).sort((a, b) => a.name.localeCompare(b.name));
/** Vérifie nom et description ; renvoie le message d'erreur de l'API, ou null. */
function groupProblem(body) {
  const name = String(body.name ?? '').trim();
  if (!name || name.length > 64) return 'name must be 1 to 64 printable characters';
  if (String(body.description ?? '').trim().length > 500) return 'description must be at most 500 printable characters';
  return null;
}
const nameTaken = (name, exceptId) => [...groups.values()].some((g) => g.id !== exceptId && g.name.toLowerCase() === name.trim().toLowerCase());

async function handleGroups(req, res, parts, method, user) {
  const [, , id, sub, subId] = parts;
  if (!id) {
    if (method === 'GET') return send(res, 200, [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)).map(groupView));
    if (method === 'POST') {
      const body = await readJson(req);
      if (!body) return malformed(res);
      const problem = groupProblem(body);
      if (problem) return err(res, 400, problem);
      if (nameTaken(body.name)) return err(res, 409, 'A group with this name already exists');
      const group = addGroup(body.name.trim(), String(body.description ?? '').trim());
      logAudit(user, 'group.create', group.id, group.name);
      return send(res, 201, groupView(group));
    }
  }
  const group = groups.get(id);
  if (!group) return err(res, 404, 'Group not found');

  if (!sub) {
    if (method === 'GET') {
      const parents = [...groups.values()].filter((g) => g.subgroups.has(group.id)).map((g) => [g.id, g.subgroups.get(group.id)]);
      const members = [...group.members].map(([userId, added_at]) => ({ user_id: userId, username: users.get(userId)?.username, added_at }));
      const { members: _m, subgroups: _s, ...rest } = group;
      return send(res, 200, { ...rest, members: members.sort((a, b) => a.username.localeCompare(b.username)), subgroups: groupRefs(group.subgroups), parents: groupRefs(parents) });
    }
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (!body) return malformed(res);
      const next = { name: body.name ?? group.name, description: body.description ?? group.description };
      const problem = groupProblem(next);
      if (problem) return err(res, 400, problem);
      if (nameTaken(next.name, group.id)) return err(res, 409, 'A group with this name already exists');
      Object.assign(group, { name: next.name.trim(), description: String(next.description).trim(), updated_at: now() });
      logAudit(user, 'group.update', group.id, group.name);
      return send(res, 200, groupView(group));
    }
    if (method === 'DELETE') {
      groups.delete(group.id);
      for (const other of groups.values()) other.subgroups.delete(group.id); // comme ON DELETE CASCADE
      logAudit(user, 'group.delete', group.id, group.name);
      return send(res, 204);
    }
  }
  if (sub === 'members' && !subId && method === 'GET') {
    const everyone = new Map();
    for (const gid of subtree(group.id)) {
      for (const userId of groups.get(gid).members.keys()) {
        everyone.set(userId, everyone.get(userId) || gid === group.id);
      }
    }
    const list = [...everyone].map(([userId, direct]) => ({ user_id: userId, username: users.get(userId)?.username, direct }));
    return send(res, 200, list.sort((a, b) => a.username.localeCompare(b.username)));
  }
  if (sub === 'members' && subId) {
    if (method === 'PUT') {
      const member = users.get(subId);
      if (!member) return err(res, 404, 'User not found');
      if (!group.members.has(subId)) group.members.set(subId, now());
      logAudit(user, 'group.add_member', group.id, member.username);
      return send(res, 204);
    }
    if (method === 'DELETE') {
      if (!group.members.delete(subId)) return err(res, 404, 'The user is not in this group');
      logAudit(user, 'group.remove_member', group.id, subId);
      return send(res, 204);
    }
  }
  if (sub === 'subgroups' && subId) {
    if (method === 'PUT') {
      const child = groups.get(subId);
      if (!child) return err(res, 404, 'Group not found');
      if (child.id === group.id) return err(res, 400, 'A group cannot contain itself');
      if (subtree(child.id).has(group.id)) return err(res, 409, `${group.name} is already inside ${child.name}: adding it would put the group inside itself`);
      if (!group.subgroups.has(child.id)) group.subgroups.set(child.id, now());
      logAudit(user, 'group.add_subgroup', group.id, child.name);
      return send(res, 204);
    }
    if (method === 'DELETE') {
      if (!group.subgroups.delete(subId)) return err(res, 404, 'This group is not a subgroup of the group');
      logAudit(user, 'group.remove_subgroup', group.id, subId);
      return send(res, 204);
    }
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

  // Templates : les admins voient tout ; un utilisateur doit avoir l'accès à l'hyperviseur (sinon 403).
  if (resource === 'templates') {
    if (!FULL) return notImplemented(res, `${resource} ${method}`);
    return handleTemplates(req, res, { id, subId, action, extra, method, url, user, forbidden });
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
      const vm = addVm(id, body.name, body.memory_mb, body.vcpus, body.start ? 'running' : 'stopped', owner);
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
    vm.status = action === 'start' ? 'running' : 'stopped';
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
      const copy = addVm(id, body.name, vm.memory_mb, vm.vcpus, 'stopped', user);
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

// --- Templates (comme templates.rs) ---------------------------------------------------
const NAME_PATTERN = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,63}$/;
const BUILDING = ['pending', 'in_progress', 'stopping'];
const builtVersions = (template) => template.versions.filter((v) => v.status === 'created');
const runningBuild = (template) => template.versions.find((v) => BUILDING.includes(v.status));

/** Un utilisateur ne voit que les templates ouverts à lui ET qui ont une version prête. */
function canUseTemplate(template, user) {
  if (isAdmin(user)) return true;
  const open = template.visibility === 'hypervisor' || template.access.has(user.id);
  return open && builtVersions(template).length > 0;
}
/** Sans la configuration ni l'erreur (et sans le journal, interne) pour un utilisateur. */
function versionView(version, user) {
  const { log, timers, ...rest } = version;
  if (isAdmin(user)) return rest;
  const { packer_config, error, ...visible } = rest;
  return visible;
}
function templateView(template, user) {
  const { versions, access: granted, ...rest } = template;
  const shown = isAdmin(user) ? versions : builtVersions(template);
  const latest = shown[shown.length - 1] ?? null;
  const built = builtVersions(template);
  const view = {
    ...rest,
    status: latest?.status ?? null,
    default_version: built.length ? built[built.length - 1].version : null,
    latest_version: latest ? versionView(latest, user) : null,
  };
  if (!isAdmin(user)) delete view.packer_config;
  return view;
}

/** La « construction Packer » d'une nouvelle version : 2 s d'attente, puis 10 lignes de journal. */
function startBuild(template, user) {
  const number = (template.versions[template.versions.length - 1]?.version ?? 0) + 1;
  const version = {
    template_id: template.id, version: number, packer_config: template.packer_config, disk_name: template.disk_name, pool: template.pool,
    volume: `template-${template.name}-v${number}.qcow2`, status: 'pending', disk_size_gb: null, error: null, log: '',
    created_at: now(), started_at: null, finished_at: null, timers: [],
  };
  template.versions.push(version);
  const steps = ['packer init', 'packer build', 'Downloading ISO', 'Creating VM', 'Waiting for SSH', 'Connected to SSH', 'Provisioning with shell script', 'apt-get upgrade', 'Gracefully halting VM', 'Converting disk'];
  version.timers.push(setTimeout(() => Object.assign(version, { status: 'in_progress', started_at: now() }), 2000));
  steps.forEach((step, index) => {
    version.timers.push(setTimeout(() => (version.log += `==> qemu.${template.name}: ${step}...\n`), 2500 + index * 1000));
  });
  version.timers.push(setTimeout(() => {
    if (template.packer_config.includes('fail')) {
      const error = `==> qemu.${template.name}: Error launching VM: Qemu failed to start.\nBuild finished with errors.`;
      version.log += error + '\n';
      Object.assign(version, { status: 'failed', error, finished_at: now() });
    } else {
      version.log += `==> upload to ${version.pool}/${version.volume}\n`;
      Object.assign(version, { status: 'created', disk_size_gb: 10, finished_at: now() });
    }
  }, 13000));
  logAudit(user, 'template.rebuild', `${template.hypervisor_id}/${template.id}`, `version ${number}`);
  return version;
}

/** Arrêter : l'arrêt propre prend 2 s (« stopping »), l'arrêt forcé est immédiat. */
function stopBuild(version, force) {
  version.timers.forEach(clearTimeout);
  version.timers = [];
  const finish = () => {
    version.log += '==> Build cancelled by an administrator\n';
    Object.assign(version, { status: 'cancelled', finished_at: now() });
  };
  if (force) return finish();
  version.status = 'stopping';
  version.log += '==> Interrupt received. Cleaning up...\n';
  version.timers.push(setTimeout(finish, 2000));
}

/** Vérifie la définition d'un template (POST ou PATCH) ; renvoie le message d'erreur de l'API, ou null. */
function templateProblem(definition) {
  if (!NAME_PATTERN.test(definition.name ?? '')) return "name must be 1-64 characters: letters, digits, '-', '_' or '.' (not leading)";
  if (!NAME_PATTERN.test(definition.disk_name ?? '')) return "disk_name must be the file name of the disk Packer writes: 1-64 characters, letters, digits, '-', '_' or '.' (not leading)";
  if (!String(definition.packer_config ?? '').trim()) return 'packer_config must be a non-empty text of at most 65536 bytes';
  if (definition.visibility && !['hypervisor', 'restricted'].includes(definition.visibility)) return 'Invalid visibility';
  if (definition.allow_vm_creation !== undefined && typeof definition.allow_vm_creation !== 'boolean') return 'Failed to deserialize the JSON body';
  return null;
}

async function handleTemplates(req, res, { id, subId, action, extra, method, url, user, forbidden }) {
  if (!canCreateVm(id, user)) return forbidden('No access to this hypervisor');
  const list = templates.get(id) ?? [];
  const admin = isAdmin(user);

  if (!subId && method === 'GET') {
    return send(res, 200, list.filter((t) => canUseTemplate(t, user)).sort((a, b) => a.name.localeCompare(b.name)).map((t) => templateView(t, user)));
  }
  if (!subId && method === 'POST') {
    if (!admin) return forbidden();
    const body = await readJson(req);
    if (!body) return malformed(res);
    const problem = templateProblem(body);
    if (problem) return err(res, 400, problem);
    if (list.some((t) => t.name === body.name)) return err(res, 409, 'A template with this name already exists on this hypervisor');
    const template = {
      id: randomUUID(), hypervisor_id: id, name: body.name, packer_config: body.packer_config, disk_name: body.disk_name,
      pool: body.pool ?? 'default', visibility: body.visibility ?? 'hypervisor', allow_vm_creation: body.allow_vm_creation ?? true, created_at: now(), updated_at: now(), versions: [], access: new Map(),
    };
    list.push(template);
    logAudit(user, 'template.create', `${id}/${template.id}`, body.name);
    startBuild(template, user);
    res.setHeader('Location', `/api/hypervisors/${id}/templates/${template.id}`);
    return send(res, 202, templateView(template, user));
  }

  const template = list.find((t) => t.id === subId && canUseTemplate(t, user));
  if (!template) return err(res, 404, 'Template not found');

  if (!action) {
    if (method === 'GET') return send(res, 200, templateView(template, user));
    if (!admin) return forbidden();
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (!body) return malformed(res);
      const next = {
        name: body.name ?? template.name, packer_config: body.packer_config ?? template.packer_config,
        disk_name: body.disk_name ?? template.disk_name, pool: body.pool ?? template.pool, visibility: body.visibility ?? template.visibility,
        allow_vm_creation: body.allow_vm_creation ?? template.allow_vm_creation,
      };
      const problem = templateProblem(next);
      if (problem) return err(res, 400, problem);
      if (list.some((t) => t.id !== template.id && t.name === next.name)) return err(res, 409, 'A template with this name already exists on this hypervisor');
      Object.assign(template, next, { updated_at: now() });
      logAudit(user, 'template.update', `${id}/${template.id}`, template.name);
      return send(res, 200, templateView(template, user));
    }
    if (method === 'DELETE') {
      if (runningBuild(template)) return err(res, 409, 'The template is being built: stop the build first');
      templates.set(id, list.filter((t) => t.id !== template.id));
      logAudit(user, 'template.delete', `${id}/${template.id}`, template.name);
      return send(res, 204);
    }
  }

  if (action === 'versions') {
    if (!extra) {
      if (method === 'GET') {
        const shown = admin ? template.versions : builtVersions(template);
        return send(res, 200, [...shown].reverse().map((v) => versionView(v, user)));
      }
      if (method === 'POST') {
        if (!admin) return forbidden();
        if (runningBuild(template)) return err(res, 409, 'A build of this template is already running');
        const version = startBuild(template, user);
        res.setHeader('Location', `/api/hypervisors/${id}/templates/${template.id}/versions/${version.version}`);
        return send(res, 202, versionView(version, user));
      }
    }
    const [, , , , , , number, logs] = url.pathname.split('/').filter(Boolean);
    const version = template.versions.find((v) => String(v.version) === number && (admin || v.status === 'created'));
    if (!version) return err(res, 404, 'Template version not found');
    if (logs === 'logs' && method === 'GET') {
      if (!admin) return forbidden();
      const offset = Number(url.searchParams.get('offset') ?? 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > version.log.length) return err(res, 400, 'Invalid offset: use the next_offset of a previous call');
      return send(res, 200, {
        template_id: template.id, version: version.version, status: version.status, finished: !BUILDING.includes(version.status),
        offset, next_offset: version.log.length, content: version.log.slice(offset), truncated: false,
      });
    }
    if (!logs && method === 'GET') return send(res, 200, versionView(version, user));
    if (!logs && method === 'DELETE') {
      if (!admin) return forbidden();
      if (BUILDING.includes(version.status)) return err(res, 409, 'This version is being built: stop the build first');
      template.versions = template.versions.filter((v) => v !== version);
      logAudit(user, 'template.version_delete', `${id}/${template.id}`, `version ${version.version}`);
      return send(res, 204);
    }
  }

  if (action === 'stop' && method === 'POST') {
    if (!admin) return forbidden();
    const version = runningBuild(template);
    if (!version) return err(res, 409, 'No build of this template is running');
    const force = url.searchParams.get('force') === 'true';
    stopBuild(version, force);
    logAudit(user, force ? 'template.stop_force' : 'template.stop', `${id}/${template.id}`, `version ${version.version}`);
    res.setHeader('Location', `/api/hypervisors/${id}/templates/${template.id}/versions/${version.version}`);
    return send(res, 202, versionView(version, user));
  }

  if (action === 'access') {
    if (!admin) return forbidden();
    if (!extra && method === 'GET') {
      const entries = [...template.access].map(([userId, created_at]) => ({ user_id: userId, username: users.get(userId)?.username, created_at }));
      return send(res, 200, entries.sort((a, b) => a.username.localeCompare(b.username)));
    }
    if (extra && method === 'PUT') {
      if (!users.has(extra)) return err(res, 404, 'User not found');
      if (!template.access.has(extra)) template.access.set(extra, now());
      logAudit(user, 'template.grant', `${id}/${template.id}`, extra);
      return send(res, 204);
    }
    if (extra && method === 'DELETE') {
      if (!template.access.delete(extra)) return err(res, 404, 'Access not found');
      logAudit(user, 'template.revoke', `${id}/${template.id}`, extra);
      return send(res, 204);
    }
  }

  if (action === 'vms' && method === 'POST') {
    const body = await readJson(req);
    if (!body?.name || !Number.isInteger(body.memory_mb) || !Number.isInteger(body.vcpus)) return malformed(res);
    // Comme l'API : un template désactivé est refusé à tout le monde, administrateurs compris.
    if (!template.allow_vm_creation) return err(res, 409, 'Creating VMs from this template is disabled');
    const built = builtVersions(template);
    let version;
    if (body.version !== undefined && body.version !== null) {
      version = template.versions.find((v) => v.version === body.version && (admin || v.status === 'created'));
      if (!version) return err(res, 404, 'Template version not found');
      if (version.status !== 'created') return err(res, 409, 'This version of the template is not built');
    } else {
      version = built[built.length - 1];
      if (!version) return err(res, 409, 'The template has no built version yet');
    }
    if (!NAME_PATTERN.test(body.name)) return err(res, 400, 'Invalid VM name');
    if (body.owner_id && !admin) return forbidden();
    const owner = body.owner_id ? users.get(body.owner_id) : user;
    if (!owner) return err(res, 404, 'Owner not found');
    if ((vms.get(id) ?? []).some((vm) => vm.name === body.name)) return err(res, 409, 'A VM with this name already exists');
    if (body.network === 'isolated') return err(res, 409, 'The network is not active');
    const violation = quotaViolation(owner, { vcpus: body.vcpus, memory_mb: body.memory_mb, disk_gb: version.disk_size_gb ?? 0 });
    if (violation) return forbidden(violation);
    const job = { id: randomUUID(), kind: 'template_vm', status: 'running', owner_id: owner.id };
    jobs.set(job.id, job);
    logAudit(user, 'template.vm_create', `${id}/${template.id}`, `${body.name} (version ${version.version})`);
    // La « copie du disque » dure 3 secondes.
    setTimeout(() => {
      const vm = addVm(id, body.name, body.memory_mb, body.vcpus, body.start ? 'running' : 'stopped', owner);
      Object.assign(job, { status: 'succeeded', result: vmView(vm, user) });
    }, 3000);
    res.setHeader('Location', `/api/jobs/${job.id}`);
    const { owner_id, ...shown } = job;
    return send(res, 202, shown);
  }
  return err(res, 404, 'Route not found');
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
