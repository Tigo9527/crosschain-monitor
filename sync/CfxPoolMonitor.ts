import 'dotenv/config'
import {Contract, ethers} from "ethers";
import {BaseProvider} from "@ethersproject/providers"
import {formatEther, parseEther} from "@ethersproject/units";
import {dingMsg} from "../lib/Tool";

enum AlertState {
    Normal, Warning,
}
let messages:string[] = []
class CfxPoolMonitor {
    provider: BaseProvider;
    private contract!: Contract;
    originTokenContract!: Contract;
    private token: string;
    private originToken: string;
    public dingToken = '';
    public linkScan = '';
    public moreFun = async ()=> {return {info: '', value: 0n}}
    name!: string;
    private symbol: string = '';
    alertState: AlertState = AlertState.Normal
    preNotifyHour = -1

    constructor(evmRpcUrl:string, token: string, originToken:string) {
        this.provider = ethers.getDefaultProvider(evmRpcUrl)
        //
        this.token = token
        this.originToken = originToken
    }
    async init() {
        let network = await this.provider.getNetwork()
        console.log(`evm net `, network)

        const abi = [
            'function totalSupply() view returns (uint256)',
            'function balanceOf(address) view returns (uint256)',
            'function name() view returns (string memory)',
            'function symbol() view returns (string memory)',
        ]
        this.contract = new Contract(this.token, abi, this.provider)
        this.originTokenContract = new Contract(this.originToken, abi, this.provider)
        this.name = await this.contract.name()
        this.symbol = await this.contract.symbol()
        console.log(`token ${this.token} name [${this.name}] [${this.symbol}]`, )
        // this.contract = new Contract('0xb12c13e66ade1f72f71834f2fc5082db8c091358', abi, this.provider)
        // this.bscContract = new Contract('0x994Cd2BFdeBA7663fB561948Ae85882AB9E4F20c', abi, this.evmProvider)
    }
    linkToken() {
        return `\n${this.linkScan}${this.token}`
    }

