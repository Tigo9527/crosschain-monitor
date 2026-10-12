import {BigNumberish, BigNumber, utils} from "ethers";

// OriginalTokenVault and OriginalTokenVaultV2 share the deposit methods.
// V2 appends the vault address to the deposit ID and the nonce to Deposited.
const vault = new utils.Interface([
    "function deposit(address token, uint256 amount, uint64 mintChainId, address mintAccount, uint64 nonce)",
    "function depositNative(uint256 amount, uint64 mintChainId, address mintAccount, uint64 nonce) payable",
    "event Deposited(bytes32 depositId, address depositor, address token, uint256 amount, uint64 mintChainId, address mintAccount)",
    "event Deposited(bytes32 depositId, address depositor, address token, uint256 amount, uint64 mintChainId, address mintAccount, uint64 nonce)",
]);

interface DepositTransaction {
    data: string;
    from: string;
    to?: string | null;
    chainId: number;
    hash: string;
    value: BigNumberish;
}

interface DepositReceipt {
    transactionHash: string;
    status?: number;
    logs: {address: string; topics: string[]; data: string}[];
}

export function decodeCelerDeposit(data: string) {
    try {
        return vault.parseTransaction({data});
    } catch {
        // Unrelated transfers and malformed calldata are not deposits.
        return null;
    }
}

export function celerDepositIds(data: string, from: string, chainId: number, to?: string | null,
                                nativeToken?: string): string[] {
    const decoded = decodeCelerDeposit(data);
    if (!decoded || !decoded.args.mintChainId.eq(1030)) return [];
    const {amount, mintChainId, mintAccount, nonce} = decoded.args;
    const token = decoded.name === "depositNative" ? nativeToken : decoded.args.token;
    if (!token) return [];
    const types = ["address", "address", "uint256", "uint64", "address", "uint64", "uint64"];
    const values = [from, token, amount, mintChainId, mintAccount, nonce, chainId];
    const v1 = utils.solidityKeccak256(types, values);
    return to ? [v1, utils.solidityKeccak256([...types, "address"], [...values, to])] : [v1];
}

export function matchesCelerDepositReceipt(tx: DepositTransaction, receipt: DepositReceipt | null,
                                           expected: string): boolean {
    const decoded = decodeCelerDeposit(tx.data);
    if (!decoded || !decoded.args.mintChainId.eq(1030) || !tx.to || !receipt || receipt.status !== 1
        || receipt.transactionHash.toLowerCase() !== tx.hash.toLowerCase()) {
        return false;
    }
    const {amount, mintChainId, mintAccount, nonce} = decoded.args;
    if (decoded.name === "depositNative" && !BigNumber.from(tx.value).eq(amount)) {
        return false;
    }
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tx.to.toLowerCase()) continue;
        try {
            const event = vault.parseLog(log).args;
            if (event.depositId.toLowerCase() !== expected.toLowerCase()
                || event.depositor.toLowerCase() !== tx.from.toLowerCase()
                || !event.amount.eq(amount)
                || !event.mintChainId.eq(mintChainId)
                || event.mintAccount.toLowerCase() !== mintAccount.toLowerCase()
                || (decoded.name === "deposit" && event.token.toLowerCase() !== decoded.args.token.toLowerCase())
                || (event.nonce !== undefined && !event.nonce.eq(nonce))) {
                continue;
            }
            const ids = celerDepositIds(tx.data, tx.from, tx.chainId, tx.to, event.token);
            const version = event.nonce === undefined ? 0 : 1;
            if (ids[version]?.toLowerCase() === expected.toLowerCase()) {
                return true;
            }
        } catch {
            // A receipt also contains unrelated ERC20 logs.
        }
    }
    return false;
}
