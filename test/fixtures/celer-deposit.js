const { utils } = require("ethers");

// Public Ethereum transaction and Deposited log, fetched via eth_getTransaction*
// for the false alert on Conflux tx 0xb17bbe78507c4fd47558d6c8d96eacad7ec6bde3e4a9b7b76c10bb2ef79bc674.
const account = "0x483c2c6ee6da8b955f39635d580e659bd5a12ebe";
const token = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const vaultAddress = "0x7510792a3b1969f9307f3845ce88e39578f2bae1";
const legacyVaultAddress = "0xb37d31b2a74029b5951a2778f959282e2d518595";
const vaults = { "1": [legacyVaultAddress, vaultAddress] };
const amount = "1590000000000000000";
const minted = 1589769503026273530n;
const nonce = "1791703250450";
const v1Id = "0x73226dfd5d18b69cd00a40d27aca30c0114ba0eb03a976d1bd0ceca89f7755db";
const v2Id = "0xce4ea01562da9168c1e1f1ce3b36b1888d38db1f51acc0a287ea786077f2e791";
const tx = {
    hash: "0x35038adac6ccf7e6734e6b9652e39bf6083e084c01a186a280c8386ff2eb209a",
    from: account, to: vaultAddress, chainId: 1, value: "0",
    data: "0x23463624000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000001610d09368df00000000000000000000000000000000000000000000000000000000000000000406000000000000000000000000483c2c6ee6da8b955f39635d580e659bd5a12ebe000000000000000000000000000000000000000000000000000001a129d5f612",
};
const receipt = {
    transactionHash: tx.hash, status: 1,
    logs: [{
        address: vaultAddress,
        topics: ["0x28d226819e371600e26624ebc4a9a3947117ee2760209f816c789d3a99bf481b"],
        data: "0xce4ea01562da9168c1e1f1ce3b36b1888d38db1f51acc0a287ea786077f2e791000000000000000000000000483c2c6ee6da8b955f39635d580e659bd5a12ebe000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000001610d09368df00000000000000000000000000000000000000000000000000000000000000000406000000000000000000000000483c2c6ee6da8b955f39635d580e659bd5a12ebe000000000000000000000000000000000000000000000000000001a129d5f612",
    }],
};
const beforeTime = Date.parse("2026-10-11T07:24:59Z") / 1000;
const row = {
    hash: tx.hash, from: account, to: vaultAddress, value: amount,
    tokenDecimal: "18", contractAddress: token, tokenName: "Wrapped Ether",
    timeStamp: String(Date.parse("2026-10-11T07:21:35Z") / 1000),
};

const abi = new utils.Interface([
    "function deposit(address token, uint256 amount, uint64 mintChainId, address mintAccount, uint64 nonce)",
    "function depositNative(uint256 amount, uint64 mintChainId, address mintAccount, uint64 nonce) payable",
    "event Deposited(bytes32 depositId, address depositor, address token, uint256 amount, uint64 mintChainId, address mintAccount)",
    "event Deposited(bytes32 depositId, address depositor, address token, uint256 amount, uint64 mintChainId, address mintAccount, uint64 nonce)",
]);
function depositLog(version, overrides = {}) {
    const fields = {
        id: version === 1 ? v1Id : v2Id, depositor: account, token, amount,
        mintChainId: 1030, mintAccount: account, nonce, ...overrides,
    };
    const types = "bytes32,address,address,uint256,uint64,address" + (version === 2 ? ",uint64" : "");
    const values = [fields.id, fields.depositor, fields.token, fields.amount, fields.mintChainId, fields.mintAccount];
    if (version === 2) values.push(fields.nonce);
    return { address: vaultAddress, ...abi.encodeEventLog(abi.getEvent(`Deposited(${types})`), values) };
}
function nativeTx() {
    return {
        ...tx, value: amount,
        data: abi.encodeFunctionData("depositNative", [amount, 1030, account, nonce]),
    };
}

module.exports = { account, token, vaultAddress, legacyVaultAddress, vaults, amount, minted, nonce, v1Id, v2Id, tx, receipt, beforeTime, row, abi, depositLog, nativeTx };
