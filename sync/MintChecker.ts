import {Contract, ethers, utils} from "ethers";
import {BaseProvider} from "@ethersproject/providers"
import {formatEther, formatUnits, hexStripZeros, hexZeroPad, parseUnits} from "ethers/lib/utils";
import {Bill, Config, updateConfig} from "../lib/Models";
import {addAddress, dingMsg, sleep} from "../lib/Tool";
import {fetchErc20Transfer} from "./EtherScan";
export const ZERO = '0x0000000000000000000000000000000000000000'
export const ZERO_FULL = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const ETHEREUM_USDT_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
export const ETHEREUM_DAI_TOKEN =  '0x6B175474E89094C44Da98b954EedeAC495271d0F'
export const ETHEREUM_USDC_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const ETHEREUM_WBTC_TOKEN = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
export const ETHEREUM_WETH_TOKEN = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
// white list of tokens on ethereum
export const ETHEREUM_TOKENS = new Set<string>([
    ETHEREUM_USDT_TOKEN, ETHEREUM_DAI_TOKEN, ETHEREUM_USDC_TOKEN,
    ETHEREUM_WBTC_TOKEN, ETHEREUM_WETH_TOKEN,
]);

export const E_SPACE_ANY_SWAP_USDT = '0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C'
export const E_SPACE_ANY_SWAP_DAI = '0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844'
// case sensitive
export const E_SPACE_C_BRIDGE = '0x4F9e3186513224cf152016ccd86019E7B9A3c809'
export const E_SPACE_USDT = '0xfe97E85d13ABD9c1c33384E796F10B73905637cE'
export const E_SPACE_DAI = '0x74eaE367d018A5F29be559752e4B67d01cc6b151'
export const E_SPACE_USDC = '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372'
export const E_SPACE_WBTC = '0x1f545487c62e5acfea45dcadd9c627361d1616d8'
export const E_SPACE_ETH = '0xa47f43de2f9623acb395ca4905746496d2014d57'

export const TOKEN_BIND = new Map<string, string>()
TOKEN_BIND.set(E_SPACE_USDT.toLowerCase(), ETHEREUM_USDT_TOKEN)
TOKEN_BIND.set(E_SPACE_DAI.toLowerCase(), ETHEREUM_DAI_TOKEN)
TOKEN_BIND.set(E_SPACE_USDC.toLowerCase(), ETHEREUM_USDC_TOKEN)
TOKEN_BIND.set(E_SPACE_WBTC.toLowerCase(), ETHEREUM_WBTC_TOKEN)
TOKEN_BIND.set(E_SPACE_ETH.toLowerCase(), ETHEREUM_WETH_TOKEN)

export function getBindToken(eSpace: string) {
    return TOKEN_BIND.get(eSpace.toLowerCase())
}

export const addressMap:{[k:string]: string} = {
    [E_SPACE_C_BRIDGE]: 'E_SPACE_C_BRIDGE', // impl 0xe254a9637a4cb07777fa07a6eb4892eb07e2db94, cross space bridge
    [E_SPACE_ANY_SWAP_USDT]: 'AnyswapV6ERC20_USDT', // vault 0x373590a576ccb8143f377db5f1c16f9f8528a8b4, it's not a contract
    [E_SPACE_ANY_SWAP_DAI]: 'AnyswapV6ERC20_DAI', //
    '0xBB7684Cc5408F4DD0921E5c2Cadd547b8f1AD573': 'celer',
    [ETHEREUM_USDT_TOKEN]:'ethereumUSDT',
    [ETHEREUM_USDC_TOKEN]: 'ethereumUSDC',
    [ETHEREUM_WBTC_TOKEN]: 'ethereumWBTC',
    [E_SPACE_USDT]: 'E_SPACE_USDT',
    [E_SPACE_DAI]: 'E_SPACE_DAI',
}
export function addressName(addr = '', unknown = 'unknown') {
    // @ts-ignore
    return addressMap[addr] || unknown;
}
export class EventChecker {
    notifyMint = true
    public provider: BaseProvider;
    public ethereumProvider: BaseProvider;
    dingToken = ''
    public tokenAddr: string = '';
    public name = ''
    public minterSet = new Set<string>()
    ethereumContract!: Contract
    decimalInfo = new Map<string, number>()

