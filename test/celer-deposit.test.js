const assert = require("node:assert/strict");
const { test } = require("node:test");
const { celerDepositIds, matchesCelerDepositReceipt } = require("../sync/CelerDeposit.ts");
const f = require("./fixtures/celer-deposit");

test("the reported V2 deposit matches the actual receipt and mint refId", () => {
    assert.deepEqual(celerDepositIds(f.tx.data, f.account, 1, f.vaultAddress, f.vaults), [f.v1Id, f.v2Id]);
    assert.equal(matchesCelerDepositReceipt(f.tx, f.receipt, f.v2Id, f.vaults), true);
    assert.equal(matchesCelerDepositReceipt(f.tx, f.receipt, f.v1Id, f.vaults), false);
});

for (const version of [1, 2]) {
    const expected = version === 1 ? f.v1Id : f.v2Id;
    for (const native of [false, true]) {
        test(`accepts successful V${version} ${native ? "native" : "ERC20"} deposits`, () => {
            const to = version === 1 ? f.legacyVaultAddress : f.vaultAddress;
            const tx = { ...(native ? f.nativeTx() : f.tx), to };
            const receipt = { ...f.receipt, logs: [{ ...f.depositLog(version), address: to }] };
            assert.equal(matchesCelerDepositReceipt(tx, receipt, expected, f.vaults), true);
        });
    }
}

test("rejects failed, unavailable, unrelated, or eventless receipts", () => {
    for (const receipt of [null, { ...f.receipt, status: 0 }, { ...f.receipt, status: undefined },
        { ...f.receipt, logs: [] }, { ...f.receipt, transactionHash: "0x" + "11".repeat(32) }]) {
        assert.equal(matchesCelerDepositReceipt(f.tx, receipt, f.v2Id, f.vaults), false);
    }
});

test("rejects unknown selectors and malformed calldata", () => {
    for (const data of ["0x", "0x23463624", "0xdeadbeef" + f.tx.data.slice(10)]) {
        assert.equal(matchesCelerDepositReceipt({ ...f.tx, data }, f.receipt, f.v2Id, f.vaults), false);
        assert.deepEqual(celerDepositIds(data, f.account, 1, f.vaultAddress, f.vaults), []);
    }
});

test("binds deposits to the sender, vault, source chain and destination chain", () => {
    for (const changes of [{ from: f.token }, { to: f.token }, { to: null }, { to: undefined }, { chainId: 10 }, {
        data: f.abi.encodeFunctionData("deposit", [f.token, f.amount, 1, f.account, f.nonce]),
    }]) {
        assert.equal(matchesCelerDepositReceipt({ ...f.tx, ...changes }, f.receipt, f.v2Id, f.vaults), false);
    }
});

test("requires event fields to agree with the transaction", () => {
    for (const changes of [{ depositor: f.token }, { token: f.account }, { amount: "1" },
        { mintChainId: 1 }, { mintAccount: f.token }, { nonce: "1" }]) {
        const receipt = { ...f.receipt, logs: [f.depositLog(2, changes)] };
        assert.equal(matchesCelerDepositReceipt(f.tx, receipt, f.v2Id, f.vaults), false);
    }
});

test("uses the formula for the emitted event version", () => {
    assert.equal(matchesCelerDepositReceipt(f.tx,
        { ...f.receipt, logs: [f.depositLog(2, { id: f.v1Id })] }, f.v1Id, f.vaults), false);
    assert.equal(matchesCelerDepositReceipt(f.tx,
        { ...f.receipt, logs: [f.depositLog(1, { id: f.v2Id })] }, f.v2Id, f.vaults), false);
});

test("requires native deposit value to match its calldata amount", () => {
    assert.equal(matchesCelerDepositReceipt({ ...f.nativeTx(), value: "0" }, f.receipt, f.v2Id, f.vaults), false);
});

test("ignores unrelated or malformed logs and compares addresses case-insensitively", () => {
    const receipt = { ...f.receipt, logs: [
        { ...f.receipt.logs[0], address: f.token },
        { address: f.vaultAddress, topics: [], data: "0x" },
        { ...f.receipt.logs[0], address: f.vaultAddress.toUpperCase() },
    ] };
    assert.equal(matchesCelerDepositReceipt(f.tx, receipt, f.v2Id.toUpperCase(), f.vaults), true);
});

test("rejects a lookalike vault emitting an otherwise valid V1 deposit", () => {
    const tx = { ...f.tx, to: f.token };
    const receipt = { ...f.receipt, logs: [{ ...f.depositLog(1), address: f.token }] };
    // V1's ID does not change with the vault; emitter == tx.to alone is insufficient.
    assert.equal(matchesCelerDepositReceipt(tx, receipt, f.v1Id, f.vaults), false);
    assert.deepEqual(celerDepositIds(tx.data, tx.from, tx.chainId, tx.to, f.vaults), []);
});

test("rejects a lookalike V2 vault even when its address is included in the ID", () => {
    const { utils } = require("ethers");
    const id = utils.solidityKeccak256(
        ["address", "address", "uint256", "uint64", "address", "uint64", "uint64", "address"],
        [f.account, f.token, f.amount, 1030, f.account, f.nonce, 1, f.token]);
    const receipt = { ...f.receipt, logs: [{ ...f.depositLog(2, { id }), address: f.token }] };
    assert.equal(matchesCelerDepositReceipt({ ...f.tx, to: f.token }, receipt, id, f.vaults), false);
});

test("rejects vaults missing from this source chain's allowlist", () => {
    for (const vaults of [{}, { "1": [] }, { "10": [f.vaultAddress] }]) {
        assert.equal(matchesCelerDepositReceipt(f.tx, f.receipt, f.v2Id, vaults), false);
        assert.deepEqual(celerDepositIds(f.tx.data, f.account, 1, f.vaultAddress, vaults), []);
    }
});

test("normalizes configured vault addresses", () => {
    const vaults = { "1": [f.vaultAddress.toUpperCase()] };
    assert.equal(matchesCelerDepositReceipt(f.tx, f.receipt, f.v2Id, vaults), true);
});
