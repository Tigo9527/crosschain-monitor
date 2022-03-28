"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthereumFetcher = exports.ConfluxFetcher = void 0;
const ethers_1 = require("ethers");
const js_conflux_sdk_1 = require("js-conflux-sdk");
const { abi: erc20abi } = require('../../artifacts/contracts/ERC20.sol/Token20.json');
class ConfluxFetcher {
    constructor(rpc) {
        this.contractMap = new Map();
        this.rpc = rpc;
        this.cfx = new js_conflux_sdk_1.Conflux({ url: rpc });
    }
    async init() {
        const st = await this.cfx.getStatus();
        console.log(`conflux fetch, rpc ${this.rpc}, chain id ${st.chainId}`);
    }
    addContract(erc20) {
        const c = this.cfx.Contract({ address: erc20, abi: erc20abi });
        this.contractMap.set(erc20, c);
    }
    fetchBalance(erc20, who) {
        return Promise.reject('not implemented');
    }
    fetchTx(hash) {
        return this.cfx.getTransactionReceipt(hash);
    }
    fetchSupply(erc20) {
        let c = this.contractMap.get(erc20);
        if (!c) {
            throw Error(`contract not register ${erc20}`);
        }
        // @ts-ignore
        return c.totalSupply();
    }
}
exports.ConfluxFetcher = ConfluxFetcher;
class EthereumFetcher {
    constructor(rpc) {
        this.contractMap = new Map();
        this.abi = [
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
        this.rpc = rpc;
        this.provider = ethers_1.ethers.getDefaultProvider();
    }
    async fetchSupply(erc20) {
        const c = this.contractMap.get(erc20);
        if (!c) {
            throw new Error(`Contract not register ${erc20}`);
        }
        return c.totalSupply().then((res) => res.toBigInt());
    }
    async init() {
        const network = await this.provider.getNetwork().catch(err => {
            console.log(`init fail with url`, this.rpc);
            throw err;
        });
        console.log(`rpc ${this.rpc}, chain id ${network.chainId}`);
    }
    addContract(erc20) {
        const c = new ethers_1.ethers.Contract(erc20, this.abi, this.provider);
        this.contractMap.set(erc20, c);
    }
    async fetchTx(hash) {
        return this.provider.getTransactionReceipt(hash);
    }
    fetchBalance(erc20, who) {
        const c = this.contractMap.get(erc20);
        if (!c) {
            throw new Error(`Contract not register ${erc20}`);
        }
        return c.balanceOf(who).then((res) => res.toBigInt());
    }
}
exports.EthereumFetcher = EthereumFetcher;
