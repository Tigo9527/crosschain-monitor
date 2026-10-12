const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ethers, utils } = require("ethers");
const superagent = require("superagent");
const tool = require("../lib/Tool");
const { fetchErc20Transfer, listTx, listTransfer } = require("../sync/EtherScan.ts");
const f = require("./fixtures/celer-deposit");

function setup(t, { rows = [f.row], tx = f.tx, receipt = f.receipt, responses } = {}) {
    const requests = [], txCalls = [], receiptCalls = [], providerUrls = [], logs = [];
    const previous = Object.getOwnPropertyDescriptor(ethers, "getDefaultProvider");
    const savedEnv = { ETH_RPC: process.env.ETH_RPC, ETHER_SCAN_API_KEY: process.env.ETHER_SCAN_API_KEY,
        PROXY: process.env.PROXY, DEBUG_RETRY: process.env.DEBUG_RETRY };
    process.env.ETH_RPC = "https://rpc.example/private-rpc-token";
    process.env.ETHER_SCAN_API_KEY = "private-explorer-token";
    delete process.env.PROXY;
    delete process.env.DEBUG_RETRY;
    t.after(() => {
        Object.defineProperty(ethers, "getDefaultProvider", previous);
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
    });
    t.mock.method(console, "log", (...args) => logs.push(args.join(" ")));
    t.mock.method(superagent, "get", url => {
        requests.push(new URL(url));
        const body = responses ? responses(requests.at(-1)) : { status: "1", result: rows.map(row => ({ ...row })) };
        return { then: resolve => Promise.resolve({ body }).then(resolve) };
    });
    Object.defineProperty(ethers, "getDefaultProvider", { configurable: true, value: url => {
        providerUrls.push(url);
        return {
            getTransaction: async hash => { txCalls.push(hash); return typeof tx === "function" ? tx(hash) : tx; },
            getTransactionReceipt: async hash => { receiptCalls.push(hash); return receipt; },
        };
    } });
    return { requests, txCalls, receiptCalls, providerUrls, logs };
}

function match(token = f.token, amount = f.minted, account = f.account, id = f.v2Id) {
    return fetchErc20Transfer(account, amount, token, f.beforeTime, id, 1n);
}

test("matches the reported WETH deposit using the configured RPC", async t => {
    const calls = setup(t);
    assert.equal((await match()).hash, f.tx.hash);
    assert.deepEqual(calls.providerUrls, [process.env.ETH_RPC]);
    assert.deepEqual(calls.txCalls, [f.tx.hash]);
    assert.deepEqual(calls.receiptCalls, [f.tx.hash]);
    assert.equal(calls.requests[0].searchParams.get("action"), "tokentx");
    assert.equal(calls.logs.join("\n").includes("private-rpc-token"), false);
    assert.equal(calls.logs.join("\n").includes("private-explorer-token"), false);
});

test("exact amount matches use the configured RPC and verify the receipt", async t => {
    const calls = setup(t);
    assert.equal((await match(f.token, BigInt(f.amount))).hash, f.tx.hash);
    assert.deepEqual(calls.providerUrls, [process.env.ETH_RPC]);
    assert.equal(calls.receiptCalls.length, 1);
});

test("accepts V1 deposits through the matcher", async t => {
    setup(t, { receipt: { ...f.receipt, logs: [f.depositLog(1)] } });
    assert.equal((await match(f.token, f.minted, f.account, f.v1Id)).hash, f.tx.hash);
});

test("native ETH also requires a matching successful deposit receipt", async t => {
    const calls = setup(t, { tx: f.nativeTx() });
    assert.equal((await match("eth")).hash, f.tx.hash);
    assert.equal(calls.requests[0].searchParams.get("action"), "txlist");
    assert.equal(calls.receiptCalls.length, 1);
});

test("accepts a verified 0.01 ETH deposit after the bridge fee", async t => {
    const amount = "10000000000000000";
    const expected = utils.solidityKeccak256(
        ["address", "address", "uint256", "uint64", "address", "uint64", "uint64", "address"],
        [f.account, f.token, amount, 1030, f.account, f.nonce, 1, f.vaultAddress]);
    setup(t, {
        rows: [{ ...f.row, value: amount }],
        tx: { ...f.tx, value: amount, data: f.abi.encodeFunctionData("depositNative", [amount, 1030, f.account, f.nonce]) },
        receipt: { ...f.receipt, logs: [f.depositLog(2, { amount, id: expected })] },
    });
    assert.equal((await match("eth", 9769675941093185n, f.account, expected)).hash, f.tx.hash);
});

test("rejects a single similar native ETH transfer that is not a deposit", async t => {
    const calls = setup(t, { tx: { ...f.tx, data: "0x", value: f.amount } });
    assert.equal(await match("eth"), null);
    assert.equal(calls.txCalls.length, 1);
    assert.equal(calls.receiptCalls.length, 0);
});

test("rejects mismatched native deposit IDs instead of accepting the similar amount", async t => {
    const calls = setup(t, { tx: f.nativeTx() });
    assert.equal(await match("eth", f.minted, f.account, f.v1Id), null);
    assert.equal(calls.receiptCalls.length, 1);
});

