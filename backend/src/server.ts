import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Prisma, PrismaClient, type AuditEvent, type Organization, type User } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z, ZodError } from 'zod';
import { env } from './env.js';
import { hashAuditEvent, submitAuditEvent, verifyAuditHash } from './blockchain.js';

const prisma = new PrismaClient();
const trustedProxies = env.TRUSTED_PROXIES.split(',').map(value => value.trim()).filter(Boolean);
const app = Fastify({ logger: true, bodyLimit: 64 * 1024, trustProxy: trustedProxies.length ? trustedProxies : false });
const scrypt = promisify(scryptCallback);

declare module '@fastify/jwt' {
  interface FastifyJWT { payload: { sub: string; role: 'REGULATOR' | 'ORGANIZATION' }; user: { sub: string; role: 'REGULATOR' | 'ORGANIZATION' } }
}

await app.register(helmet, {
  frameguard: { action: 'deny' },
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
});
await app.register(cors, { origin: env.WEB_ORIGIN, methods: ['GET', 'POST'], allowedHeaders: ['Authorization', 'Content-Type'] });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: `${env.TOKEN_MINUTES}m` } });

app.decorate('authenticate', async (request: FastifyRequest) => {
  try { await request.jwtVerify(); }
  catch { throw Object.assign(new Error('Invalid or expired access token'), { statusCode: 401 }); }
});
declare module 'fastify' { interface FastifyInstance { authenticate: (request: FastifyRequest) => Promise<void> } }

const idSchema = z.string().uuid();
const emailSchema = z.string().email().max(254);
const strongPassword = z.string().min(12).max(128);
const orgKinds = ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY'] as const;
const parse = <T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> => schema.parse(value);
const error = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });

async function passwordHash(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}
async function passwordMatches(password: string, encoded: string) {
  try {
    const [algorithm, saltHex, hashHex] = encoded.split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}
const dummyPasswordHash = `scrypt$${randomBytes(16).toString('hex')}$${'0'.repeat(128)}`;
async function loadUser(request: FastifyRequest): Promise<User> {
  const id = request.user?.sub;
  if (!id) throw error(401, 'Sign-in required');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user?.active) throw error(401, 'Account is inactive');
  return user;
}
async function loadOrganization(request: FastifyRequest): Promise<{ user: User; org: Organization }> {
  const user = await loadUser(request);
  if (user.role !== 'ORGANIZATION' || !user.organizationId) throw error(403, 'Organization account required');
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
  if (!org?.approved) throw error(403, 'Approved organization account required');
  return { user, org };
}
async function requireRegulator(request: FastifyRequest) {
  const user = await loadUser(request);
  if (user.role !== 'REGULATOR') throw error(403, 'Regulator role required');
  return user;
}
async function audit(tx: Prisma.TransactionClient, batchId: string, actorUserId: string | null,
                     eventType: string, details: string) {
  const event = await tx.auditEvent.create({ data: { batchId, actorUserId, eventType, details } });
  const eventHash = hashAuditEvent(event);
  return tx.auditEvent.update({ where: { id: event.id }, data: { eventHash } });
}

function anchorAuditEvent(event: AuditEvent) {
  void submitAuditEvent(event, prisma).catch(err => {
    app.log.warn({ err, eventId: event.id }, 'Audit event was saved but blockchain anchoring did not complete');
  });
}

app.setErrorHandler((err, _request, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ error: 'Invalid request', details: err.flatten() });
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  if (statusCode >= 500) app.log.error(err);
  const message = err instanceof Error ? err.message : 'Request failed';
  return reply.code(statusCode).send({ error: statusCode >= 500 ? 'Internal server error' : message });
});

app.get('/health', async () => ({ status: 'ok' }));

