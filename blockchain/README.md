# Local audit anchors

This Hardhat project stores SHA-256 digests of audit events on a local development chain. Full event data stays in PostgreSQL.

## Run locally

1. Start the local node in this directory: `npm run node`.
2. In another terminal, deploy with `npm run deploy`.
3. Copy the printed address to `ANCHOR_CONTRACT_ADDRESS` in `backend/.env`.
4. Set `BLOCKCHAIN_RPC_URL` and `BLOCKCHAIN_PRIVATE_KEY` in `backend/.env`. For a local demo, use a private key printed by this local Hardhat node only.
5. Start the backend and frontend from the project root.

Useful commands: `npm run compile` and `npm test`.

The local chain is temporary. Restarting it clears deployed contracts and stored anchors, so deploy again and update the backend address. If the chain is unavailable, the application still records audit events in PostgreSQL; their chain status stays pending. Failed submissions are logged and are not automatically retried.

This is a local demonstration, not a production key-management or durable transaction queue setup.
