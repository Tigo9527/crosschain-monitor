import {utils} from "ethers";

export type CelerVaultAllowlist = Readonly<Record<string, readonly string[]>>;

// Conflux routes from https://cbridge-prod2.celer.app/v2/getTransferConfigs,
// pegged_pair_configs[].{org_chain_id,pegged_deposit_contract_addr}, verified 2026-10-12.
// Trust configuration is pinned here, never learned from candidate transactions.
const defaultVaults: CelerVaultAllowlist = {
    "1": [
        "0xb37d31b2a74029b5951a2778f959282e2d518595", // OriginalTokenVault
        "0x7510792a3b1969f9307f3845ce88e39578f2bae1", // OriginalTokenVaultV2
    ],
};

export function loadCelerSourceVaults(configuration = process.env.CELER_SOURCE_VAULTS): CelerVaultAllowlist {
    if (configuration === undefined) return defaultVaults;
    let overrides: unknown;
    try {
        overrides = JSON.parse(configuration);
    } catch {
        throw new Error("CELER_SOURCE_VAULTS must be a JSON object mapping source chain IDs to vault address arrays");
    }
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
        throw new Error("CELER_SOURCE_VAULTS must be a JSON object");
    }
    const vaults: Record<string, readonly string[]> = {...defaultVaults};
    for (const [chainId, addresses] of Object.entries(overrides)) {
        if (!/^[1-9][0-9]*$/.test(chainId) || !Number.isSafeInteger(Number(chainId))
            || !Array.isArray(addresses) || addresses.some(address => typeof address !== "string" || !utils.isAddress(address))) {
            throw new Error("CELER_SOURCE_VAULTS contains an invalid source chain ID or vault address array");
        }
        // An explicit empty array disables this chain; overrides replace, rather than extend, defaults.
        vaults[chainId] = addresses.map(address => address.toLowerCase());
    }
    return vaults;
}

export function isCelerVault(chainId: number, address: string | null | undefined,
                             vaults: CelerVaultAllowlist): boolean {
    return !!address && (vaults[String(chainId)] || []).some(vault => vault.toLowerCase() === address.toLowerCase());
}