app.post('/auth/bootstrap', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
  const body = parse(z.object({ email: emailSchema, password: strongPassword, bootstrapToken: z.string().min(1) }), request.body);
  const expected = Buffer.from(env.BOOTSTRAP_TOKEN);
  const received = Buffer.from(body.bootstrapToken);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw error(403, 'Invalid bootstrap token');
  let user: User;
  try {
    user = await prisma.$transaction(async tx => {
      if (await tx.user.count() > 0) throw error(409, 'Bootstrap has already been completed');
      return tx.user.create({ data: { email: body.email.toLowerCase(), passwordHash: await passwordHash(body.password), role: 'REGULATOR' } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 409) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(err.code)) {
      throw error(409, 'Bootstrap has already been completed or the email is already registered');
    }
    throw err;
  }
  return reply.code(201).send({ id: user.id, email: user.email, role: user.role });
});

app.post('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request) => {
  const body = parse(z.object({ email: emailSchema, password: z.string().min(1).max(128) }), request.body);
  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  const passwordIsValid = await passwordMatches(body.password, user?.passwordHash ?? dummyPasswordHash);
  if (!user?.active || !passwordIsValid) throw error(401, 'Invalid email or password');
  const accessToken = app.jwt.sign({ sub: user.id, role: user.role });
  return { accessToken, tokenType: 'Bearer', expiresIn: env.TOKEN_MINUTES * 60,
    user: { role: user.role } };
});

app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
  const user = await loadUser(request);
  const org = user.organizationId ? await prisma.organization.findUnique({ where: { id: user.organizationId } }) : null;
  return { id: user.id, email: user.email, role: user.role,
    organization: org ? { id: org.id, name: org.name, kind: org.kind, approved: org.approved } : null };
});

app.post('/organizations', { preHandler: [app.authenticate] }, async (request, reply) => {
  const actor = await requireRegulator(request);
  const body = parse(z.object({ name: z.string().trim().min(2).max(160), kind: z.enum(orgKinds),
    licenseNumber: z.string().trim().min(2).max(100), adminEmail: emailSchema,
    adminPassword: strongPassword }), request.body);
  try {
    const organization = await prisma.organization.create({ data: {
      name: body.name, kind: body.kind, licenseNumber: body.licenseNumber,
      users: { create: { email: body.adminEmail.toLowerCase(), passwordHash: await passwordHash(body.adminPassword), role: 'ORGANIZATION' } },
    }, include: { users: { select: { id: true, email: true } } } });
    return reply.code(201).send({ id: organization.id, name: organization.name, kind: organization.kind,
      approved: organization.approved, account: organization.users[0] });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw error(409, 'Email or license is already registered');
    throw err;
  }
});

app.post('/organizations/:organizationId/approve', { preHandler: [app.authenticate] }, async (request) => {
  await requireRegulator(request);
  const { organizationId } = parse(z.object({ organizationId: idSchema }), request.params);
  const updated = await prisma.organization.update({ where: { id: organizationId }, data: { approved: true } }).catch(() => null);
  if (!updated) throw error(404, 'Organization not found');
  return { id: updated.id, approved: updated.approved };
});

app.get('/organizations', { preHandler: [app.authenticate] }, async (request) => {
  await requireRegulator(request);
  return prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true, approved: true, licenseNumber: true } });
});

app.get('/organizations/active', { preHandler: [app.authenticate] }, async (request) => {
  const { org } = await loadOrganization(request);
  return prisma.organization.findMany({ where: { approved: true, id: { not: org.id } },
    orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true } });
});

app.get('/regulator/batches', { preHandler: [app.authenticate] }, async (request) => {
  await requireRegulator(request);
  const rows = await prisma.batch.findMany({ orderBy: { createdAt: 'desc' }, include: {
    manufacturer: { select: { name: true } }, currentHolder: { select: { name: true } },
  } });
  return rows.map(b => ({ id: b.id, medicineName: b.medicineName, batchNumber: b.batchNumber,
    expiryDate: b.expiryDate.toISOString().slice(0, 10), manufacturer: b.manufacturer.name,
    currentHolder: b.currentHolder.name, recalled: b.recalled }));
});