test("deduplicates rejected candidate transactions and checks each only once", async t => {
    const calls = setup(t, { rows: [f.row, f.row, f.row], receipt: { ...f.receipt, logs: [] } });
    assert.equal(await match(), null);
    assert.deepEqual(calls.txCalls, [f.tx.hash]);
    assert.deepEqual(calls.receiptCalls, [f.tx.hash]);
});

test("checks multiple native candidates until the correct deposit is found", async t => {
    const otherHash = "0x" + "11".repeat(32);
    const calls = setup(t, {
        rows: [{ ...f.row, hash: otherHash }, f.row],
        tx: hash => hash === otherHash ? { ...f.tx, hash, data: "0x" } : f.nativeTx(),
    });
    assert.equal((await match("eth")).hash, f.tx.hash);
    assert.deepEqual(calls.txCalls, [otherHash, f.tx.hash]);
});

test("matches checksummed addresses", async t => {
    setup(t, { rows: [{ ...f.row, from: utils.getAddress(f.account) }] });
    assert.equal((await match(f.token, f.minted, utils.getAddress(f.account))).hash, f.tx.hash);
});

test("filters reverted explorer rows before making RPC calls", async t => {
    const calls = setup(t, { rows: [{ ...f.row, isError: "1" }, { ...f.row, txreceipt_status: "0" }] });
    assert.equal(await match("eth"), null);
    assert.equal(calls.txCalls.length, 0);
});

for (const [name, options] of [
    ["missing transaction", { tx: null }],
    ["wrong source chain", { tx: { ...f.tx, chainId: 10 } }],
    ["reverted receipt", { receipt: { ...f.receipt, status: 0 } }],
    ["missing receipt", { receipt: null }],
]) {
    test(`returns no match for a ${name}`, async t => {
        setup(t, options);
        assert.equal(await match(), null);
    });
}

test("an empty native ETH history permits the WETH fallback", async t => {
    const calls = setup(t, { responses: url => url.searchParams.get("action") === "txlist"
        ? { status: "0", message: "No transactions found", result: [] }
        : { status: "1", result: [f.row] } });
    const result = await match("eth") || await match(f.token);
    assert.equal(result.hash, f.tx.hash);
    assert.equal(calls.requests.length, 2);
});

test("treats explicit no-transactions strings as an empty token history", async t => {
    setup(t, { responses: () => ({ status: "0", message: "No transactions found", result: "No transactions found" }) });
    assert.deepEqual((await listTransfer(f.account, f.token, "")).result, []);
});

test("retries explorer rate limits instead of treating them as an empty history", async t => {
    let attempt = 0;
    const calls = setup(t, { responses: () => ++attempt === 1
        ? { status: "0", message: "NOTOK", result: "Max rate limit reached" }
        : { status: "1", result: [f.row] } });
    const sleep = t.mock.method(tool, "sleep", async () => {});
    assert.equal((await match()).hash, f.tx.hash);
    assert.equal(calls.requests.length, 2);
    assert.equal(sleep.mock.callCount(), 1);
});

test("throws after repeated explorer errors instead of reporting a missing deposit", async t => {
    const calls = setup(t, { responses: () => ({ status: "0", message: "NOTOK", result: "Invalid API Key" }) });
    t.mock.method(tool, "sleep", async () => {});
    await assert.rejects(() => match(), /fetch tokentx from ether scan api failed/);
    assert.equal(calls.requests.length, 5);
    assert.equal(calls.txCalls.length, 0);
});

test("searches beyond the latest 100 transactions to cover the mint window", async t => {
    const recent = Array.from({ length: 100 }, (_, i) => ({ ...f.row, hash: String(i), timeStamp: String(f.beforeTime + 100 - i) }));
    const calls = setup(t, { responses: url => ({ status: "1", result: url.searchParams.get("page") === "1" ? recent : [f.row] }) });
    assert.equal((await match()).hash, f.tx.hash);
    assert.deepEqual(calls.requests.map(url => url.searchParams.get("page")), ["1", "2"]);
    assert.deepEqual(calls.txCalls, [f.tx.hash]);
});

test("stops paging after covering the time window", async t => {
    const calls = setup(t, { rows: Array.from({ length: 100 }, () => ({ ...f.row, timeStamp: String(f.beforeTime - 7201) })) });
    assert.equal(await match(), null);
    assert.equal(calls.requests.length, 1);
});

test("fails instead of looping forever when the explorer repeats a full page", async t => {
    const calls = setup(t, { rows: Array.from({ length: 100 }, () => f.row) });
    await assert.rejects(() => listTx(f.account, "", f.beforeTime - 7200), /same txlist page twice/);
    assert.equal(calls.requests.length, 2);
});

test("propagates RPC outages so the monitor can retry", async t => {
    setup(t, { tx: () => { throw new Error("RPC unavailable"); } });
    await assert.rejects(() => match(), /RPC unavailable/);
});

test("preserves explicit explorer-only matching for legacy chains", async t => {
    setup(t, { rows: [{ ...f.row, input: undefined }] });
    const result = await fetchErc20Transfer(f.account, f.minted, f.token, f.beforeTime, "", 592n);
    assert.equal(result.hash, f.tx.hash);
});
