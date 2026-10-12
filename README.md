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
