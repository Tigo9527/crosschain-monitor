import 'dotenv/config'
import {Contract, ethers} from "ethers";
import {BaseProvider} from "@ethersproject/providers"
import {formatEther, parseEther} from "@ethersproject/units";
import {dingMsg} from "../lib/Tool";

enum AlertState {
    Normal, Warning,
}
class CfxPoolMonitor {
    private provider: BaseProvider;
    private contract!: Contract;
    private token: string;
    public dingToken = '';
    public linkScan = '';
    name!: string;
    private symbol: string = '';
    alertState: AlertState = AlertState.Normal
    preNotifyHour = -1

    constructor(evmRpcUrl:string, token: string) {
        this.provider = ethers.getDefaultProvider(evmRpcUrl)
        //
        this.token = token
    }
    async init() {
        let network = await this.provider.getNetwork()
        console.log(`evm net `, network)

        const abi = [
            'function totalSupply() view returns (uint256)',
            'function name() view returns (string memory)',
            'function symbol() view returns (string memory)',
        ]
        this.contract = new Contract(this.token, abi, this.provider)
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
        const sup = await this.contract.totalSupply()
        console.log(`totalSupply [${this.name}][${this.symbol}] ${sup}, ${formatEther(sup)}`)
        let threshold = (500_000).toString();
        if (sup < parseEther(threshold).toBigInt()) {
            if (this.alertState === AlertState.Normal) {
                this.alertState = AlertState.Warning
                await dingMsg(`WARNING: [${this.name}][${this.symbol}] totalSupply ${formatEther(sup)} < ${threshold
                } ${this.linkToken()}`,
                    this.dingToken)
            }
        } else if (this.alertState === AlertState.Warning) {
            await dingMsg(`RECOVERY: [${this.name}][${this.symbol}] totalSupply ${formatEther(sup)} >= ${threshold
            } ${this.linkToken()}`,
                this.dingToken)
            this.alertState = AlertState.Normal
        }
        const curHour = new Date().getHours()
        if (curHour != this.preNotifyHour) {
            await dingMsg(`INFO: [${this.name}][${this.symbol}] totalSupply ${formatEther(sup)
            } ${this.linkToken()}`, this.dingToken)
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

async function main() {
    let evmUrl = process.env.E_SPACE_RPC || ''
    const evm = new CfxPoolMonitor(evmUrl, '0xb12c13e66ade1f72f71834f2fc5082db8c091358')
    evm.dingToken = process.env.DING_CFX || ''
    evm.linkScan = 'https://evm.confluxscan.net/token/'
    await evm.init()
    await evm.repeat()

    const bsc = new CfxPoolMonitor('https://bsc-dataseed.binance.org/',
        '0x994Cd2BFdeBA7663fB561948Ae85882AB9E4F20c')
    bsc.dingToken = process.env.DING_CFX || ''
    bsc.linkScan = 'https://bscscan.com/token/'
    await bsc.init()
    await bsc.repeat()
}
if (module === require.main) {
    main().then()
}