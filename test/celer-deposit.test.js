const assert = require("node:assert/strict");
const { test } = require("node:test");
const { celerDepositIds, matchesCelerDepositReceipt } = require("../sync/CelerDeposit.ts");
const f = require("./fixtures/celer-deposit");

test("the reported V2 deposit matches the actual receipt and mint refId", () => {
    assert.deepEqual(celerDepositIds(f.tx.data, f.account, 1, f.vaultAddress), [f.v1Id, f.v2Id]);
    assert.equal(matchesCelerDepositReceipt(f.tx, f.receipt, f.v2Id), true);
    assert.equal(matchesCelerDepositReceipt(f.tx, f.receipt, f.v1Id), false);
});

for (const version of [1, 2]) {
    const expected = version === 1 ? f.v1Id : f.v2Id;
    for (const native of [false, true]) {
        test(`accepts successful V${version} ${native ? "native" : "ERC20"} deposits`, () => {
            const tx = native ? f.nativeTx() : f.tx;
            const receipt = { ...f.receipt, logs: [f.depositLog(version)] };
            assert.equal(matchesCelerDepositReceipt(tx, receipt, expected), true);
        });
    }
}

test("rejects failed, unavailable, unrelated, or eventless receipts", () => {
    for (const receipt of [null, { ...f.receipt, status: 0 }, { ...f.receipt, status: undefined },
        { ...f.receipt, logs: [] }, { ...f.receipt, transactionHash: "0x" + "11".repeat(32) }]) {
        assert.equal(matchesCelerDepositReceipt(f.tx, receipt, f.v2Id), false);
    }
});

test("rejects unknown selectors and malformed calldata", () => {
    for (const data of ["0x", "0x23463624", "0xdeadbeef" + f.tx.data.slice(10)]) {
        assert.equal(matchesCelerDepositReceipt({ ...f.tx, data }, f.receipt, f.v2Id), false);
        assert.deepEqual(celerDepositIds(data, f.account, 1, f.vaultAddress), []);
    }
});

test("binds deposits to the sender, vault, source chain and destination chain", () => {
    for (const changes of [{ from: f.token }, { to: f.token }, { to: null }, { to: undefined }, { chainId: 10 }, {
        data: f.abi.encodeFunctionData("deposit", [f.token, f.amount, 1, f.account, f.nonce]),
    }]) {
        assert.equal(matchesCelerDepositReceipt({ ...f.tx, ...changes }, f.receipt, f.v2Id), false);
    }
});

test("requires event fields to agree with the transaction", () => {
    for (const changes of [{ depositor: f.token }, { token: f.account }, { amount: "1" },
        { mintChainId: 1 }, { mintAccount: f.token }, { nonce: "1" }]) {
        const receipt = { ...f.receipt, logs: [f.depositLog(2, changes)] };
        assert.equal(matchesCelerDepositReceipt(f.tx, receipt, f.v2Id), false);
    }
});

test("uses the formula for the emitted event version", () => {
    assert.equal(matchesCelerDepositReceipt(f.tx,
        { ...f.receipt, logs: [f.depositLog(2, { id: f.v1Id })] }, f.v1Id), false);
    assert.equal(matchesCelerDepositReceipt(f.tx,
        { ...f.receipt, logs: [f.depositLog(1, { id: f.v2Id })] }, f.v2Id), false);
});

test("requires native deposit value to match its calldata amount", () => {
    assert.equal(matchesCelerDepositReceipt({ ...f.nativeTx(), value: "0" }, f.receipt, f.v2Id), false);
});

test("ignores unrelated or malformed logs and compares addresses case-insensitively", () => {
    const receipt = { ...f.receipt, logs: [
        { ...f.receipt.logs[0], address: f.token },
        { address: f.vaultAddress, topics: [], data: "0x" },
        { ...f.receipt.logs[0], address: f.vaultAddress.toUpperCase() },
    ] };
    assert.equal(matchesCelerDepositReceipt(f.tx, receipt, f.v2Id.toUpperCase()), true);
});
