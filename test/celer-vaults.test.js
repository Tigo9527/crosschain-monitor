const assert = require("node:assert/strict");
const { test } = require("node:test");
const { isCelerVault, loadCelerSourceVaults } = require("../sync/CelerVaults.ts");
const f = require("./fixtures/celer-deposit");

test("pins the published Ethereum vaults and rejects unknown chains and addresses", () => {
    const vaults = loadCelerSourceVaults("{}");
    assert.equal(isCelerVault(1, f.legacyVaultAddress, vaults), true);
    assert.equal(isCelerVault(1, f.vaultAddress, vaults), true);
    assert.equal(isCelerVault(1, f.token, vaults), false);
    assert.equal(isCelerVault(592, f.vaultAddress, vaults), false);
    assert.equal(isCelerVault(1, undefined, vaults), false);
});

test("supports per-chain overrides and explicit empty allowlists", () => {
    const vaults = loadCelerSourceVaults(JSON.stringify({ "1": [], "592": [f.vaultAddress] }));
    assert.equal(isCelerVault(1, f.vaultAddress, vaults), false);
    assert.equal(isCelerVault(592, f.vaultAddress.toUpperCase(), vaults), true);
    assert.equal(isCelerVault(1, f.vaultAddress, loadCelerSourceVaults("{}")), true);
});

test("rejects malformed trust configuration instead of falling back to defaults", () => {
    for (const config of ["", "{", "null", "[]", "true", '{"1":"*"}', '{"1":["*"]}',
        '{"1":[null]}', '{"0":[]}', '{"-1":[]}', '{"1.0":[]}', '{"9007199254740992":[]}', '{"__proto__":[]}']) {
        assert.throws(() => loadCelerSourceVaults(config), /CELER_SOURCE_VAULTS/);
    }
});
