const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ethers, utils } = require("ethers");
const superagent = require("superagent");
const tool = require("../lib/Tool");
const { fetchErc20Transfer, listTx, listTransfer } = require("../sync/EtherScan.ts");
const f = require("./fixtures/celer-deposit");

function setup(t, { rows = [f.row], tx = f.tx, receipt = f.receipt, responses } = {}) {
    const requests = [], txCalls = [], receiptCalls = [], providerUrls = [], providers = [], logs = [];
    const savedEnv = { ETH_RPC: process.env.ETH_RPC, ZKSYNC_RPC: process.env.ZKSYNC_RPC,
        ETHER_SCAN_API_KEY: process.env.ETHER_SCAN_API_KEY,
        PROXY: process.env.PROXY, DEBUG_RETRY: process.env.DEBUG_RETRY, CELER_SOURCE_VAULTS: process.env.CELER_SOURCE_VAULTS };
    process.env.ETH_RPC = "https://rpc.example/private-rpc-token";
    process.env.ETHER_SCAN_API_KEY = "private-explorer-token";
    delete process.env.PROXY;
    delete process.env.DEBUG_RETRY;
    delete process.env.CELER_SOURCE_VAULTS;
    delete process.env.ZKSYNC_RPC;
    t.after(() => {
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
    // Exercise the real constructors; mock only the methods that would contact RPC.
    for (const Provider of [ethers.providers.JsonRpcProvider, ethers.providers.FallbackProvider]) {
        t.mock.method(Provider.prototype, "getTransaction", async function (hash) {
            providers.push(this);
            providerUrls.push(this.connection?.url);
            txCalls.push(hash);
            return typeof tx === "function" ? tx(hash) : tx;
        });
        t.mock.method(Provider.prototype, "getTransactionReceipt", async function (hash) {
            receiptCalls.push(hash);
            return receipt;
        });
    }
    return { requests, txCalls, receiptCalls, providerUrls, providers, logs };
}

function match(token = f.token, amount = f.minted, account = f.account, id = f.v2Id) {
    return fetchErc20Transfer(account, amount, token, f.beforeTime, id, 1n);
}

test("matches the reported WETH deposit using the configured RPC", async t => {
    const calls = setup(t);
    assert.equal((await match()).hash, f.tx.hash);
    assert.deepEqual(calls.providerUrls, [process.env.ETH_RPC]);
    assert.equal(calls.providers[0].constructor, ethers.providers.JsonRpcProvider);
    assert.equal((await calls.providers[0].ready).chainId, 1);
    assert.deepEqual(calls.txCalls, [f.tx.hash]);
    assert.deepEqual(calls.receiptCalls, [f.tx.hash]);
    assert.equal(calls.requests[0].searchParams.get("action"), "tokentx");
    assert.equal(calls.requests[0].hostname, "api.etherscan.io");
    assert.equal(calls.requests[0].searchParams.get("chainid"), "1");
    assert.equal(calls.requests[0].searchParams.get("contractaddress"), f.token);
    assert.equal(calls.logs.join("\n").includes("private-rpc-token"), false);
    assert.equal(calls.logs.join("\n").includes("private-explorer-token"), false);
});

test("exact amount matches use the configured RPC and verify the receipt", async t => {
    const calls = setup(t);
    assert.equal((await match(f.token, BigInt(f.amount))).hash, f.tx.hash);
    assert.deepEqual(calls.providerUrls, [process.env.ETH_RPC]);
    assert.equal(calls.receiptCalls.length, 1);
});

test("uses the real default provider when ETH_RPC is not configured", async t => {
    const calls = setup(t);
    delete process.env.ETH_RPC;
    assert.equal((await match()).hash, f.tx.hash);
    assert.equal(calls.providers[0].constructor, ethers.providers.FallbackProvider);
    assert.deepEqual(calls.providerUrls, [undefined]);
    assert.deepEqual(calls.receiptCalls, [f.tx.hash]);
});

test("rejects explorer candidates sent to an unauthorized vault before RPC", async t => {
    const calls = setup(t, { rows: [{ ...f.row, to: f.token }] });
    assert.equal(await match(), null);
    assert.equal(calls.txCalls.length, 0);
});

test("also checks the actual transaction destination against the allowlist", async t => {
    const calls = setup(t, {
        tx: { ...f.tx, to: f.token },
        receipt: { ...f.receipt, logs: [{ ...f.depositLog(1), address: f.token }] },
    });
    assert.equal(await match(f.token, f.minted, f.account, f.v1Id), null);
    assert.equal(calls.txCalls.length, 1);
    assert.equal(calls.receiptCalls.length, 0);
});

test("honors an explicitly disabled source chain", async t => {
    const calls = setup(t);
    process.env.CELER_SOURCE_VAULTS = '{"1":[]}';
    assert.equal(await match(), null);
    assert.equal(calls.txCalls.length, 0);
});

test("accepts V1 deposits through the matcher", async t => {
    setup(t, {
        rows: [{ ...f.row, to: f.legacyVaultAddress }], tx: { ...f.tx, to: f.legacyVaultAddress },
        receipt: { ...f.receipt, logs: [{ ...f.depositLog(1), address: f.legacyVaultAddress }] },
    });
    assert.equal((await match(f.token, f.minted, f.account, f.v1Id)).hash, f.tx.hash);
});

test("native ETH also requires a matching successful deposit receipt", async t => {
    const calls = setup(t, { tx: f.nativeTx() });
    assert.equal((await match("eth")).hash, f.tx.hash);
    assert.equal(calls.requests[0].searchParams.get("action"), "txlist");
    assert.equal(calls.requests[0].searchParams.get("chainid"), "1");
    assert.equal(calls.receiptCalls.length, 1);
});

// Synthetic chain-324 deposits: the test explicitly trusts its fixture vault on
// zkSync. The Ethereum fixture address is not a published zkSync vault.
const zkSyncWeth = "0x5aea5775959fbc2557cc8789bc1bf90a239d9a91";
function zkSyncDeposit(native = true, version = 2) {
    const types = ["address", "address", "uint256", "uint64", "address", "uint64", "uint64"];
    const values = [f.account, zkSyncWeth, f.amount, 1030, f.account, f.nonce, 324];
    if (version === 2) { types.push("address"); values.push(f.vaultAddress); }
    const id = utils.solidityKeccak256(types, values);
    return {
        id,
        rows: [{ ...f.row, contractAddress: zkSyncWeth }],
        tx: native ? { ...f.nativeTx(), chainId: 324 } : {
            ...f.tx, chainId: 324,
            data: f.abi.encodeFunctionData("deposit", [zkSyncWeth, f.amount, 1030, f.account, f.nonce]),
        },
        receipt: { ...f.receipt, logs: [f.depositLog(version, { id, token: zkSyncWeth })] },
    };
}

function matchZkSync(token, id) {
    return fetchErc20Transfer(f.account, f.minted, token, f.beforeTime, id, 324n);
}

for (const version of [1, 2]) {
    test(`matches zkSync V${version} native deposits using the zkSync explorer and RPC`, async t => {
        const deposit = zkSyncDeposit(true, version);
        const calls = setup(t, deposit);
        process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "324": [f.vaultAddress] });
        assert.equal((await matchZkSync("eth", deposit.id)).hash, f.tx.hash);
        const url = calls.requests[0];
        assert.equal(url.origin, "https://block-explorer-api.mainnet.zksync.io");
        assert.equal(url.pathname, "/api");
        assert.equal(url.searchParams.get("action"), "txlist");
        assert.equal(url.searchParams.has("apikey"), false);
        assert.equal(url.searchParams.has("chainid"), false);
        assert.deepEqual(calls.providerUrls, ["https://mainnet.era.zksync.io"]);
        assert.equal(calls.providers[0].constructor, ethers.providers.JsonRpcProvider);
        assert.equal((await calls.providers[0].ready).chainId, 324);
        assert.deepEqual(calls.receiptCalls, [f.tx.hash]);
    });
}

