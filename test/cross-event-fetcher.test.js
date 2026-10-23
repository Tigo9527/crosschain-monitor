const assert = require("node:assert/strict");
const { test } = require("node:test");
const tool = require("../lib/Tool");
const { CrossEventFetcher, errorMessage } = require("../sync/fetcher/crossEventFetcher.ts");

const lockContractAddress = "0x0000000000000000000000000000000000000001";
const erc20Address = "0x0000000000000000000000000000000000000002";

function createFetcher() {
    const fetcher = new CrossEventFetcher({
        rpcUrl: "http://localhost:8545",
        lockContractAddress,
        erc20Address,
        chainId: 1030,
        batchSize: 100,
        pollInterval: 10,
        maxRetries: 2,
        oneBlock: 100,
        enable: true,
    });
    fetcher.provider = {
        getNetwork: async () => ({ chainId: 1030, name: "test" }),
        getBlockNumber: async () => 100,
    };
    fetcher.saveEvents = async () => {};
    return fetcher;
}

function silenceConsole(t) {
    for (const method of ["log", "warn", "error"]) {
        t.mock.method(console, method, () => {});
    }
}

test("extracts the nested JSON-RPC error message", () => {
    const error = {
        body: JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32016, message: "expected a number below the largest epoch" },
        }),
        message: "processing response error",
    };
    assert.equal(errorMessage(error), "expected a number below the largest epoch");
});

test("retries a failed batch and advances after recovery", async t => {
    silenceConsole(t);
    const alerts = [];
    const delays = [];
    t.mock.method(tool, "dingMsg", async message => alerts.push(message));

    const fetcher = createFetcher();
    fetcher.delay = async delay => delays.push(delay);
    let attempts = 0;
    fetcher.fetchEvents = async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("temporary RPC error");
        return [];
    };

    await fetcher.start();

    assert.equal(attempts, 3);
    assert.deepEqual(delays, [10, 20]);
    assert.deepEqual(alerts, []);
});

test("alerts after all batch retries fail", async t => {
    silenceConsole(t);
    const alerts = [];
    const delays = [];
    let fetcher;
    t.mock.method(tool, "dingMsg", async message => {
        alerts.push(message);
        fetcher.stop();
    });

    fetcher = createFetcher();
    fetcher.delay = async delay => delays.push(delay);
    let attempts = 0;
    fetcher.fetchEvents = async () => {
        attempts += 1;
        throw {
            body: JSON.stringify({
                error: { code: -32016, message: "expected a number below the largest epoch" },
            }),
            message: "processing response error",
        };
    };

    await fetcher.start();

    assert.equal(attempts, 3);
    assert.deepEqual(delays, [10, 20, 10]);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /chain 1030 failed after 2 retries/);
    assert.match(alerts[0], /expected a number below the largest epoch/);
});
