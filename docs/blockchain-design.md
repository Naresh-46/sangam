# Blockchain plan for ANANTA

## The role blockchain should play

Use an EVM ledger as a shared integrity anchor for batch registration, accepted custody transfers and recalls. PostgreSQL remains the application's queryable operational store. A regulator, pharmacy or consumer should not need to run a node to use the website. The current integration is a local Hardhat demo with one deployer account, not a production network configuration.

At each committed workflow event, the API forms a canonical event payload and SHA-256 digest. The local prototype submits only that digest to the contract; the contract records its block timestamp. PostgreSQL retains the readable event and transaction hash. Verification recomputes the digest from the database event and checks whether that digest exists on the configured chain. A failed or pending ledger transaction is shown as pending; it is never called verified.

## Keep private or personal data off-chain

Do not put patient details, consumer scans, organization contact information, full license numbers, certificates, prices or the full medicine record on a public chain. Chain data and smart-contract calls are publicly inspectable on public Ethereum networks; use hashes and opaque identifiers only. The full evidence remains access-controlled off-chain.

## Contract actions

- Regulator-controlled organization wallet: approve/revoke an organization address.
- Approved manufacturer: register a batch commitment and initial custody.
- Current holder: offer a transfer to an approved organization.
- Intended recipient: accept the transfer; only acceptance updates custody.
- Regulator: flag or clear a recall using a controlled process.
- Emit events for every accepted action, including the sequence and payload hash.

Use least-privilege roles, explicit pause/emergency controls, and a reviewed recovery/migration plan. A deployed contract is difficult to change, so contract changes require a new version and documented migration.

## Network choice

1. Local Hardhat EVM chain for development and contract workflow demos (implemented).
2. Public test network for integration rehearsal only, with fake organizations and synthetic data.
3. Production network choice only after the participating organizations agree on governance, validator responsibility, identity/key custody, uptime, costs, public visibility and dispute handling.

If one company operates the only server and all participants already trust its operator, a well-audited append-only database may be simpler than blockchain. Blockchain becomes useful when independent organizations need to verify shared custody history without trusting one database operator. The local prototype does not implement participant governance, production key custody, retries after a node outage, or public-network deployment.

## User-facing meaning

The consumer page marks an event as chain-verified only when its stored data still hashes to the recorded digest and that digest is present on the configured ledger. It must never imply the ledger tested a tablet, checked packaging, or proved that a real-world hand-off occurred. QR codes remain identifiers, not authenticity devices.