    public mintSourceTxNotFound = async (tx:string, ether:string)=>{
        console.log(`-------------------------------------------------`)
        console.log(`mintSourceTxNotFound, tx ${tx} , amount: ${ether}`)
        console.log(`-------------------------------------------------`)
    }
    public notify = async (mintOrBurn:string, token:string, amount: string) => {
        console.log(`notify ${mintOrBurn}, ${token}, ${amount}`)
    }
    public confluxContract!: Contract;

    constructor(url: string, tokenAddr:string) {
        this.provider = ethers.getDefaultProvider(url)
        this.ethereumProvider = ethers.getDefaultProvider();
        this.tokenAddr = tokenAddr
    }
    async getDecimal(addr: string) {
        let v = this.decimalInfo.get(addr)
        if (!v) {
            const copyC = this.ethereumContract.attach(addr)
            v = await copyC.decimals()
            if (!v) {
                console.log(`fetch decimals error, ${addr}`)
                v = 18
            }
            console.log(`fetch decimal got ${v}, ${addr}`);
            this.decimalInfo.set(addr, v)
        }
        return v;
    }
    async init() {
        console.log(`init conflux provider ...`)
        const st = await this.provider.getNetwork()
        console.log(`conflux network ${st.chainId}, block number `, await this.provider.getBlockNumber())

        console.log(`init ethereum provider ...`)
        console.log(`ethereum `, await this.ethereumProvider.getNetwork().then(st=>st.chainId))
    }
    async getMintRoles() {
        const token = this.tokenAddr
        const abi = [
            'function getRoleMemberCount(bytes32 role) view returns (uint256)',
            'function getRoleMember(bytes32 role,uint256 index) view returns (address)',
            'function name() view returns (string memory)',
            'function decimals() public view returns (uint8)',
            'function totalSupply() view returns (uint256)',
            'function minterSupply(address who) view returns (tuple(uint256 cap, uint256 total))',
        ]
        const minterRole = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
        const c = new Contract(token, abi, this.provider);
        this.confluxContract = c;
        this.ethereumContract = new Contract(token, abi, this.ethereumProvider);
        try {
            const name = await c.name()
            addressMap[this.tokenAddr] = name;
            await addAddress(this.tokenAddr, name)
            console.log(`token ${token}, name [${name}].`)
            this.name = name;
        } catch (e) {
            console.log(`get token name fail, address ${this.tokenAddr}`, e)
            process.exit(2)
        }
        const roleCount = await c.getRoleMemberCount(minterRole)
        console.log(`minter role count ${roleCount}`)
        this.minterSet.clear()
        for(let idx=0; idx<roleCount; idx++) {
            const minter = await c.getRoleMember(minterRole, idx)
            // auto detect contract name
            try {
                const copyC = c.attach(minter)
                const cName = await copyC.name();
                addressMap[minter] = cName;
            } catch (e) {
                //
            }
            console.log(`minter ${idx} is ${minter} ${addressName(minter)}`);
            this.minterSet.add(minter)
        }
        console.log(`minter count ${this.minterSet.size}, token ${token}`)
    }
    async getEventByEpoch(epoch: number = 38659021) {
        // const blockNumber = await this.provider.getBlockNumber()
        // console.log(`max block number is`, blockNumber)
        process.stderr.write(`\r\u001b[2K ---- fetch by epoch ${epoch} ----\t`)
        let filter = {
            fromBlock: epoch, toBlock: epoch, limit: 5000,
            address: this.tokenAddr,
            topics: [utils.id("Transfer(address,address,uint256)"),]
        };
        const logs = await this.provider.getLogs(filter).catch(err=>{
            console.log(`get logs fail:`, filter)
            throw err;
        })
        // console.log(`get logs, epoch ${epoch} , of address ${filter.address}`, logs)
        await this.checkMintEvents(logs);
    }
    async calcSupply(minterAddr:string, diff: bigint, tokenAddr: string) {
        const pre = await Bill.findOne({where: {minterAddr, tokenAddr}, order:[['blockNumber', 'desc']]})
        const drip = BigInt(pre?.minterSupply || 0) + diff
        return {
            drip, unit: formatEther(drip),
        }
    }
    async saveConfluxBridgeMint(to:string, wei: bigint, sign:bigint, blockNumber:number,mintV:string, transactionHash: string) {
        const newSupply = await this.calcSupply(to, wei * sign, this.tokenAddr)
        await Bill.create({
            blockNumber,
            ethereumDrip: 0n, ethereumFormatUnit: 0, ethereumTx: "", ethereumTxFrom: "", ethereumTxTo: "",
            ethereumTxToken: "", drip: wei * sign,
            formatUnit: parseFloat(mintV) * (sign > 0n ? 1 : -1),
            minterAddr: to,
            minterName: addressName(to),
            minterSupply: newSupply.drip,
            minterSupplyFormat: parseFloat(newSupply.unit),
            tokenAddr: this.tokenAddr,
            tokenName: this.name,
            tx: transactionHash
        })
    }
    async checkMintEvents(logs: Array<any>) {
        // mint(from zero to someone) logs of one epoch in eSpace
        for (let log of logs) {
            const {transactionHash, data, topics: [topic, sender, receiver]} = log
            let sign = 1n // or -1
            let action = 'mint'
            if (sender === ZERO_FULL) {
            }else if (receiver === ZERO_FULL) {
                sign = -1n
                action = 'burn'
            } else {
                // console.log(`not mint or burn. ${sender} -> ${receiver}`, log.topics)
                continue
            }
            // watching tokens emit event
            const receipt = await this.provider.getTransactionReceipt(transactionHash);
            const {from, to, blockNumber} = receipt
            let wei = BigInt(data);
            let mintV = formatEther(wei);
            console.log(`[${this.name}] ${action} at tx ${transactionHash}, value ${mintV}`)
            if (this.notifyMint) {
                await this.notify(action, this.tokenAddr, mintV)
            }
            // console.log(`receipt `, receipt)
            console.log(`tx from ${from} ${addressName(from)} to ${to} ${addressName(to)}`)
            if (to === E_SPACE_C_BRIDGE) {
                await this.saveConfluxBridgeMint(to, wei, sign, blockNumber, mintV, transactionHash)
                continue
            }
            // console.log(`tx detail`, receipt.logs)
            let found = false;
            //
            for (let eSpaceLog of receipt.logs) {
                const {topics: [eTopic, eSender, eReceiver], address: eventSource} = eSpaceLog
                if (eventSource.toLowerCase() === this.tokenAddr.toLowerCase()) {
                    continue;
                }
                if(!this.minterSet.has(eventSource)) {
                    console.log(`event source contract not in minterSet. ${eventSource}`);
                    continue;
                }
                if (
                    // Burn(bytes32 burnId, address token, address account, uint256 amount, address withdrawAccount) // celer
                    eTopic === '0x75f1bf55bb1de41b63a775dc7d4500f01114ee62b688a6b11d34f4692c1f3d43' ||
                    // LogSwapout(index_topic_1 address account, index_topic_2 address bindaddr, uint256 amount) // multi chain
                    eTopic === '0x6b616089d04950dc06c45c6dd787d657980543f89651aec47924752c7d16c888') {
                    const newSupply = await this.calcSupply(eSpaceLog.address, wei*sign, this.tokenAddr)
                    await Bill.create({
                        blockNumber, drip: wei, ethereumDrip: 0n, ethereumFormatUnit: 0, ethereumTx: '', ethereumTxFrom: '',
                        ethereumTxTo: '', ethereumTxToken: '',
                        formatUnit: -parseFloat(mintV), minterAddr: eSpaceLog.address,
                        minterName: addressName(eSpaceLog.address),
                        minterSupply: newSupply.drip, minterSupplyFormat: parseFloat(newSupply.unit),
                        tokenAddr: this.tokenAddr, tokenName: this.name,
                        tx: transactionHash
                    })
                    found = true;
                } else if (
                    //  event LogSwapin(bytes32 indexed txhash, address indexed account, uint amount);
                    eTopic === '0x05d0634fe981be85c22e2942a880821b70095d84e152c3ea3c17a4e4250d9d61'
                ) {
                    const [,txHashEth, txFromEth] = eSpaceLog.topics
                    console.log(`ethereum tx hash ${txHashEth} from ${hexStripZeros(txFromEth)}`)
                    found = await this.searchEvmTx({
                        txHashEth, eSpaceLog, wei, sign, mintV, transactionHash, blockNumber
                    });
                } else if (eTopic === '0x5bc84ecccfced5bb04bfc7f3efcdbe7f5cd21949ef146811b4d1967fe41f777a') {
                    // celer
                    // Mint(bytes32 mintId, address token, address account, uint256 amount, uint64 refChainId, bytes32 refId, address depositor)
                    const pureData = eSpaceLog.data.substring(2)
                    const account = '0x'+pureData.substring(64*2 + 24, 64*3)
                    const amount = BigInt('0x'+pureData.substring(64*3, 64*4))
                    const refChainId = BigInt('0x'+pureData.substring(64*4, 64*5))
                    const refId = '0x'+pureData.substring(64*5, 64*6)
                    // const [mintId,token,account,amount,refChainId,refId, depositor] = eSpaceLog.topics
                    const fmtAmt = formatEther(amount)
                    console.log(`[${this.name}] celer mint, account ${account}, amount ${amount} ${fmtAmt}`)
                    found = await this.searchCelerEvmTx(eSpaceLog.address, account, BigInt(amount), wei*sign, wei,
                        blockNumber, transactionHash, refId)
                }
            }
            if (found) {
                continue
            }
            // not found corresponding tx on ethereum.
            await this.mintSourceTxNotFound(transactionHash, mintV);
        }
    }
    async searchCelerEvmTx(minter: string, account:string, amount:bigint, diff:bigint, wei:bigint, blockNumber:number,
                           transactionHash:string, refId:string) {
        const {timestamp} = await this.provider.getBlock(blockNumber)
        const row = await fetchErc20Transfer(account, wei, getBindToken(this.tokenAddr)!, timestamp, refId)
        if (row) {
            const {hash:txHashEth, timeStamp, nonce, from:txEthReceiptFrom, to:txEthTo,
                contractAddress, value, tokenName, tokenDecimal} = row
            const newSupply = await this.calcSupply(minter, BigInt(diff), this.tokenAddr)
            await Bill.create({
                blockNumber, drip: wei, ethereumDrip: value, ethereumFormatUnit: parseFloat(formatUnits(BigInt(value), parseInt(tokenDecimal))),
                ethereumTx: txHashEth, ethereumTxFrom: txEthReceiptFrom, ethereumTxTo: txEthTo,
                ethereumTxToken: contractAddress, formatUnit: parseFloat(formatEther(wei)),
                minterAddr: minter, minterName: addressName(minter),
                minterSupply: newSupply.drip, minterSupplyFormat: parseFloat(newSupply.unit),
                tokenAddr: this.tokenAddr, tokenName: this.name,
                tx: transactionHash
            })
            return true;
        }
        return false;
    }
    async searchEvmTx(obj:any) {
        const {txHashEth, eSpaceLog, wei, sign, mintV, transactionHash, blockNumber} = obj
        let found = false
        //
        const txEth = await this.ethereumProvider.getTransaction(txHashEth)
        const fmtValueInTx = formatEther(txEth.value)
        const txEthReceipt = await this.ethereumProvider.getTransactionReceipt(txHashEth)
        if (txEthReceipt.status != 1) {
            console.log(`transaction on ethereum is failed. ${txHashEth}, status ${txEthReceipt.status}`)
        }
        const {from:txEthReceiptFrom, to: txEthTo, logs: txEthLogs} = txEthReceipt
        // console.log(`tx on ethereum, from ${txEthReceiptFrom} , logs`, txEthLogs[0])
        console.log(`tx on ethereum, from ${txEthReceiptFrom} to ${txEthTo} , logs count ${txEthLogs.length
        }, status ${txEthReceipt.status} value ${fmtValueInTx}`)

        if (txEth.value && this.tokenAddr.toLowerCase() === '0xa47f43de2f9623acb395ca4905746496d2014d57') {
            console.log(`It's ETH, value ${fmtValueInTx}`)
            if (txEth.value.toBigInt() < wei) {
                console.log(`[${this.name}] On ethereum, transfer ETH ${fmtValueInTx} < ${mintV}`)
                return false;
            }
            const newSupply = await this.calcSupply(eSpaceLog.address, BigInt(wei*sign), this.tokenAddr)
            await Bill.create({
                blockNumber, drip: wei, ethereumDrip: txEth.value.toBigInt(), ethereumFormatUnit: parseFloat(fmtValueInTx),
                ethereumTx: txHashEth,
                ethereumTxFrom: txEthReceiptFrom,
                ethereumTxTo: txEthTo,
                ethereumTxToken: 'Raw ETH',
                formatUnit: parseFloat(mintV),
                minterAddr: eSpaceLog.address,
                minterName: addressName(eSpaceLog.address),
                minterSupply: newSupply.drip,
                minterSupplyFormat: parseFloat(newSupply.unit),
                tokenAddr: this.tokenAddr,
                tokenName: this.name,
                tx: transactionHash
            })
            return true;
        }
        //
        for (let ethereumLog of txEthLogs) {
            if (!ETHEREUM_TOKENS.has(ethereumLog.address)) {
                console.log(`[${this.name}] It's not in ethereum token whitelist. ${ethereumLog.address}`)
                continue
            }
            const [topic, sender, receiver] = ethereumLog.topics
            // Transfer (index_topic_1 address from, index_topic_2 address to, uint256 value)
            if (topic === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                let ethDrip = BigInt(ethereumLog.data);
                const v = formatUnits(ethDrip, await this.getDecimal(ethereumLog.address))// USDT with decimals 6
                if (parseUnits(v, 18).toBigInt() < wei) {
                    console.log(`[${this.name}] On ethereum, transfer value ${v} < ${mintV} , token ${ethereumLog.address}`)
                    continue
                }
                console.log(`ethereum, transfer from ${hexStripZeros(sender)} to ${hexStripZeros(receiver)}`, v)
                const newSupply = await this.calcSupply(eSpaceLog.address, BigInt(wei*sign), this.tokenAddr)
                await Bill.create({
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
                    tokenAddr: this.tokenAddr,
                    tokenName: this.name,
                    tx: transactionHash
                })
                found = true;
            }
        }
        return found;
    }
}

