import {Contract, ethers, utils} from "ethers";
import {BaseProvider} from "@ethersproject/providers/src.ts/base-provider";
export class SupplyChecker {
    confluxProvider: BaseProvider;
    tokenAddr: string;
    contract: Contract;
    constructor(evmUrl:string, tokenAddr:string) {
        this.confluxProvider = ethers.getDefaultProvider(evmUrl)
        this.tokenAddr = tokenAddr;

        const abi = [
            'function getRoleMember(bytes32 role,uint256 index) view returns (address)',
            'function name() view returns (string memory)',
            'function minterSupply() view returns (tuple(uint256 cap, uint256 total))',
        ]
        this.contract = new ethers.Contract(this.tokenAddr, abi, this.confluxProvider)
    }
    async init() {
        const st = await this.confluxProvider.getNetwork()
        console.log(`network ${st.chainId}`)
        //
        const name = await this.contract.name();
        console.log(`token name ${name}`)
    }
    async check() {

    }
}
async function main() {
    const [,,cmd,tokenAddr] = process.argv
    // 0xfe97e85d13abd9c1c33384e796f10b73905637ce USDT conflux
    const checker = new SupplyChecker('https://evm.confluxrpc.com', tokenAddr)
    await checker.init()
    await checker.check();
}
if (module === require.main) {
    main().then()
}