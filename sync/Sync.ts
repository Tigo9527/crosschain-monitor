import 'dotenv/config'
import {ConfluxFetcher, EthereumFetcher} from "./fetcher/Fetcher";
import {initDB} from "../lib/DBProvider";
import {formatEther} from "ethers/lib/utils";
import {addMinterPlaceHolder, ETHEREUM_USDT_TOKEN, EventChecker, importFromScan, TOKEN_BIND} from "./MintChecker";
import {Bill, EPOCH_PREFIX_KEY, getNumber, updateConfig} from "../lib/Models";
import {dingMsg, sleep} from "../lib/Tool";
import {checkDB, replayDB} from "./Tool";
import {setupInfluxWorker} from "./InfluxWorker";

async function main() {
    const dbUrl = process.env.DB_URL
    const DING = process.env.DING
    await initDB(dbUrl, false)
    //
    if (process.env.DEBUG_BIND_TO_USDT) {
        TOKEN_BIND.set(process.env.DEBUG_BIND_TO_USDT.toLowerCase(), ETHEREUM_USDT_TOKEN)
    }
    // await setupInfluxWorker()
    await check(DING)
}

function setupNotify(dingToken: string, checker: EventChecker) {
    if (dingToken) {
        checker.mintSourceTxNotFound = async (tx, fmtAmount) => {
            const txLink = `https://evm.confluxscan.net/tx/${tx}`
            const msg = `[${checker.name}] Mint without ethereum tx, amount ${fmtAmount}, token ${checker.tokenAddr}, ${txLink}`
            return dingMsg(msg, dingToken).then(() => {
                process.exit(9)
            })
        }
        checker.notify = async (mintOrBurn: string, token: string, amount: string) => {
            const msg = `Found action: ${mintOrBurn} ${token} ${checker.name}, amount ${amount}`
            await dingMsg(msg, dingToken)
        }
    }
}

async function testDing(cmd: string, dingToken: string) {
    if (cmd === 'testDing') {
        await dingMsg(`Test message, just ignore.`, dingToken)
        process.exit(0)
    } else if (cmd === 'testDevDing') {
        await dingMsg(`Test [DEV] message, just ignore.`, process.env.DEV_DING || dingToken)
        process.exit(0)
    }
}

async function check(dingToken = '') {
    // usdt first at 38659021; dai first at 38835560
    let [,,cmd,tokenAddr, startEpoch] = process.argv
    console.log(`command [${cmd}], token [${tokenAddr}], start from [${startEpoch}]`)
    if (!cmd) {
        console.log(`Usage : node ./${__filename} watch tokenAddr [startEpoch]`)
        process.exit(0)
        return;
    }
    let checker: EventChecker;
    try {
        checker = new EventChecker(eSpaceRpc, tokenAddr);
        checker.notifyMint = false
        await checker.init()
    } catch (e) {
        console.log(`error startup`, e)
        process.exit(9)
        return;
    }
    if (cmd === 'testCelerDelayTransfer') {
        TOKEN_BIND.set(checker.tokenAddr.toLowerCase(), ETHEREUM_USDT_TOKEN)
        await checker.checkCelerDelayEvent(parseInt(startEpoch))
        process.exit(0)
    } else if (cmd === 'replayDB') {
        await replayDB(checker)
        process.exit(0)
    } else if (cmd === 'checkDB') {
        await checkDB(checker)
        process.exit(0)
    }
    await testDing(cmd, dingToken);
    checker.dingToken = dingToken || ''
    setupNotify(dingToken, checker);
    await checker.getMintRoles().catch(err=>{
        console.log(`getMintRoles fail`, err)
        process.exit(1)
    })
    let cursorKey = `${EPOCH_PREFIX_KEY}${tokenAddr}`; // it's the next epoch.
    if (cmd === 'importFromScan') {
        await importFromScan(checker, cursorKey)
        await Bill.sequelize?.close
        console.log(`Done.`)
        process.exit()
    } else if (cmd === 'addMinterPlaceHolder') {
        await addMinterPlaceHolder(checker)
        process.exit(0)
    }
    let epoch = await getNumber(cursorKey, parseInt(startEpoch)) //38659021
    let maxEpoch = 0;
    let preErrorEpoch = 0
    async function repeat() {
        try {
            while (epoch >= maxEpoch - 40) {
                await sleep(5_000)
                maxEpoch = await checker.provider.getBlockNumber()
                console.log(`max epoch at ${maxEpoch}`)
            }
            await checker.getEventByEpoch(epoch) //
            epoch++
            await updateConfig(cursorKey, epoch.toString()) // it's the next epoch.
            if (preErrorEpoch == epoch - 1) {
                dingMsg(`[${checker.name}] previous error at epoch [${preErrorEpoch
                }] has been resolved automatically.`, process.env.DEV_DING || dingToken)
                    .catch(undefined)
            }
        } catch (e) {
            console.log(`Process event fail at epoch/block ${epoch}`, e)
            if (dingToken && preErrorEpoch != epoch) {
                await dingMsg(`[${checker.name}] Process fail at ${epoch}. ${e}` ,
                    process.env.DEV_DING || dingToken)
            }
            preErrorEpoch = epoch
            await sleep(5_000);
        }
        setTimeout(repeat, 0)
    }
    repeat().then()
}
async function test() {
    // use dotenv, that is .env file.
    // console.log(process.env)
    // const dbUrl = process.env.DB_URL
    // await initDB(dbUrl)
    // await start()
    // await initConflux()
}
async function fetch() {

}
async function initConflux() {
    const cfxF = new ConfluxFetcher('https://main.confluxrpc.com')
    await cfxF.init();
    let erc20 = 'cfx:acd3fhs4u0yzx7kpzrujhj15yg63st2z6athmtka95';
    cfxF.addContract(erc20) //cDai
    console.log(`core space supply`, await cfxF.fetchSupply(erc20).then(res=>formatEther(res)))
}
async function start() {
    // const ef = new EthereumFetcher('https://mainnet.infura.io/v3/')
    const ef = new EthereumFetcher('')
    await ef.init()
    let erc20 = '0x0615dbba33fe61a31c7ed131bda6655ed76748b1';
    ef.addContract(erc20)
    console.log(`balance`, await ef.fetchBalance(erc20, erc20))
    console.log(`balance`, await ef.fetchBalance(erc20, '0xb8c435301179b9cd2878c8b2d26a5401bd0c7385'))
    console.log(`supply`, await ef.fetchSupply(erc20))
    // const r = await ef.fetchTx('0x8b9b1b78624c5139affe7c88c1c5ac63439ce5ac8075d53492fb81c580962fa3')
    // console.log(`receipt is`, r)
}
let eSpaceRpc = process.env.E_SPACE_RPC || 'https://evm.confluxrpc.com'
if (module === require.main) {
    // command: check or importFromScan or addMinterPlaceHolder
    main().then()
}



// https://github.com/anyswap/CrossChain-Bridge/wiki/Crosschain-events#crosschain-deposit-arrive