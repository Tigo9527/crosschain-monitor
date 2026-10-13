# Basic Sample Hardhat Project

To run the ten backend processes under Docker Compose, see [the deployment guide](docs/docker-compose.md).

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

Backend TypeScript sources live in `lib`, `sync`, and `web`. Run `npm run compile`
before starting a backend entry point with Node.js. Generated JavaScript, source
maps, and TypeScript build caches are ignored by Git; edit the TypeScript sources.

The Celer deposit matcher has offline regression tests (Node.js 20 or newer):

```shell
npm run test:celer
npm run compile -- --noEmit --incremental false
```

The tests include the Ethereum deposit that caused the Conflux false alert,
V1 and V2 native/ERC20 receipt verification, zkSync source routing and WETH fallback,
and explorer pagination and retries.

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

Source chain `324` is zkSync Era mainnet. Native ETH and ERC20 lookups use its
[explorer API](https://block-explorer-api.mainnet.zksync.io/docs) and
[RPC](https://docs.zksync.io/zksync-network/zksync-era/network-details)
(`https://mainnet.era.zksync.io`). Set `ZKSYNC_RPC` to override that RPC endpoint;
`ETH_RPC` applies only to Ethereum. The WETH fallback uses zkSync's WETH address,
`0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91`, published in Celer's transfer
configuration. Etherscan V2 requests for other chains use the source chain ID.

zkSync Celer deposits require independently verified vault addresses under the
`"324"` key in `CELER_SOURCE_VAULTS`. No zkSync vault is trusted by default: Celer's
published transfer configuration currently lists no zkSync source vault.