app.get('/admin/dashboard', { preHandler: [app.authenticate] }, async (request) => {
  await requireRegulator(request);
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const thirtyDaysFromToday = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [totalBatches, batchesThisMonth, totalOrganizations, approvedOrganizations,
    pendingApprovals, activeRecallCount, transferCount, organizationGroups,
    batchesInWindow, recallRows, recentEvents, organizations, batches,
    recentTransfers, nearExpiryBatches] = await Promise.all([
    prisma.batch.count(),
    prisma.batch.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { approved: true } }),
    prisma.organization.count({ where: { approved: false } }),
    prisma.batch.count({ where: { recalled: true } }),
    prisma.transfer.count(),
    prisma.organization.groupBy({ by: ['kind'], _count: { _all: true } }),
    prisma.batch.findMany({ where: { createdAt: { gte: ninetyDaysAgo } }, select: { createdAt: true } }),
    prisma.batch.findMany({ where: { recalled: true }, orderBy: { createdAt: 'desc' }, take: 5,
      include: { manufacturer: { select: { name: true } } } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: {
      actor: { select: { email: true } }, batch: { select: { batchNumber: true, medicineName: true } },
    } }),
    prisma.organization.findMany({ orderBy: { name: 'asc' }, select: {
      id: true, name: true, kind: true, approved: true, licenseNumber: true,
    } }),
    prisma.batch.findMany({ orderBy: { createdAt: 'desc' }, include: {
      manufacturer: { select: { name: true } }, currentHolder: { select: { name: true } },
    } }),
    prisma.transfer.findMany({ orderBy: { offeredAt: 'desc' }, take: 5, include: {
      batch: { select: { batchNumber: true, medicineName: true } },
      fromOrganization: { select: { name: true } }, toOrganization: { select: { name: true } },
    } }),
    prisma.batch.count({ where: { recalled: false, expiryDate: { gte: today, lte: thirtyDaysFromToday } } }),
  ]);

  const monthlyCounts = new Map<string, number>();
  for (const batch of batchesInWindow) {
    const month = batch.createdAt.toISOString().slice(0, 7);
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
  }
  const batchFlow: { month: string; count: number }[] = [];
  const cursor = new Date(Date.UTC(ninetyDaysAgo.getUTCFullYear(), ninetyDaysAgo.getUTCMonth(), 1));
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 7);
    batchFlow.push({ month: cursor.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }), count: monthlyCounts.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const alerts = [
    ...(activeRecallCount ? [{ type: 'recall', severity: 'warning', message: `${activeRecallCount} active recall${activeRecallCount === 1 ? '' : 's'} need review.` }] : []),
    ...(nearExpiryBatches ? [{ type: 'expiry', severity: 'warning', message: `${nearExpiryBatches} batch${nearExpiryBatches === 1 ? '' : 'es'} expire within 30 days.` }] : []),
    ...(pendingApprovals ? [{ type: 'approval', severity: 'info', message: `${pendingApprovals} organization${pendingApprovals === 1 ? '' : 's'} await approval.` }] : []),
  ];

  return {
    kpis: { totalBatches, batchesThisMonth, totalOrganizations, approvedOrganizations,
      pendingApprovals, activeRecalls: activeRecallCount, transferRecords: transferCount },
    batchFlow,
    orgDistribution: organizationGroups.map(group => ({ kind: group.kind, count: group._count._all })),
    activeRecalls: recallRows.map(batch => ({ id: batch.id, batchNumber: batch.batchNumber,
      medicineName: batch.medicineName, manufacturer: batch.manufacturer.name,
      expiryDate: batch.expiryDate.toISOString().slice(0, 10), quantity: batch.quantity,
      reason: batch.recallReason })),
    recentEvents: recentEvents.map(event => ({ id: event.id, type: event.eventType,
      actor: event.actor?.email ?? 'System', batchNumber: event.batch.batchNumber,
      medicineName: event.batch.medicineName, details: event.details, createdAt: event.createdAt })),
    custodyActivity: recentTransfers.map(transfer => ({ id: transfer.id,
      batchNumber: transfer.batch.batchNumber, medicineName: transfer.batch.medicineName,
      from: transfer.fromOrganization.name, to: transfer.toOrganization.name,
      status: transfer.status, offeredAt: transfer.offeredAt })),
    chainStatus: null,
    recallProgressAvailable: false,
    custodyCompletenessAvailable: false,
    alerts,
    organizations,
    batches: batches.map(batch => ({ id: batch.id, medicineName: batch.medicineName,
      batchNumber: batch.batchNumber, expiryDate: batch.expiryDate.toISOString().slice(0, 10),
      manufacturer: batch.manufacturer.name, currentHolder: batch.currentHolder.name,
      recalled: batch.recalled })),
  };
});

