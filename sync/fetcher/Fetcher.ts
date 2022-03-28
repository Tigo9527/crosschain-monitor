import {Contract, ethers} from "ethers";
import {BaseProvider} from "@ethersproject/providers/src.ts/base-provider";
import {Conflux, Contract as CfxContract} from "js-conflux-sdk";

export interface IFetcher {
    fetchTx(hash: string): Promise<any>;
    addContract(erc20: string): void;
    fetchBalance(erc20: string, who: string): Promise<bigint>
    fetchSupply(erc20: string): Promise<bigint>
    init(): Promise<void>;
}
const {abi: erc20abi} = require('../../artifacts/contracts/ERC20.sol/Token20.json')
export class ConfluxFetcher implements IFetcher {
    rpc: string
    cfx: Conflux
    contractMap: Map<string, CfxContract> = new Map<string, CfxContract>();
    constructor(rpc: string) {
        this.rpc = rpc
        this.cfx = new Conflux({url: rpc})
    }
    async init() {
        const st = await this.cfx.getStatus()
        console.log(`conflux fetch, rpc ${this.rpc}, chain id ${st.chainId}`)
    }

    addContract(erc20: string): void {
        const c = this.cfx.Contract({address: erc20, abi: erc20abi})
        this.contractMap.set(erc20, c)
    }

    fetchBalance(erc20: string, who: string): Promise<bigint> {
        return Promise.reject('not implemented')
    }

    fetchTx(hash: string): Promise<any> {
        return this.cfx.getTransactionReceipt(hash)
    }

    fetchSupply(erc20: string): Promise<bigint> {
        let c = this.contractMap.get(erc20);
        if (!c) {
            throw Error(`contract not register ${erc20}`);
        }
        // @ts-ignore
        return c.totalSupply();
    }
}
export class EthereumFetcher implements IFetcher {
    rpc: string
    provider: BaseProvider;
    contractMap: Map<string, Contract> = new Map<string, Contract>();
    abi = [
        // Read-Only Functions
        "function balanceOf(address owner) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",

        // Authenticated Functions
        "function transfer(address to, uint amount) returns (bool)",

        // Events
        "event Transfer(address indexed from, address indexed to, uint amount)"
    ];


    constructor(rpc: string) {
        this.rpc = rpc;
        this.provider = ethers.getDefaultProvider()
    }

    async fetchSupply(erc20: string): Promise<bigint> {
        const c = this.contractMap.get(erc20)
        if (!c) {
            throw new Error(`Contract not register ${erc20}`)
        }
        return c.totalSupply().then((res: { toBigInt: () => bigint; })=>res.toBigInt());
    }

    async init(): Promise<void> {
        const network = await this.provider.getNetwork().catch(err=>{
            console.log(`init fail with url`, this.rpc)
            throw err;
        })
        console.log(`rpc ${this.rpc}, chain id ${network.chainId}`)
    }
    addContract(erc20: string) {
        const c = new ethers.Contract(erc20, this.abi, this.provider);
        this.contractMap.set(erc20, c)
    }
    async fetchTx(hash: string): Promise<any> {
        return this.provider.getTransactionReceipt(hash);
    }

    fetchBalance(erc20: string, who: string): Promise<bigint> {
        const c = this.contractMap.get(erc20)
        if (!c) {
            throw new Error(`Contract not register ${erc20}`)
        }
        return c.balanceOf(who).then((res: { toBigInt: () => bigint; })=>res.toBigInt())
    }
}