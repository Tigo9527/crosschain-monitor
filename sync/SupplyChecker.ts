import {Contract, ethers, utils} from "ethers";
import {BaseProvider} from "@ethersproject/providers"
import {formatEther, parseEther} from "ethers/lib/utils";
export class SupplyChecker {
    confluxProvider: BaseProvider;
    tokenAddr: string;
    contract: Contract;
    name: string = '';
    warningUnit: number = 0;
    delayAfterWarning = 10 * 60_000;
    constructor(evmUrl:string, tokenAddr:string) {
        this.confluxProvider = ethers.getDefaultProvider(evmUrl)
        this.tokenAddr = tokenAddr;

        const abi = [
            'function getRoleMemberCount(bytes32 role) view returns (uint256)',
            'function getRoleMember(bytes32 role,uint256 index) view returns (address)',
            'function totalSupply() view returns (uint256)',
            'function name() view returns (string memory)',
            'function minterSupply(address who) view returns (tuple(uint256 cap, uint256 total))',
        ]
        this.contract = new ethers.Contract(this.tokenAddr, abi, this.confluxProvider)
    }
    async init() {
        const st = await this.confluxProvider.getNetwork()
        console.log(`network ${st.chainId}`)
        //
        const name = await this.contract.name();
        console.log(`token name [${name}]`)
        this.name = name;
    }
    async check(dingToken:string) {
        console.log(`-- ${new Date().toISOString()}`)
        let delay = 60_000
        try {
            await this.checkUnsafe(dingToken)
        } catch (e) {
            console.log(`error check supply:`, e)
            delay = 5_000
        }
        setTimeout(()=>this.check(dingToken), delay) // check every minute
    }
    async checkUnsafe(dingToken:string) {
        const minterRole = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
        const roleCount = await this.contract.getRoleMemberCount(minterRole)
        console.log(`minter role count ${roleCount}`)
        // fetch all minters
        const minters:any[] = []
        for(let i=0; i<roleCount; i++) {
            const minter = await this.contract.getRoleMember(minterRole, i)
            minters.push(minter)
            console.log(`minter ${i} ${minter}`)
            // const info = await this.contract.minterSupply()
            try {
                const copyC = this.contract.attach(minter)
                const cName = await copyC.name();
                addressMap[minter] = cName;
            } catch (e) {
                //
            }
        }
        const totalSupply = await this.contract.totalSupply()
        console.log(`total supply [${this.name}] is ${totalSupply} or ${formatEther(totalSupply)}`)
        // checker supply
        const supplyList:any[] = []
        for(let i=0; i<roleCount; i++) {
            const minter = minters[i]
            const supply = await this.contract.minterSupply(minter)
            const capUnit = formatEther(supply.cap)
            const totalUnit = formatEther(supply.total)
            console.log(`minter ${minter} supplies ${totalUnit}`)
            supplyList.push({minter, totalUnit, total:supply.total})
        }
        //
        await this.checkBalance(supplyList, totalSupply , dingToken)
    }
    patchBurn(supplyList: any[]) {
        let adjust = {}
        if (this.tokenAddr === '0xfe97e85d13abd9c1c33384e796f10b73905637ce') { // usdt
            adjust = {
                '0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C':
                    formatEther(
                        BigInt('998573651002596900000000')
                        // evm tx 0x02a1fd66aa6d2336706a2800f6ad8135eabd0235d2350737d6185c6e9b5656d5
                        + BigInt('-231650999999900419900')
                    ),//'1001745.347',
                '0x4F9e3186513224cf152016ccd86019E7B9A3c809':
                    formatEther(BigInt('6008797932493513000000')),//'6008.797932493512580100',
            };
        } else if (this.tokenAddr === '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372'){ // usd coin
            adjust = {
                '0xB44a9B6905aF7c801311e8F4E76932ee959c663C': formatEther(35376150000000000000000n)
            }
        }
        for (let sup of supplyList) {
            //@ts-ignore
            const diff = adjust[sup.minter]
            if (!diff) {
                continue
            }
            console.log(`patch burn, minter ${sup.minter}, diff ${diff}`)
            sup.total = sup.total.sub(parseEther(diff));
            sup.totalUnit = formatEther(sup.total)
        }
    }
    async checkBalance(supplyList: any[], totalSupply: any, dingToken:string) {
        this.patchBurn(supplyList)
        let warning = false;
        for (let sup of supplyList) {
            console.log(`final supply, minter ${sup.minter} ${addressName(sup.minter)},  ${sup.total} or ${sup.totalUnit}`)
            if (parseFloat(sup.totalUnit) < this.warningUnit && sup.total > 0) {
                warning = true;
            }
        }
        const sum = supplyList.map(e=>e.total).reduce((a,b)=>a.add(b))
        const diff = sum.sub(totalSupply)
        let fmtDiff = formatEther(diff);
        console.log(`sum of supply ${sum} or ${formatEther(sum)
        } - actual ${totalSupply} ${formatEther(totalSupply)} = ${diff} or ${fmtDiff}`)
        if (parseFloat(fmtDiff) > 1) {
            warning = true;
        }
        if (warning && dingToken) {
            const msg = `Warning of [${this.name}], threshold ${this.warningUnit
            }\n${supplyList.map(s=>`${s.minter} ${addressName(s.minter)} : ${s.totalUnit}`).join('\n')
            }${diff > 0n ? `\nTotal Supply Diff ${fmtDiff}` : ''}`
            console.log(``, msg)
            await dingMsg(msg, dingToken)
            await sleep(this.delayAfterWarning)
        }
    }
}

import 'dotenv/config'
import {dingMsg, sleep} from "../lib/Tool";
import {addressMap, addressName} from "./MintChecker";
async function main() {
    const dingToken = process.env.DING || ''
    const [,,cmd,tokenAddr, warningV] = process.argv
    const warningUnit = parseFloat(warningV || '0')
    // 0xfe97e85d13abd9c1c33384e796f10b73905637ce USDT conflux
    const checker = new SupplyChecker('https://evm.confluxrpc.com', tokenAddr)
    checker.delayAfterWarning = 10 * 60_000; // wait for 10 minutes after warning
    await checker.init()
    checker.warningUnit = warningUnit
    await checker.check(dingToken);
}
if (module === require.main) {
    main().then()
}