app.post('/batches', { preHandler: [app.authenticate] }, async (request, reply) => {
  const { user, org } = await loadOrganization(request);
  if (org.kind !== 'MANUFACTURER') throw error(403, 'Only manufacturers can register batches');
  const body = parse(z.object({ medicineName: z.string().trim().min(1).max(160), strength: z.string().trim().min(1).max(80),
    batchNumber: z.string().trim().min(1).max(100), expiryDate: z.coerce.date(), quantity: z.number().int().positive(),
    commonUse: z.string().trim().optional(),
    documentSha256: z.string().regex(/^[a-f\d]{64}$/i).optional() }), request.body);
  if (body.expiryDate < new Date(new Date().toISOString().slice(0, 10))) throw error(422, 'Expiry date must be today or later');
  const created = await prisma.$transaction(async tx => {
    const created = await tx.batch.create({ data: { ...body, manufacturerId: org.id, currentHolderId: org.id } });
    const auditEvent = await audit(tx, created.id, user.id, 'REGISTERED', `Registered by ${org.name}`);
    return { batch: created, auditEvent };
  });
  anchorAuditEvent(created.auditEvent);
  const batch = created.batch;
  return reply.code(201).send({ id: batch.id, medicineName: batch.medicineName, batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate.toISOString().slice(0, 10), quantity: batch.quantity,
    commonUse: batch.commonUse });
});

app.get('/batches', { preHandler: [app.authenticate] }, async (request) => {
  const { org } = await loadOrganization(request);
  const rows = await prisma.batch.findMany({ where: { currentHolderId: org.id }, orderBy: { createdAt: 'desc' },
    include: { manufacturer: { select: { name: true } } } });
  return rows.map(b => ({ id: b.id, medicineName: b.medicineName, batchNumber: b.batchNumber,
    expiryDate: b.expiryDate.toISOString().slice(0, 10), manufacturer: b.manufacturer.name,
    quantity: b.quantity, recalled: b.recalled }));
});

