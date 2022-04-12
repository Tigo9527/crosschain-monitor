import {EventChecker, ZERO_FULL} from "./MintChecker";
import {ethers} from "ethers";
import {Bill} from "../lib/Models";
import {formatEther} from "ethers/lib/utils";
import {sleep} from "../lib/Tool";

export async function checkDB(checker:EventChecker) {
    const provider = ethers.getDefaultProvider(process.env.E_SPACE_RPC)
    const list = await Bill.findAll({
        where: {tokenAddr: checker.tokenAddr},
        order: [['id','asc']], raw: true
    })
    console.log(`count`, list.length)
    const token = checker.tokenAddr.toLowerCase()
    for(let b of list) {
        const receipt = await provider.getTransactionReceipt(b.tx)
        let mintBurLogs = receipt.logs.filter(log=>log.address.toLowerCase() === token);
        if (mintBurLogs.length !== 1) {
            console.log(`not just one log, tx`, b.tx)
            process.exit(0)
        }
        const mintBurn = mintBurLogs[0]
        const mint = mintBurn.topics[1] === ZERO_FULL
        console.log(`diff`, b.drip ,`tx action ${mint ? 'mint': 'burn'}`);
        if ((mint && b.drip < 0) || (!mint && b.drip > 0)) {
            console.log(`wrong drip`, b, receipt.logs)
            // process.exit(8)
        }
        // break;
    }
    console.log(`done`)
}
export async function replayDB(checker:EventChecker) {
    const list = await Bill.findAll({where: {tokenAddr: checker.tokenAddr}, order: [['id','asc']]})
    console.log(`count`, list.length)
    let sum = 0n
    const mapByMinter = new Map<string, bigint>()
    for(let b of list) {
        let ms = mapByMinter.get(b.minterAddr)
        let biDrip = BigInt(b.drip);
        if (!ms) {
            ms = 0n
        }
        ms += biDrip
        mapByMinter.set(b.minterAddr, ms)

        sum += biDrip
        console.log(`epoch ${b.blockNumber}, minter sup ${b.minterSupply
        }, replayMSup ${ms} sum ${sum} ${formatEther(sum)} diff ${b.drip
        }  ${BigInt(b.minterSupply) == ms ? 'ok' : `minter diff [${BigInt(b.minterSupply) - ms}]`}`)
        if (BigInt(b.minterSupply) != ms) {
            // const [affectedCount] = await Bill.update({minterSupply: ms, minterSupplyFormat: parseFloat(formatEther(ms))}, {where: {id: b.id}})
            // console.log(`fix affectedCount`, affectedCount)
        }
        // break
    }
    await sleep(1_000)
    console.log(mapByMinter)
    console.log(`done, sum ${sum}, ${formatEther(sum)}`)
}