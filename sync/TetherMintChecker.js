"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventChecker = exports.addressName = exports.ALL_WATCH_TOKENS = exports.addressMap = exports.E_SPACE_DAI = exports.E_SPACE_USDT = exports.E_SPACE_C_BRIDGE = exports.E_SPACE_ANY_TOKENS = exports.E_SPACE_ANY_SWAP_DAI = exports.E_SPACE_ANY_SWAP_USDT = exports.ETHEREUM_TOKENS = exports.ETHEREUM_DAI_TOKEN = exports.ETHEREUM_USDT_TOKEN = exports.ZERO_FULL = exports.ZERO = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const Models_1 = require("../lib/Models");
const Tool_1 = require("../lib/Tool");
exports.ZERO = '0x0000000000000000000000000000000000000000';
exports.ZERO_FULL = '0x0000000000000000000000000000000000000000000000000000000000000000';
exports.ETHEREUM_USDT_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
exports.ETHEREUM_DAI_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
exports.ETHEREUM_TOKENS = new Set([exports.ETHEREUM_USDT_TOKEN, exports.ETHEREUM_DAI_TOKEN]);
exports.E_SPACE_ANY_SWAP_USDT = '0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C';
exports.E_SPACE_ANY_SWAP_DAI = '0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844';
exports.E_SPACE_ANY_TOKENS = new Set([exports.E_SPACE_ANY_SWAP_USDT, exports.E_SPACE_ANY_SWAP_DAI]);
// case sensitive
exports.E_SPACE_C_BRIDGE = '0x4F9e3186513224cf152016ccd86019E7B9A3c809';
exports.E_SPACE_USDT = '0xfe97E85d13ABD9c1c33384E796F10B73905637cE';
exports.E_SPACE_DAI = '0x74eaE367d018A5F29be559752e4B67d01cc6b151';
exports.addressMap = {
    [exports.E_SPACE_C_BRIDGE]: 'E_SPACE_C_BRIDGE',
    [exports.E_SPACE_ANY_SWAP_USDT]: 'AnyswapV6ERC20_USDT',
    [exports.E_SPACE_ANY_SWAP_DAI]: 'AnyswapV6ERC20_DAI',
    '0xBB7684Cc5408F4DD0921E5c2Cadd547b8f1AD573': 'celer',
    [exports.ETHEREUM_USDT_TOKEN]: 'ethereumUSDT',
    [exports.E_SPACE_USDT]: 'E_SPACE_USDT',
    [exports.E_SPACE_DAI]: 'E_SPACE_DAI',
};
exports.ALL_WATCH_TOKENS = new Set([exports.E_SPACE_USDT, exports.E_SPACE_DAI]);
function addressName(addr = '', unknown = 'unknown') {
    // @ts-ignore
    return exports.addressMap[addr] || unknown;
}
exports.addressName = addressName;
class EventChecker {
    constructor(url, tokenAddr) {
        this.notifyMint = true;
        this.mintSourceTxNotFound = async (tx, ether) => {
            console.log(`-------------------------------------------------`);
            console.log(`mintSourceTxNotFound, tx ${tx} , amount: ${ether}`);
            console.log(`-------------------------------------------------`);
        };
        this.notify = async (mintOrBurn, token, amount) => {
            console.log(`notify ${mintOrBurn}, ${token}, ${amount}`);
        };
        this.name = '';
        this.provider = ethers_1.ethers.getDefaultProvider(url);
        this.ethereumProvider = ethers_1.ethers.getDefaultProvider();
        this.tokenAddr = tokenAddr;
    }
    async init() {
        console.log(`init conflux provider ...`);
        const st = await this.provider.getNetwork();
        console.log(`conflux network ${st.chainId}`);
        console.log(`init ethereum provider ...`);
        console.log(`ethereum `, await this.ethereumProvider.getNetwork().then(st => st.chainId));
    }
    async getMintRoles() {
        const token = this.tokenAddr || '0xfe97e85d13abd9c1c33384e796f10b73905637ce';
        const abi = [
            'function getRoleMember(bytes32 role,uint256 index) view returns (address)',
            'function name() view returns (string memory)',
        ];
        const mint_role = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';
        const c = new ethers_1.Contract(token, abi, this.provider);
        try {
            const name = await c.name();
            await (0, Tool_1.addAddress)(this.tokenAddr, name);
            console.log(`token ${token}, name [${name}].`);
            this.name = name;
        }
        catch (e) {
            console.log(`get token name fail, address ${this.tokenAddr}`, e);
            process.exit(2);
        }
        const arr = [];
        let idx = 0;
        do {
            const minter = await c.getRoleMember(mint_role, idx).catch((err) => {
                if (err.message.includes('call revert exception')) {
                    return '';
                }
                throw err;
            });
            if (!minter) {
                break;
            }
            // @ts-ignore
            console.log(`minter ${idx} is ${minter} ${addressName(minter)}`);
            arr.push(minter);
            idx++;
        } while (idx < 1000);
        console.log(`minter count ${arr.length}, token ${token}`);
    }
    async getEventByEpoch(epoch = 38659021) {
        // const blockNumber = await this.provider.getBlockNumber()
        // console.log(`max block number is`, blockNumber)
        process.stderr.write(`\r\u001b[2K ---- fetch by epoch ${epoch} ----\t\t`);
        let filter = {
            fromBlock: epoch, toBlock: epoch,
            address: this.tokenAddr,
            topics: [
                [
                    ethers_1.utils.id("Transfer(address,address,uint256)"),
                    // utils.id("LogSwapin(bytes32 indexed,address indexed,uint)"),
                ],
                [
                // hexZeroPad('0x0', 32),
                // null,
                // utils.id("LogSwapout(address indexed account, address indexed bindaddr, uint amount)"),
                ],
            ]
        };
        const logs = await this.provider.getLogs(filter);
        // console.log(`get logs, epoch ${epoch} , of address ${filter.address}`, logs)
        await this.checkMintEvents(logs);
    }
    async calcSupply(minterAddr, diff, tokenAddr) {
        const pre = await Models_1.Bill.findOne({ where: { minterAddr, tokenAddr }, order: [['blockNumber', 'desc']] });
        const drip = BigInt(pre?.minterSupply || 0) + diff;
        return {
            drip, unit: (0, utils_1.formatEther)(drip),
        };
    }
    async checkMintEvents(logs) {
        // mint(from zero to someone) logs of one epoch in eSpace
        for (let log of logs) {
            const { transactionHash, data, address, topics: [topic, sender, receiver] } = log;
            let sign = 1n; // or -1
            let action = 'mint';
            if (sender === exports.ZERO_FULL) {
            }
            else if (receiver === exports.ZERO_FULL) {
                sign = -1n;
                action = 'burn';
            }
            else {
                // console.log(`not mint or burn. ${sender} -> ${receiver}`, log.topics)
                continue;
            }
            if (!this.tokenAddr === address) {
                console.log(`watch for ${this.tokenAddr}`);
                console.log(`not watching token ${address}, want ${this.tokenAddr}`);
                continue;
            }
            // watching tokens emit event
            const receipt = await this.provider.getTransactionReceipt(transactionHash);
            const { from, to, blockNumber } = receipt;
            let wei = BigInt(data);
            let mintV = (0, utils_1.formatEther)(wei);
            console.log(`mint at tx ${transactionHash}, value ${mintV}`);
            if (this.notifyMint) {
                await this.notify(action, this.tokenAddr, mintV);
            }
            // console.log(`receipt `, receipt)
            console.log(`tx from ${from} ${addressName(from)} to ${to} ${addressName(to)}`);
            if (to === exports.E_SPACE_C_BRIDGE) {
                const newSupply = await this.calcSupply(to, wei * sign, address);
                await Models_1.Bill.create({
                    blockNumber,
                    ethereumDrip: 0n,
                    ethereumFormatUnit: 0,
                    ethereumTx: "",
                    ethereumTxFrom: "",
                    ethereumTxTo: "",
                    ethereumTxToken: "",
                    drip: wei * sign,
                    formatUnit: parseFloat(mintV) * (sign > 0n ? 1 : -1),
                    minterAddr: to,
                    minterName: addressName(to),
                    minterSupply: newSupply.drip,
                    minterSupplyFormat: parseFloat(newSupply.unit),
                    tokenAddr: address,
                    tokenName: addressName(address),
                    tx: transactionHash
                });
                continue;
            }
            // console.log(`tx detail`, receipt.logs)
            let found = false;
            //
            for (let eSpaceLog of receipt.logs) {
                const [eTopic, eSender, eReceiver] = eSpaceLog.topics;
                if (!exports.E_SPACE_ANY_TOKENS.has(eSpaceLog.address)) {
                    continue;
                }
                if (
                // LogSwapout(index_topic_1 address account, index_topic_2 address bindaddr, uint256 amount)
                eTopic === '0x6b616089d04950dc06c45c6dd787d657980543f89651aec47924752c7d16c888') {
                    const newSupply = await this.calcSupply(eSpaceLog.address, wei * sign, address);
                    await Models_1.Bill.create({
                        blockNumber,
                        drip: wei,
                        ethereumDrip: 0n,
                        ethereumFormatUnit: 0,
                        ethereumTx: '',
                        ethereumTxFrom: '',
                        ethereumTxTo: '',
                        ethereumTxToken: '',
                        formatUnit: -parseFloat(mintV),
                        minterAddr: eSpaceLog.address,
                        minterName: addressName(eSpaceLog.address),
                        minterSupply: newSupply.drip,
                        minterSupplyFormat: parseFloat(newSupply.unit),
                        tokenAddr: address,
                        tokenName: addressName(address),
                        tx: transactionHash
                    });
                    found = true;
                }
                else if (
                //  event LogSwapin(bytes32 indexed txhash, address indexed account, uint amount);
                eTopic === '0x05d0634fe981be85c22e2942a880821b70095d84e152c3ea3c17a4e4250d9d61') {
                    const [, txHashEth, txFromEth] = eSpaceLog.topics;
                    console.log(`ethereum tx hash ${txHashEth}, from ${(0, utils_1.hexStripZeros)(txFromEth)}`);
                    //
                    const txEthReceipt = await this.ethereumProvider.getTransactionReceipt(txHashEth);
                    const { from: txEthReceiptFrom, to: txEthTo, logs: txEthLogs } = txEthReceipt;
                    // console.log(`tx on ethereum, from ${txEthReceiptFrom} , logs`, txEthLogs[0])
                    console.log(`tx on ethereum, from ${txEthReceiptFrom}`);
                    //
                    for (let ethereumLog of txEthLogs) {
                        if (exports.ETHEREUM_TOKENS.has(ethereumLog.address)) {
                            console.log(`It's not ethereum token event. ${ethereumLog.address}`);
                            continue;
                        }
                        const [topic, sender, receiver] = ethereumLog.topics;
                        // Transfer (index_topic_1 address from, index_topic_2 address to, uint256 value)
                        if (topic === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                            let ethDrip = BigInt(ethereumLog.data);
                            const v = (0, utils_1.formatUnits)(ethDrip, 6); //USDT with decimals 6
                            console.log(`ethereum, transfer from ${(0, utils_1.hexStripZeros)(sender)} to ${(0, utils_1.hexStripZeros)(receiver)}`, v);
                            const newSupply = await this.calcSupply(eSpaceLog.address, wei * sign, address);
                            await Models_1.Bill.create({
                                blockNumber,
                                drip: wei,
                                ethereumDrip: ethDrip,
                                ethereumFormatUnit: parseFloat(v),
                                ethereumTx: txHashEth,
                                ethereumTxFrom: txEthReceiptFrom,
                                ethereumTxTo: txEthTo,
                                ethereumTxToken: ethereumLog.address,
                                formatUnit: parseFloat(mintV),
                                minterAddr: eSpaceLog.address,
                                minterName: addressName(eSpaceLog.address),
                                minterSupply: newSupply.drip,
                                minterSupplyFormat: parseFloat(newSupply.unit),
                                tokenAddr: address,
                                tokenName: addressName(address),
                                tx: transactionHash
                            });
                            found = true;
                        }
                    }
                }
            }
            if (found) {
                continue;
            }
            // not found corresponding tx on ethereum.
            await this.mintSourceTxNotFound(transactionHash, mintV);
        }
    }
}
exports.EventChecker = EventChecker;
