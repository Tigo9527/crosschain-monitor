import {Contract, ethers, utils} from "ethers";
import {BaseProvider} from "@ethersproject/providers"
import {formatEther, formatUnits, hexStripZeros, hexZeroPad, parseUnits} from "ethers/lib/utils";
import {Bill, Config, DelayedMint, updateConfig} from "../lib/Models";
import {addAddress, dingMsg, sleep} from "../lib/Tool";
import {fetchErc20Transfer} from "./EtherScan";
export const ZERO = '0x0000000000000000000000000000000000000000'
export const ZERO_FULL = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const ETHEREUM_USDT_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
export const ETHEREUM_DAI_TOKEN =  '0x6B175474E89094C44Da98b954EedeAC495271d0F'
export const ETHEREUM_USDC_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const ETHEREUM_WBTC_TOKEN = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
export const ETHEREUM_WETH_TOKEN = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
//
export const BSC_USD = '0x55d398326f99059fF775485246999027B3197955' // pegged mc
export const BSC_ETH = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' // pegged mc
export const BSC_BTC = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' // pegged mc
export const BSC_USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' // Binance-Peg USD Coin
// white list of tokens on ethereum
export const ETHEREUM_TOKENS = new Set<string>([
    ETHEREUM_USDT_TOKEN, ETHEREUM_DAI_TOKEN, ETHEREUM_USDC_TOKEN,
    ETHEREUM_WBTC_TOKEN, ETHEREUM_WETH_TOKEN,
    BSC_USD, BSC_ETH, BSC_BTC, BSC_USDC
]);
// export const GHOST_USDT_MINTER_1 = '0xF480f38C366dAaC4305dC484b2Ad7a496FF00CeA'
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

export const FOREIGN_TOKEN_TO_LOCAL = new Map<string, string>()
FOREIGN_TOKEN_TO_LOCAL.set(BSC_USD.toLowerCase(), E_SPACE_USDT.toLowerCase())
FOREIGN_TOKEN_TO_LOCAL.set(BSC_ETH.toLowerCase(), E_SPACE_ETH.toLowerCase())
FOREIGN_TOKEN_TO_LOCAL.set(BSC_BTC.toLowerCase(), E_SPACE_WBTC.toLowerCase())
FOREIGN_TOKEN_TO_LOCAL.set(BSC_USDC.toLowerCase(), E_SPACE_USDC.toLowerCase())


export function mapForeignTokenToLocal(foreign:string) {
    let local = FOREIGN_TOKEN_TO_LOCAL.get(foreign.toLowerCase())
    if (!local) {
        console.log(`!!!!! map foreign token to local, not found ${foreign}`)
        console.log(`mapping is `, FOREIGN_TOKEN_TO_LOCAL)
    }
    return local
}

export function getBindToken(eSpace: string) {
    let newVar = TOKEN_BIND.get(eSpace.toLowerCase());
    if (!newVar) {
        console.log(`!!!!! ethereum token not found for [${eSpace}]`)
    }
    return newVar;
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
    // [GHOST_USDT_MINTER_1]: 'bscAnySwap?',
}
export function addressName(addr = '', unknown = 'unknown') {
    // @ts-ignore
    return addressMap[addr] || unknown;
}
export class EventChecker {
    notifyMint = true
    public provider: BaseProvider;
    public ethereumProvider: BaseProvider;
    public bscProvider: BaseProvider;
    dingToken = ''
    public tokenAddr: string = '';
    public celerAddr: string = '';
    public name = ''
    public multiChainMPC = '0x373590a576ccb8143f377db5f1c16f9f8528a8b4'
    public minterSet = new Set<string>()
    ethereumContract!: Contract
    decimalInfo = new Map<string, number>()

    public confluxContract!: Contract;
    public eSpaceMultiChainAny20Contract!: Contract;
    private celerContract!: Contract;