test("honors ZKSYNC_RPC without logging its credentials", async t => {
    const deposit = zkSyncDeposit();
    const calls = setup(t, deposit);
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "324": [f.vaultAddress] });
    process.env.ZKSYNC_RPC = "https://zksync-rpc.example/private-zksync-token";
    assert.equal((await matchZkSync("eth", deposit.id)).hash, f.tx.hash);
    assert.deepEqual(calls.providerUrls, [process.env.ZKSYNC_RPC]);
    assert.equal((await calls.providers[0].ready).chainId, 324);
    assert.equal(calls.logs.join("\n").includes("private-zksync-token"), false);
});

test("zkSync native-to-WETH fallback uses the zkSync WETH contract and RPC", async t => {
    const deposit = zkSyncDeposit(false);
    const calls = setup(t, { ...deposit, responses: url => url.searchParams.get("action") === "txlist"
        ? { status: "0", message: "No transactions found", result: [] }
        : { status: "1", result: deposit.rows } });
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "324": [f.vaultAddress] });
    // MintChecker passes the Ethereum WETH binding to the fallback.
    const result = await matchZkSync("eth", deposit.id) || await matchZkSync(f.token.toUpperCase(), deposit.id);
    assert.equal(result.hash, f.tx.hash);
    assert.deepEqual(calls.requests.map(url => url.origin), Array(2).fill("https://block-explorer-api.mainnet.zksync.io"));
    assert.deepEqual(calls.requests.map(url => url.searchParams.get("action")), ["txlist", "tokentx"]);
    assert.equal(calls.requests[1].searchParams.get("contractaddress"), zkSyncWeth);
    assert.deepEqual(calls.providerUrls, ["https://mainnet.era.zksync.io"]);
    assert.deepEqual(calls.receiptCalls, [f.tx.hash]);
});