async function offerTransfer(request: FastifyRequest, reply: FastifyReply) {
  const { user, org } = await loadOrganization(request);
  const { batchId } = parse(z.object({ batchId: idSchema }), request.params);
  const { recipientOrganizationId } = parse(z.object({ recipientOrganizationId: idSchema }), request.body);
  const recipient = await prisma.organization.findUnique({ where: { id: recipientOrganizationId } });
  if (!recipient?.approved || recipient.id === org.id) throw error(422, 'Recipient must be a different approved organization');

  try {
    const created = await prisma.$transaction(async tx => {
      const batch = await tx.batch.findUnique({ where: { id: batchId } });
      if (!batch) throw error(404, 'Batch not found');
      if (batch.currentHolderId !== org.id) throw error(403, 'Only the current holder can transfer this batch');
      if (batch.recalled) throw error(409, 'Recalled batches cannot be transferred');
      const pending = await tx.transfer.findFirst({ where: { batchId, status: 'PENDING' } });
      if (pending) throw error(409, 'Batch already has a pending transfer');
      const transfer = await tx.transfer.create({ data: { batchId, fromOrganizationId: org.id, toOrganizationId: recipient.id } });
      const auditEvent = await audit(tx, batchId, user.id, 'TRANSFER_OFFERED', `Transfer offered to ${recipient.name}`);
      return { transfer, auditEvent };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    anchorAuditEvent(created.auditEvent);
    return reply.code(201).send({ id: created.transfer.id, batchId,
      recipientOrganizationId: recipient.id, status: created.transfer.status });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(err.code)) {
      throw error(409, 'Batch already has a pending transfer');
    }
    throw err;
  }
}

app.post('/batches/:batchId/offer', { preHandler: [app.authenticate] }, offerTransfer);
// Kept while the workspace UI moves to the /offer endpoint in its next section.
app.post('/batches/:batchId/transfers', { preHandler: [app.authenticate] }, offerTransfer);

app.get('/transfers/incoming', { preHandler: [app.authenticate] }, async (request) => {
  const { org } = await loadOrganization(request);
  return prisma.transfer.findMany({ where: { toOrganizationId: org.id, status: 'PENDING' }, orderBy: { offeredAt: 'asc' },
    select: { id: true, batchId: true, offeredAt: true,
      batch: { select: { batchNumber: true, medicineName: true } },
      fromOrganization: { select: { name: true, kind: true } } } });
});

async function confirmTransfer(transferId: string, user: User, org: Organization) {
  try {
    const confirmed = await prisma.$transaction(async tx => {
      const transfer = await tx.transfer.findUnique({ where: { id: transferId } });
      if (!transfer || transfer.toOrganizationId !== org.id) throw error(404, 'Incoming transfer not found');
      const batch = await tx.batch.findUnique({ where: { id: transfer.batchId } });
      if (!batch || transfer.status !== 'PENDING' || batch.currentHolderId !== transfer.fromOrganizationId) throw error(409, 'Transfer is no longer valid');
      if (batch.recalled) throw error(409, 'Recalled batches cannot be confirmed');
      await tx.transfer.update({ where: { id: transfer.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
      await tx.batch.update({ where: { id: batch.id }, data: { currentHolderId: org.id } });
      const auditEvent = await audit(tx, batch.id, user.id, 'TRANSFER_CONFIRMED', `Transfer confirmed by ${org.name}`);
      return { response: { transferId, batchId: batch.id, status: 'CONFIRMED' }, auditEvent };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    anchorAuditEvent(confirmed.auditEvent);
    return confirmed.response;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') throw error(409, 'Concurrent transfer update; retry the request');
    throw err;
  }
}

app.post('/batches/:batchId/accept', { preHandler: [app.authenticate] }, async request => {
  const { user, org } = await loadOrganization(request);
  const { batchId } = parse(z.object({ batchId: idSchema }), request.params);
  const transfer = await prisma.transfer.findFirst({ where: { batchId, status: 'PENDING' } });
  if (!transfer || transfer.toOrganizationId !== org.id) throw error(404, 'Incoming transfer not found');
  return confirmTransfer(transfer.id, user, org);
});

// Kept while the workspace UI moves to the batch-scoped route in its next section.
app.post('/transfers/:transferId/accept', { preHandler: [app.authenticate] }, async request => {
  const { user, org } = await loadOrganization(request);
  const { transferId } = parse(z.object({ transferId: idSchema }), request.params);
  return confirmTransfer(transferId, user, org);
});

app.post('/batches/:batchId/reject', { preHandler: [app.authenticate] }, async request => {
  const { user, org } = await loadOrganization(request);
  const { batchId } = parse(z.object({ batchId: idSchema }), request.params);
  const rejected = await prisma.$transaction(async tx => {
    const transfer = await tx.transfer.findFirst({ where: { batchId, status: 'PENDING' } });
    if (!transfer || transfer.toOrganizationId !== org.id) throw error(404, 'Incoming transfer not found');
    await tx.transfer.update({ where: { id: transfer.id }, data: { status: 'REJECTED' } });
    const auditEvent = await audit(tx, batchId, user.id, 'TRANSFER_REJECTED', 'Transfer rejected by recipient');
    return { transfer, auditEvent };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  anchorAuditEvent(rejected.auditEvent);
  return { transferId: rejected.transfer.id, batchId, status: 'REJECTED' };
});

app.get('/batches/:batchId/transfers', { preHandler: [app.authenticate] }, async request => {
  const user = await loadUser(request);
  const { batchId } = parse(z.object({ batchId: idSchema }), request.params);
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, select: { id: true } });
  if (!batch) throw error(404, 'Batch not found');
  const where: Prisma.TransferWhereInput = { batchId };
  if (user.role !== 'REGULATOR') {
    const { org } = await loadOrganization(request);
    where.OR = [{ fromOrganizationId: org.id }, { toOrganizationId: org.id }];
  }
  return prisma.transfer.findMany({ where, orderBy: { offeredAt: 'asc' }, include: {
    fromOrganization: { select: { id: true, name: true, kind: true } },
    toOrganization: { select: { id: true, name: true, kind: true } },
  } });
});

app.post('/batches/:batchId/recall', { preHandler: [app.authenticate] }, async (request) => {
  const actor = await requireRegulator(request);
  const { batchId } = parse(z.object({ batchId: idSchema }), request.params);
  const { reason } = parse(z.object({ reason: z.string().trim().min(4).max(2000) }), request.body);
  const recalled = await prisma.$transaction(async tx => {
    const found = await tx.batch.findUnique({ where: { id: batchId } });
    if (!found) throw error(404, 'Batch not found');
    if (found.recalled) throw error(409, 'Batch is already recalled');
    const updated = await tx.batch.update({ where: { id: batchId }, data: { recalled: true, recallReason: reason } });
    const auditEvent = await audit(tx, batchId, actor.id, 'RECALLED', reason);
    return { batch: updated, auditEvent };
  });
  anchorAuditEvent(recalled.auditEvent);
  const batch = recalled.batch;
  return { id: batch.id, recalled: batch.recalled };
});

app.get('/verify/:batchId', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
  const { batchId } = parse(z.object({ batchId: idSchema }), request.params);
  const batch = await prisma.batch.findUnique({ where: { id: batchId }, include: {
    manufacturer: { select: { name: true } }, currentHolder: { select: { name: true } },
    auditEvents: { orderBy: { createdAt: 'asc' }, select: {
      id: true, batchId: true, actorUserId: true, eventType: true, details: true,
      createdAt: true, eventHash: true,
    } },
  } });
  if (!batch) return { status: 'INVALID_IDENTIFIER', message: 'No registered batch matches this identifier.' };
  const today = new Date(new Date().toISOString().slice(0, 10));
  const status = batch.recalled ? 'RECALLED' : batch.expiryDate < today ? 'EXPIRED' : 'RECORDED';
  const relevantEvents = batch.auditEvents.filter(e => ['REGISTERED', 'TRANSFER_ACCEPTED', 'TRANSFER_CONFIRMED', 'RECALLED'].includes(e.eventType));
  const custodyHistory = await Promise.all(relevantEvents.map(async event => {
    let chainStatus: 'VERIFIED' | 'PENDING' | 'INTEGRITY_MISMATCH' = 'PENDING';
    if (event.eventHash && hashAuditEvent(event) !== event.eventHash) {
      chainStatus = 'INTEGRITY_MISMATCH';
    } else if (event.eventHash) {
      try {
        if (await verifyAuditHash(event.eventHash)) chainStatus = 'VERIFIED';
      } catch {
        // The public registry remains available while the local chain is offline.
      }
    }
    return {
      event: event.eventType,
      details: event.eventType === 'REGISTERED' ? 'Batch registered' : event.eventType === 'RECALLED' ? 'Recall issued' : 'Custody transfer confirmed',
      at: event.createdAt,
      chainStatus,
    };
  }));
  return { status, medicineName: batch.medicineName, strength: batch.strength, commonUse: batch.commonUse,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate.toISOString().slice(0, 10), manufacturer: batch.manufacturer.name,
    currentHolder: batch.currentHolder.name,
    custodyHistory,
    notice: 'This result checks registry records only; it cannot prove the physical medicine is genuine.' };
});

app.addHook('onClose', async () => { await prisma.$disconnect(); });
try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
