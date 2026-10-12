# Basic Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
node scripts/sample-script.js
npx hardhat help
```

The Celer deposit matcher has offline regression tests (Node.js 20 or newer):

```shell
npm run test:celer
npm run compile -- --noEmit --incremental false
```

The tests include the Ethereum deposit that caused the Conflux false alert,
V1 and V2 native/ERC20 receipt verification, and explorer pagination and retries.

Celer matching accepts only vaults on the source chain's allowlist. The pinned
Ethereum defaults are `0xB37D31b2A74029B5951a2778F959282E2D518595` (V1) and
`0x7510792A3B1969F9307F3845CE88e39578f2bAE1` (V2), verified against the Conflux
routes in [Celer's transfer configuration](https://cbridge-prod2.celer.app/v2/getTransferConfigs).
To add another source chain or replace these defaults, set `CELER_SOURCE_VAULTS`
to a JSON object mapping source chain IDs to arrays of independently verified
vault addresses. For example, this configuration permits only the Ethereum V2 vault:

```shell
export CELER_SOURCE_VAULTS='{"1":["0x7510792A3B1969F9307F3845CE88e39578f2bAE1"]}'
```

An empty array disables a chain; unlisted chains are rejected. Invalid configuration
raises an error. Celer references require vault and deposit-ID verification even
on explorer-only chains. Legacy non-Celer matching without a reference ID retains
its existing behavior. `ETH_RPC`, when configured, is used by a `JsonRpcProvider`;
otherwise Ethereum matching uses ethers' default provider.