    public mintSourceTxNotFound = async (tx:string, ether:string)=>{
        console.log(`-------------------------------------------------`)
        console.log(`mintSourceTxNotFound, tx ${tx} , amount: ${ether}`)
        console.log(`-------------------------------------------------`)
    }
    public notify = async (mintOrBurn:string, token:string, amount: string) => {
        console.log(`notify ${mintOrBurn} , ${token} , ${amount}`)
    }

    constructor(url: string, tokenAddr:string) {
        this.provider = ethers.getDefaultProvider(url)
        this.ethereumProvider = ethers.getDefaultProvider();
        this.bscProvider = ethers.getDefaultProvider('https://bsc-dataseed.binance.org/')
        this.tokenAddr = tokenAddr
    }
    async getDecimal(addr: string, provider: BaseProvider) {
        let v = this.decimalInfo.get(addr)
        if (!v) {
            const copyC = this.ethereumContract.attach(addr).connect(provider)
            v = await copyC.decimals()
            if (!v) {
                console.log(`fetch decimals error, ${addr}`)
                v = 18
            }
            console.log(`fetch decimal got ${v} , ${addr}`);
            this.decimalInfo.set(addr, v)
        }
        return v;
    }
    async init() {
        console.log(`init conflux provider ...`)
        const st = await this.provider.getNetwork()
        console.log(`conflux network ${st.chainId} , block number `, await this.provider.getBlockNumber())

        console.log(`init ethereum provider ...`)
        console.log(`ethereum `, await this.ethereumProvider.getNetwork().then(st=>st.chainId))

        console.log(`init bsc provider ...`)
        console.log(`ethereum `, await this.bscProvider.getNetwork().then(st=>st.chainId))
        //
        const celerAbi = [
            'function delayedTransfers(bytes32 id) view returns (tuple(address receiver,address token,uint256 amount,uint256 timestamp))',
        ]

        let celerAddress = process.env.CELER_ADDRESS || '';
        if (!celerAddress) {
            console.log(`Please config [CELER_ADDRESS] in .env`)
            process.exit(8)
        }
        this.celerAddr = celerAddress
        this.celerContract = new Contract(celerAddress, celerAbi, this.provider);
        const mChainAny20Abi = [
            `function getAllMinters() public view returns (address[])`
        ]
        this.eSpaceMultiChainAny20Contract = new Contract(ZERO, mChainAny20Abi, this.provider)
    }
    async getMinterChildren(minter: string) : Promise<string[]>{
        const any20 = await this.eSpaceMultiChainAny20Contract.attach(minter)
        try {
            const children = await any20.getAllMinters();
            return children
        } catch (e:any) {
            if (!e.message.includes('call revert exception')) {
                console.log(` getMinterChildren error `, e)
                throw e
            }
            // console.log(` getMinterChildren error `, e.message)
            return []
        }
    }
    async getMintRoles(exitOnError=true) {
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
            console.log(`token ${token} , name [${name}].`)
            this.name = name;
        } catch (e) {
            console.log(`get token name fail, address ${this.tokenAddr}`, e)
            if (exitOnError) {
                process.exit(2)
            } else {
                throw e
            }
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
            //
            const childrenMinter = await this.getMinterChildren(minter)
            console.log(`   children of ${minter} are [${childrenMinter.join(' , ')}] ${childrenMinter.length}`)
            childrenMinter.forEach(child=>{
                this.minterSet.add(child)
                let cName = `${addressName(minter, minter.substring(0,8))}_${minter.substring(0,8)}_child_${child.substring(0,8)}`;
                addressMap[child] = cName
                addAddress(child, cName)
            })
        }
        console.log(` --- minter count ${this.minterSet.size} , token ${token} [${this.name}] ---`)
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
        await this.checkCelerDelayEvent(epoch)
    }
    async checkCelerDelayEvent(epoch: number) {
        let filter = {
            fromBlock: epoch, toBlock: epoch, limit: 5000,
            address: process.env.CELER_ADDRESS,
            // DelayedTransferAdded(bytes32 id)
            // topics: ['0xcbcfffe5102114216a85d3aceb14ad4b81a3935b1b5c468fadf3889eb9c5dce6']
            // Mint(bytes32 mintId, address token, address account, uint256 amount, uint64 refChainId, bytes32 refId, address depositor)
            // topics: ['0x5bc84ecccfced5bb04bfc7f3efcdbe7f5cd21949ef146811b4d1967fe41f777a']
        };
        const logs = await this.provider.getLogs(filter).catch(err=>{
            console.log(`get logs fail:`, filter)
            throw err;
        })
        // console.log(`log count ${logs.length} , epoch ${epoch}`)
        // if delayed, check on ethereum, save it, and confirm when minting in eSpace contract.
        // if not delayed, check by mint event in eSpace token.
        const mintMap = new Map<string, any>()
        const delayedMap = new Map<string, any>()
        for (const log of logs) {
            // console.log(`celer delay event`, log)
            const topic = log.topics[0]
            if (topic === '0x5bc84ecccfced5bb04bfc7f3efcdbe7f5cd21949ef146811b4d1967fe41f777a') {
                // Mint(bytes32 mintId, address token, address account, uint256 amount, uint64 refChainId, bytes32 refId, address depositor)
                const pureData = log.data.substring(2)
                const mintId = '0x'+pureData.substring(64*0, 64*1)
                const token = '0x'+pureData.substring(64*1 + 24, 64*2)
                mintMap.set(mintId, log)
                console.log(`mint event , id`, mintId)
            } else if (topic === '0xcbcfffe5102114216a85d3aceb14ad4b81a3935b1b5c468fadf3889eb9c5dce6') {
                // DelayedTransferAdded(bytes32 id)
                delayedMap.set(log.data, log) // mint id -> log
                console.log(`delay event, mint id `, log.data)
            }
        }
        for (let mintId_ of delayedMap.keys()) {
            const mintLog = mintMap.get(mintId_)
            const {mintId, token, amount, account, refId, refChainId, fmtAmt} = EventChecker.parseCelerMint(mintLog.data)
            if (token.toLowerCase() !== this.tokenAddr.toLowerCase()) {
                console.log(`found token ${token} , want ${this.tokenAddr}`)
                // continue
            }
            console.log(`celer delayed mint tx ${mintLog.transactionHash}`);
            console.log(`celer delayed transfer info`, {account, token, amount, refId})
            let epochAnchor = epoch
            const hit = await this.searchCelerEvmTx(this.celerAddr, account, amount, amount, amount,
                epochAnchor, mintLog.transactionHash, refId, false)
            if (hit) {
                console.log(`save delayed mint.`)
                await DelayedMint.create({
                    blockNumber: mintLog.blockNumber, refId,
                    receiver:account, mintId, minter: this.celerAddr, minterName: 'celer',
                token, amount, amountFormat: parseFloat(formatEther(amount.toString())),
                tx: mintLog.transactionHash,}).catch(err=>{
                    console.log(`save DelayedMint fail`, err)
                })
            } else {
                await this.mintSourceTxNotFound(mintLog.transactionHash, formatEther(amount));
            }
        }
    }
    async calcSupply(minterAddr:string, diff: bigint, tokenAddr: string) {
        const pre = await Bill.findOne({where: {minterAddr, tokenAddr} , order:[['id', 'desc']]})
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
            console.log(`[${this.name}] ${action} at tx ${transactionHash} , value ${mintV}`)
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
                // if(!this.minterSet.has(eventSource) && eventSource !== GHOST_USDT_MINTER_1) {
                if(!this.minterSet.has(eventSource)) {
                    console.log(`event source contract not in minterSet. ${eventSource}`);
                    continue;
                }
                if (
                    // Burn(bytes32 burnId, address token, address account, uint256 amount, address withdrawAccount) // celer
                    eTopic === '0x75f1bf55bb1de41b63a775dc7d4500f01114ee62b688a6b11d34f4692c1f3d43' ||
                    // LogAnySwapOut(index_topic_1 address token, index_topic_2 address from, index_topic_3 address to, uint256 amount, uint256 fromChainID, uint256 toChainID)
                    eTopic === '0x97116cf6cd4f6412bb47914d6db18da9e16ab2142f543b86e207c24fbd16b23a' ||
                    // LogSwapout(index_topic_1 address account, index_topic_2 address bindaddr, uint256 amount) // multi chain
                    eTopic === '0x6b616089d04950dc06c45c6dd787d657980543f89651aec47924752c7d16c888') {
                    const newSupply = await this.calcSupply(eSpaceLog.address, wei*sign, this.tokenAddr)
                    await Bill.create({
                        blockNumber, drip: -wei, ethereumDrip: 0n, ethereumFormatUnit: 0, ethereumTx: '', ethereumTxFrom: '',
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
                    const [, txHashEth, txFromEth] = eSpaceLog.topics
                    console.log(`ethereum tx hash ${txHashEth} from ${hexStripZeros(txFromEth)}`)
                    found = await this.searchEvmTx({
                        txHashEth, eSpaceLog, wei, sign, mintV, transactionHash, blockNumber
                    } , this.ethereumProvider, this.multiChainMPC);
                } else if (eTopic === '0xaac9ce45fe3adf5143598c4f18a369591a20a3384aedaf1b525d29127e1fcd55') {
                    // LogAnySwapIn(index_topic_1 bytes32 txhash, index_topic_2 address token, index_topic_3 address to, uint256 amount, uint256 fromChainID, uint256 toChainID)
                    // bsc for now
                    // LogAnySwapIn , example https://evm.confluxscan.net/tx/0x1dc8d76ae97265f39205c9e60807ea89c53611733409a7d018c16120cfacac48?tab=logs
                    const [, txHashEth, token, to,] = eSpaceLog.topics
                    const [amount, fromChainId, toChainId] = ethers.utils.defaultAbiCoder.decode(['uint256','uint256','uint256'], eSpaceLog.data)
                    console.log(`bsc tx hash ${txHashEth} from ${hexStripZeros(to)} , amount ${amount} / ${formatEther(amount)} fromChain ${fromChainId} toChain ${toChainId}`)
                    found = await this.searchEvmTx({
                        txHashEth, eSpaceLog, wei, sign, mintV, transactionHash, blockNumber
                    } , this.bscProvider, '')//skip check mpc on BSC . It's different on each pegged token.
                    // usdt is '0x58340A102534080b9D3175F868aeA9f6aF986dD9'); // eth is 0x230219b25395f14b84cf4dcd987e2daf5a71e4b
                } else if (eTopic === '0x5bc84ecccfced5bb04bfc7f3efcdbe7f5cd21949ef146811b4d1967fe41f777a') {
                    // celer case A:  mint
                    // const [mintId,token,account,amount,refChainId,refId, depositor] = eSpaceLog.topics
                    const {mintId, token, amount, account, refId, refChainId, fmtAmt} = EventChecker.parseCelerMint(eSpaceLog.data)
                    if (token.toLowerCase() !== this.tokenAddr.toLowerCase()) {
                        console.log(`not for current token, found [${token}], want ${this.tokenAddr}`)
                        continue
                    }
                    console.log(`[${this.name}] celer mint, account ${account} , amount ${amount} ${fmtAmt}`);
                    found = await this.searchCelerEvmTx(eSpaceLog.address, account, BigInt(amount), wei*sign, wei,
                        blockNumber, transactionHash, refId, true)
                } else if (eTopic === '0x3b40e5089937425d14cdd96947e5661868357e224af59bd8b24a4b8a330d4426') {
                    // celer case B: DelayedTransferExecuted(bytes32 id, address receiver, address token, uint256 amount)
                    const pureData = eSpaceLog.data.substring(2)
                    // console.log(`DelayedTransferExecuted log data`, pureData)
                    const mintId = '0x'+pureData.substring(64*0, 64*1)
                    console.log(`DelayedTransferExecuted `, mintId)
                    const delayed = await DelayedMint.findOne({where: {mintId}})
                    if (!delayed) {
                        console.log(`DelayedTransferExecuted, former information not found`)
                        continue
                    }
                    const {receiver: account, amount, refId, blockNumber: delayedAtBlock} = delayed;
                    found = await this.searchCelerEvmTx(eSpaceLog.address, account, BigInt(amount), wei*sign, wei,
                        delayedAtBlock, transactionHash, refId, true)
                }
            }
            if (found) {
                continue
            }
            // not found corresponding tx on ethereum.
            await this.mintSourceTxNotFound(transactionHash, mintV);
        }
    }
    static parseCelerMint(data:string) {
        // Mint(bytes32 mintId, address token, address account, uint256 amount, uint64 refChainId, bytes32 refId, address depositor)
        const pureData = data.substring(2)
        const mintId = '0x'+pureData.substring(64*0, 64*1)
        const token = '0x'+pureData.substring(64*1 + 24, 64*2)
        const account = '0x'+pureData.substring(64*2 + 24, 64*3)
        const amount = BigInt('0x'+pureData.substring(64*3, 64*4))
        const refChainId = BigInt('0x'+pureData.substring(64*4, 64*5))
        const refId = '0x'+pureData.substring(64*5, 64*6)
        const fmtAmt = formatEther(amount)
        return {mintId, token, amount, account, refId, refChainId, fmtAmt}
    }
    async searchCelerEvmTx(minter: string, account:string, amount:bigint, diff:bigint, wei:bigint, blockNumber:number,
                           transactionHash:string, refId:string, save: boolean) {
        let timestamp;
        if (process.env.DEBUG_TIMESTAMP) {
            timestamp = 1648469937;//new Date('').getTime() / 1000 // test
        } else {
            const {timestamp: t0} = await this.provider.getBlock(blockNumber)
            timestamp = t0
        }
        const row = await fetchErc20Transfer(account, wei, getBindToken(this.tokenAddr)!, timestamp, refId)
        if (row) {
            const {hash:txHashEth, timeStamp, nonce, from:txEthReceiptFrom, to:txEthTo,
                contractAddress, value, tokenName, tokenDecimal} = row
            const newSupply = await this.calcSupply(minter, BigInt(diff), this.tokenAddr)
            if (save) {
                await Bill.create({
                    blockNumber, drip: wei, ethereumDrip: value, ethereumFormatUnit: parseFloat(formatUnits(BigInt(value), parseInt(tokenDecimal))),
                    ethereumTx: txHashEth, ethereumTxFrom: txEthReceiptFrom, ethereumTxTo: txEthTo,
                    ethereumTxToken: contractAddress, formatUnit: parseFloat(formatEther(wei)),
                    minterAddr: minter, minterName: addressName(minter),
                    minterSupply: newSupply.drip, minterSupplyFormat: parseFloat(newSupply.unit),
                    tokenAddr: this.tokenAddr, tokenName: this.name,
                    tx: transactionHash
                })
            }
            return true;
        }
        return false;
    }
    async searchEvmTx(obj:any, ethereumProvider: BaseProvider, mpc: string) {
        const {txHashEth, eSpaceLog, wei, sign, mintV, transactionHash, blockNumber} = obj
        let found = false
        //
        const txEth = await ethereumProvider.getTransaction(txHashEth)
        const fmtValueInTx = formatEther(txEth.value)
        const txEthReceipt = await ethereumProvider.getTransactionReceipt(txHashEth)
        if (txEthReceipt.status != 1) {
            console.log(`transaction on ethereum is failed. ${txHashEth} , status ${txEthReceipt.status}`)
        }
        const {from:txEthReceiptFrom, to: txEthTo, logs: txEthLogs} = txEthReceipt
        // console.log(`tx on ethereum, from ${txEthReceiptFrom} , logs`, txEthLogs[0])
        console.log(`tx on ethereum, from ${txEthReceiptFrom} to ${txEthTo} , logs count ${txEthLogs.length
        } , status ${txEthReceipt.status} value ${fmtValueInTx}`)

        if (txEth.value.toBigInt() && this.tokenAddr.toLowerCase() === '0xa47f43de2f9623acb395ca4905746496d2014d57') {
            console.log(`It's ETH, value ${fmtValueInTx}`)
            if (txEth.value.toBigInt() < wei) {
                console.log(`[${this.name}] On ethereum, transfer ETH ${fmtValueInTx} < ${mintV}`)
                return false;
            }
            if ( (txEthTo||'').toLowerCase() !== mpc.toLowerCase()) {
                console.log(`[${this.name}] ETH receiver is not multiChainMPC, want ${mpc} , actual ${txEthTo}`)
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
        const bindToken = (getBindToken(this.tokenAddr) || '').toLowerCase()
        for (let ethereumLog of txEthLogs) {
            const [topic, sender, receiver] = ethereumLog.topics
            if (topic !== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                continue
            }
            const localToken = mapForeignTokenToLocal(ethereumLog.address) || ''
            if (bindToken !== ethereumLog.address.toLowerCase() && localToken !== this.tokenAddr.toLowerCase()) {
                console.log(`[${this.name}] It's not binding, ${bindToken} vs ${ethereumLog.address
                } , neither mapping [${localToken}] vs ${this.tokenAddr} , emit by contract [${ethereumLog.address}]`)
                continue
            }
            if (!ETHEREUM_TOKENS.has(ethereumLog.address)) {
                console.log(`[${this.name}] It's not in ethereum token whitelist. ${ethereumLog.address}`)
                continue
            }
            if (mpc && hexStripZeros(receiver||'').toLowerCase() !== mpc.toLowerCase()) {
                console.log(`[${this.name}] token receiver is not multiChainMPC, want ${mpc} , actual ${receiver}`)
                continue
            }
            // Transfer (index_topic_1 address from, index_topic_2 address to, uint256 value)
            // if (topic === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            {
                let ethDrip = BigInt(ethereumLog.data);
                console.log(`try get decimal from ${ethereumLog.address}`)
                let decimals = await this.getDecimal(ethereumLog.address, ethereumProvider)
                const v = formatUnits(ethDrip, decimals)// USDT with decimals 6
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
    let skip = 0
    const resultList:any[] = []
    do {
        let url = `https://evm.confluxscan.net/v1/transfer?address=${token
        }&from=${zero}&limit=${limit}&skip=${skip}&to=${zero}&transferType=ERC20`;
        skip += limit
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
export async function addMinterPlaceHolder(checker: EventChecker) {
    await checker.getMintRoles()
    for( let minter of checker.minterSet ) {
        const bean = await Bill.findOne({where: {minterAddr: minter, tokenAddr: checker.tokenAddr}})
        if (bean) {
            console.log(`minter has record, ${minter} , epoch ${bean.blockNumber}`)
            continue
        }
        await Bill.create({
            minterAddr: minter,
            minterName: addressName(minter),
            tokenAddr: checker.tokenAddr,
            tokenName: checker.name,
            tx: 'PLACE_HOLDER_'+minter, // unique constraints
            // defaults
            blockNumber: 0,drip: 0n,ethereumDrip: 0n,ethereumFormatUnit: 0,ethereumTx: "",ethereumTxFrom: "",
            ethereumTxTo: "",ethereumTxToken: "",formatUnit: 0,
            minterSupply: 0n,minterSupplyFormat: 0,
        }).then(()=>{
            console.log(`create place holder for ${minter} , token ${checker.name}`)
        })
        .catch(err=>{
            console.log(`create fail`, err)
        })
    }
}
export async function importFromScan(checker: EventChecker, cursorKey: string) {
    const recordsInDb = await Bill.findOne({where:{tokenAddr: checker.tokenAddr} , raw: true})
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
async function importFromFile(checker: EventChecker, cursorKey: string) {

}

