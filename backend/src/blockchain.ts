import { createHash } from 'node:crypto';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import type { AuditEvent, PrismaClient } from '@prisma/client';
import { env } from './env.js';

const anchorAbi = [
  'function anchor(bytes32 eventHash)',
  'function verify(bytes32 eventHash) view returns (bool)',
];

type HashSource = Pick<AuditEvent,
  'id' | 'batchId' | 'actorUserId' | 'eventType' | 'details' | 'createdAt'>;

let provider: JsonRpcProvider | undefined;
let readContract: Contract | undefined;
let writeContract: Contract | undefined;

export function hashAuditEvent(event: HashSource): string {
  const canonicalEvent = JSON.stringify({
    id: event.id,
    batchId: event.batchId,
    actorUserId: event.actorUserId,
    eventType: event.eventType,
    details: event.details,
    createdAt: event.createdAt.toISOString(),
  });
  return `0x${createHash('sha256').update(canonicalEvent).digest('hex')}`;
}

function getProvider() {
  if (!env.BLOCKCHAIN_RPC_URL) return null;
  provider ??= new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
  return provider;
}

function getReader() {
  const rpc = getProvider();
  if (!rpc || !env.ANCHOR_CONTRACT_ADDRESS) return null;
  readContract ??= new Contract(env.ANCHOR_CONTRACT_ADDRESS, anchorAbi, rpc);
  return readContract;
}

function getWriter() {
  const rpc = getProvider();
  if (!rpc || !env.ANCHOR_CONTRACT_ADDRESS || !env.BLOCKCHAIN_PRIVATE_KEY) return null;
  writeContract ??= new Contract(
    env.ANCHOR_CONTRACT_ADDRESS,
    anchorAbi,
    new Wallet(env.BLOCKCHAIN_PRIVATE_KEY, rpc),
  );
  return writeContract;
}

export async function submitAuditEvent(event: AuditEvent, prisma: PrismaClient) {
  const contract = getWriter();
  if (!contract || !event.eventHash) return;
  if (hashAuditEvent(event) !== event.eventHash) {
    throw new Error(`Audit event ${event.id} no longer matches its stored hash`);
  }

  const alreadyAnchored = Boolean(
    await contract.getFunction('verify').staticCall(event.eventHash),
  );
  if (alreadyAnchored) return;

  const transaction = await contract.getFunction('anchor').send(event.eventHash);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Anchor transaction ${transaction.hash} was not confirmed`);
  }
  await prisma.auditEvent.update({
    where: { id: event.id },
    data: { txHash: transaction.hash },
  });
}

export async function verifyAuditHash(eventHash: string): Promise<boolean | null> {
  const contract = getReader();
  if (!contract) return null;
  return Boolean(await contract.getFunction('verify').staticCall(eventHash));
}