    async checkSupply() {
        let extraValue = 0n;
        const extraInfo = await this.moreFun().then(data=>{
            const {info, value} = data
            extraValue = value
            console.log('extra info ', info)
            return info ? `\n${info}` : ''
        })
        //
        const liquidity = await this.originTokenContract.balanceOf(this.token)
        const liquidityFormat = formatEther(liquidity)
        console.log(`liquidity`, liquidity.toBigInt(), liquidityFormat)
        //
        const sup = await this.contract.totalSupply()
        console.log(`totalSupply [${this.name}][${this.symbol}] ${sup}, ${formatEther(sup)}`)
        let limitUnit = 500_000//_00000;
        let threshold = parseEther(limitUnit.toString()).toBigInt()
        if (sup < threshold || liquidity < threshold || extraValue < threshold) {
            if (this.alertState === AlertState.Normal) {
                this.alertState = AlertState.Warning
                await dingMsg(`WARNING: [${this.name}][${this.symbol
                }] totalSupply ${wrapDrip(sup)} liquidity ${wrapDrip(liquidity)} ${extraInfo
                }  \nThreshold ${limitUnit.toLocaleString()}`,
                    this.dingToken)
            }
        } else if (this.alertState === AlertState.Warning) {
            await dingMsg(`RECOVERY: [${this.name}][${this.symbol}] totalSupply ${wrapDrip(sup)
            } liquidity ${wrapDrip(liquidity)} ${extraInfo} \nThreshold ${threshold
            }}`,
                this.dingToken)
            this.alertState = AlertState.Normal
        }
        const curHour = new Date().getHours()
        if (curHour != this.preNotifyHour) {
            const msg = `INFO: [${this.name}][${this.symbol}] totalSupply ${wrapDrip(sup)
            } liquidity ${wrapDrip(liquidity)} ${extraInfo}`
            messages.push(msg)
            if (messages.length >= 2) {
                const join = messages.join('\n')
                messages = []
                await dingMsg(join, this.dingToken)
            }
            this.preNotifyHour = curHour
        }
        return sup;
    }
    async repeat() {
        try {
            await this.checkSupply()
        } catch (e) {
            console.log(`check fail [${this.name}][${this.symbol}]`, e)
            await dingMsg(`[${this.name}][${this.symbol}] fail: ${e}`, process.env.DEV_DING || '')
        }
        setTimeout(()=>this.repeat(), 60_000)
    }
}
async function rpc() {
    const coder = ethers.utils.defaultAbiCoder
    // const data = '0x252dba420000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000018000000000000000000000000014b2d3bc65e74dae1030eafd8ac30c533c976a9b0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c09135800000000000000000000000000000000000000000000000000000000000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c0913580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000418160ddd00000000000000000000000000000000000000000000000000000000000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c0913580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000003eecaa466e87a46b737aeedfe951bcc8403a4e1e00000000000000000000000000000000000000000000000000000000'
    const data = '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000018000000000000000000000000014b2d3bc65e74dae1030eafd8ac30c533c976a9b0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c09135800000000000000000000000000000000000000000000000000000000000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c0913580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000418160ddd00000000000000000000000000000000000000000000000000000000000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c0913580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000003eecaa466e87a46b737aeedfe951bcc8403a4e1e00000000000000000000000000000000000000000000000000000000'
    const p = coder.decode(['tuple(address, bytes)[]'], data)
    console.log(p)
}
async function rpcEvm() {
    const p = new ethers.providers.JsonRpcProvider('https://evm.confluxrpc.com/')
    const result = await p.send('eth_call', [
        {
            "data": "0x252dba420000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000018000000000000000000000000014b2d3bc65e74dae1030eafd8ac30c533c976a9b0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c09135800000000000000000000000000000000000000000000000000000000000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c0913580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000418160ddd00000000000000000000000000000000000000000000000000000000000000000000000000000000b12c13e66ade1f72f71834f2fc5082db8c0913580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000003eecaa466e87a46b737aeedfe951bcc8403a4e1e00000000000000000000000000000000000000000000000000000000",
            "to": "0xae8e9f3ea6a5b462b0ae29aa1a3f6ac072365d9d"
        },
            "latest"
        ])
    const pure = result.substring(2)
    let idx=0;
    while(idx<pure.length) {
        let v = pure.substring(idx, idx+64);
        console.log(v, BigInt('0x'+v))
        idx+=64
    }
}
async function rpcBsc() {
    const p = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.ninicoin.io/')
    // const p = ethers.getDefaultProvider('https://bsc-dataseed1.ninicoin.io/')
    const result = await p.send('eth_call', [{
        "data": "0x252dba4200000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000180000000000000000000000000045c4324039da91c52c55df5d785385aab073dcf0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000994cd2bfdeba7663fb561948ae85882ab9e4f20c00000000000000000000000000000000000000000000000000000000000000000000000000000000994cd2bfdeba7663fb561948ae85882ab9e4f20c0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000418160ddd00000000000000000000000000000000000000000000000000000000000000000000000000000000994cd2bfdeba7663fb561948ae85882ab9e4f20c0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a082310000000000000000000000003eecaa466e87a46b737aeedfe951bcc8403a4e1e00000000000000000000000000000000000000000000000000000000",
        "to": "0xa9193376d09c7f31283c54e56d013fcf370cd9d9"
    }, 'latest'])
    const pure = result.substring(2)
    let idx=0;
    while(idx<pure.length) {
        let v = pure.substring(idx, idx+64);
        console.log(v, BigInt('0x'+v))
        idx+=64
    }
    // console.log(`result is `, result)
}
async function reportRawCfx(provider: BaseProvider, who) {
    return provider.getBalance(who)
        .then(res=>{
            return {
                info: `CFX Bridge ${wrapAddr(who)} holds ${wrapDrip(res)} cfx`,
                value: res.toBigInt(),
            }
        })
}

async function main() {
    let evmUrl = process.env.E_SPACE_RPC || ''
    const evm = new CfxPoolMonitor(evmUrl, '0xb12c13e66ade1f72f71834f2fc5082db8c091358'
        , '0x14b2D3bC65e74DAE1030EAFd8ac30c533c976A9b')
    evm.dingToken = process.env.DING_CFX || ''
    evm.linkScan = 'https://evm.confluxscan.net/token/'
    let extraCfxHolder = '0xf55460b8bc81ea65d7ae0aea2383ef69c8f2c62e';
    evm.moreFun = ()=>reportRawCfx(evm.provider, extraCfxHolder)
    await evm.init()
    await evm.repeat()

    const bsc = new CfxPoolMonitor('https://bsc-dataseed.binance.org/',
        '0x994Cd2BFdeBA7663fB561948Ae85882AB9E4F20c',
        '0x045c4324039dA91c52C55DF5D785385Aab073DcF')
    bsc.dingToken = process.env.DING_CFX || ''
    bsc.linkScan = 'https://bscscan.com/token/'
    bsc.moreFun = ()=>bsc.originTokenContract.balanceOf(extraCfxHolder)
        .then(res=> {
            return {
                info: `bCFX Bridge ${wrapAddr(extraCfxHolder)} holds ${wrapDrip(res)} bCfx`,
                value: res.toBigInt()
            }
        })
    await bsc.init()
    await bsc.repeat()
}
function wrapAddr(addr) {
    return `${addr?.substring(0, 6)}...${addr?.slice(-4)}`
}
function wrapDrip(v:any) {
    return parseInt(formatEther(v).split(".")[0]).toLocaleString()
}
if (module === require.main) {
    main().then()
    // rpcEvm().then()
}