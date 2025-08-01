import 'dotenv/config'
import {ConfluxFetcher, EthereumFetcher} from "./fetcher/Fetcher";
import {initDB} from "../lib/DBProvider";
import {formatEther} from "ethers/lib/utils";
import {addMinterPlaceHolder, ETHEREUM_USDT_TOKEN, EventChecker, importFromScan, TOKEN_BIND} from "./MintChecker";
import {Bill, EPOCH_PREFIX_KEY, getMaxBlockOfToken, getNumber, updateConfig} from "../lib/Models";
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
        let times = 0
        checker.mintSourceTxNotFound = async (tx, fmtAmount) => {
            const txLink = `https://evm.confluxscan.net/tx/${tx}`
            const msg = `[${checker.name}] Mint without ethereum tx, amount ${fmtAmount}, token ${checker.tokenAddr}, ${txLink}`
            if (times < 3) {
                times += 1
                let minutes = 5;
                console.log(msg)
                console.log(`wait at ${times} times, ${minutes}`)
                await sleep(minutes * 60_000)
                throw new Error(msg) // try again
            }
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
    let range = 1
    let isBNB = false
    if (tokenAddr == '0x94bd7a37d2ce24cc597e158facaa8d601083ffec') {
        // bnb catchup
        range = 1000
        isBNB = true;
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
    if (isBNB) {
        // sync history data , but minter has been removed long time ago.
        checker.minterSet.add("0x0dCb0CB0120d355CdE1ce56040be57Add0185BAa")
    }
    let cursorKey = `${EPOCH_PREFIX_KEY}${tokenAddr}`; // it's the next epoch.
    if (cmd === 'importFromScan') {
        await importFromScan(checker, cursorKey)
        await Bill.sequelize?.close()
        console.log(`Done.`)
        process.exit()
    } else if (cmd === 'addMinterPlaceHolder') {
        await addMinterPlaceHolder(checker)
        process.exit(0)
    } else if (cmd === 'fixEpoch') {
        await checker.getEventByEpoch(parseInt(startEpoch), range)
        process.exit(0)
    }
    let epoch = await getNumber(cursorKey, parseInt(startEpoch)) //38659021
    let maxEpochInBill = await getMaxBlockOfToken(tokenAddr)
    if (maxEpochInBill >= epoch) {
        console.log(`use maxEpochInBill `, maxEpochInBill)
        epoch = maxEpochInBill + 1
    } else {
        console.log(`maxEpochInBill `, maxEpochInBill, ` in config `, epoch)
    }
    let maxEpoch = 0;
    let preErrorEpoch = 0

    async function repeat() {
        try {
            let delayEpoch = 80;
            while (epoch >= maxEpoch - delayEpoch) { // re-org may happen.
                await sleep(5_000)
                maxEpoch = await checker.provider.getBlockNumber()
                console.log(`max epoch at ${maxEpoch}`)
            }
            if (range > 1 && epoch + range > maxEpoch - delayEpoch) {
                range = 1
            }
            await checker.getEventByEpoch(epoch, range) //
            epoch+=range
            await updateConfig(cursorKey, epoch.toString()) // it's the next epoch.
            if (preErrorEpoch == epoch - 1) {
                dingMsg(`[${checker.name}] previous error at epoch [${preErrorEpoch
                }] has been resolved automatically.`, process.env.DEV_DING || dingToken)
                    .catch(undefined)
            }
        } catch (e) {
            const {code, reason, method, params} = e as any;
            if ((e as any).error?.code == -32000) {
                console.log(`qps exceeded ${(e as any).error}`)
                await sleep(1_000)
            } else if (code === 'SERVER_ERROR' && reason === 'failed to meet quorum') {
                console.log(`that is server error.`, reason)
                await sleep(2_000)
            } else {
                const eStr = `${e}`;
                let sendDing = true;
                if (eStr.includes('expected a numbers with less than largest epoch number')) {
                    sendDing = false;
                } else if (eStr.includes('Filter has wrong epoch numbers')) {
                    sendDing= false;
                }
                console.log(`Process event fail at epoch/block ${epoch}`, e);
                if (dingToken && preErrorEpoch != epoch && sendDing) {
                    const msg = (code && reason) ? `code ${code} reason ${reason} method ${method} params ${params}` : `${e}`;
                    await dingMsg(`[${checker.name}] Process fail at ${epoch}. ${e}`,
                      process.env.DEV_DING || dingToken)
                    preErrorEpoch = epoch;
                }
                await sleep(5_000);
            }
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