const superagent = require('superagent')
export async function listMintBurnFromScan(token: string) {
    const zero = '0x0000000000000000000000000000000000000000'
    const limit = 100
    const resultList:any[] = []
    do {
        let url = `https://evm.confluxscan.net/v1/transfer?address=${token
        }&from=${zero}&limit=${limit}&skip=0&to=${zero}&transferType=ERC20`;
        console.log(`fetch from scan \n`, url)
        const result = await superagent.get(url).then((res: { body: any; }) => res.body || res)
        // console.log(result)
        const {total, list} = result
        resultList.push(...list)
        if (list.length < limit) {
            break;
        }
    } while (true)
    resultList.sort((a,b)=>a.epochNumber - b.epochNumber)
    return resultList;
}
export async function importFromScan(checker: EventChecker, cursorKey: string) {
    const recordsInDb = await Bill.findOne({where:{tokenAddr: checker.tokenAddr}, raw: true})
    if (recordsInDb) {
        console.log(`Records found in db, can not import.`, recordsInDb)
        process.exit(9)
    }
    const list = await listMintBurnFromScan(checker.tokenAddr).catch(err=>{
        console.log(`error fetch list from scan`, err.message)
        console.log(err)
        process.exit(9)
    });
    let idx = 0
    for(const row of list) {
        idx ++
        console.log(`import ${idx} of ${list.length}`)
        const {epochNumber:epoch} = row
        await checker.getEventByEpoch(epoch) // burn
        // it's the next epoch.
        await Config.upsert({name: cursorKey, config: (epoch+1).toString()})
    }
}