test("zkSync still requires a configured vault on chain 324", async t => {
    const deposit = zkSyncDeposit();
    const calls = setup(t, deposit);
    assert.equal(await matchZkSync("eth", deposit.id), null);
    assert.equal(calls.txCalls.length, 0);
});

test("rejects Ethereum RPC transactions when matching a zkSync reference", async t => {
    const deposit = zkSyncDeposit();
    const calls = setup(t, { ...deposit, tx: f.nativeTx() });
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "324": [f.vaultAddress] });
    assert.equal(await matchZkSync("eth", deposit.id), null);
    assert.equal(calls.txCalls.length, 1);
    assert.equal(calls.receiptCalls.length, 0);
});

test("rejects a zkSync deposit with an Ethereum deposit ID", async t => {
    const calls = setup(t, zkSyncDeposit());
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "324": [f.vaultAddress] });
    assert.equal(await matchZkSync("eth", f.v2Id), null);
    assert.equal(calls.receiptCalls.length, 1);
});

test("passes other source chain IDs through both Etherscan V2 actions", async t => {
    const calls = setup(t, { rows: [] });
    await fetchErc20Transfer(f.account, f.minted, "eth", f.beforeTime, f.v2Id, 10n);
    await fetchErc20Transfer(f.account, f.minted, f.token, f.beforeTime, f.v2Id, 10n);
    assert.deepEqual(calls.requests.map(url => url.searchParams.get("chainid")), ["10", "10"]);
    assert.deepEqual(calls.requests.map(url => url.searchParams.get("action")), ["txlist", "tokentx"]);
});

test("unsupported default RPC networks fail instead of querying Ethereum", async t => {
    const calls = setup(t);
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "10": [f.vaultAddress] });
    await assert.rejects(() => fetchErc20Transfer(f.account, f.minted, "eth", f.beforeTime, f.v2Id, 10n),
        error => error.code === "NETWORK_ERROR" && error.network === 10);
    assert.equal(calls.txCalls.length, 0);
    assert.equal(calls.receiptCalls.length, 0);
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

function astarDepositId(version = 2, to = f.vaultAddress) {
    const types = ["address", "address", "uint256", "uint64", "address", "uint64", "uint64"];
    const values = [f.account, f.token, f.amount, 1030, f.account, f.nonce, 592];
    if (version === 2) { types.push("address"); values.push(to); }
    return utils.solidityKeccak256(types, values);
}

test("explorer-only Celer matches require a configured source-chain vault", async t => {
    const calls = setup(t, { rows: [{ ...f.row, input: f.tx.data }] });
    const expected = astarDepositId();
    assert.equal(await fetchErc20Transfer(f.account, f.minted, f.token, f.beforeTime, expected, 592n), null);
    // Explicit operator configuration is the only way to trust another chain's vault.
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "592": [utils.getAddress(f.vaultAddress)] });
    assert.equal((await fetchErc20Transfer(f.account, f.minted, f.token, f.beforeTime, expected, 592n)).hash, f.tx.hash);
    assert.equal(calls.txCalls.length, 0);
});

test("explorer-only matching rejects a lookalike V1 vault with a matching ID", async t => {
    setup(t, { rows: [{ ...f.row, to: f.token, input: f.tx.data }] });
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "592": [f.vaultAddress] });
    assert.equal(await fetchErc20Transfer(f.account, f.minted, f.token, f.beforeTime, astarDepositId(1), 592n), null);
});

test("an authorized explorer-only vault still needs the matching deposit ID", async t => {
    setup(t, { rows: [{ ...f.row, input: f.tx.data }] });
    process.env.CELER_SOURCE_VAULTS = JSON.stringify({ "592": [f.vaultAddress] });
    assert.equal(await fetchErc20Transfer(f.account, f.minted, f.token, f.beforeTime, f.v2Id, 592n), null);
});
