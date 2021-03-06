"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const Fetcher_1 = require("./fetcher/Fetcher");
const DBProvider_1 = require("../lib/DBProvider");
const utils_1 = require("ethers/lib/utils");
const TetherMintChecker_1 = require("./TetherMintChecker");
const Models_1 = require("../lib/Models");
const Tool_1 = require("../lib/Tool");
async function main() {
    const dbUrl = process.env.DB_URL;
    const DING = process.env.DING;
    await (0, DBProvider_1.initDB)(dbUrl, false);
    //
    await check(DING);
}
async function check(dingToken = '') {
    // usdt first at 38659021; dai first at 38835560
    let [, , cmd, tokenAddr, startEpoch] = process.argv;
    console.log(`command [${cmd}], token [${tokenAddr}], start from [${startEpoch}]`);
    if (!cmd) {
        console.log(`Usage : node ./${__filename} watch tokenAddr [startEpoch]`);
        process.exit(0);
        return;
    }
    let checker;
    try {
        checker = new TetherMintChecker_1.EventChecker('https://evm.confluxrpc.com', tokenAddr);
        await checker.init();
    }
    catch (e) {
        console.log(`error startup`, e);
        process.exit(9);
        return;
    }
    if (dingToken) {
        checker.mintSourceTxNotFound = async (tx, ether) => {
            const txLink = `https://evm.confluxscan.net/tx/${tx}`;
            const msg = `Mint without ethereum tx, amount ${ether}, token ${checker.tokenAddr} ${checker.name}, ${txLink}`;
            return (0, Tool_1.dingMsg)(msg, dingToken);
        };
        checker.notify = async (mintOrBurn, token, amount) => {
            const msg = `Found action: ${mintOrBurn} ${token} ${checker.name}, amount ${amount}`;
            await (0, Tool_1.dingMsg)(msg, dingToken);
        };
    }
    await checker.getMintRoles().catch(err => {
        console.log(`getMintRoles fail`, err);
        process.exit(1);
    });
    // await checker.getEventByEpoch() // c bridge U mint
    // await checker.getEventByEpoch(39138515)// multi chain U
    // await checker.getEventByEpoch(39345260) // multi chain dai // 0x74eaE367d018A5F29be559752e4B67d01cc6b151
    let cursorKey = `${Models_1.EPOCH_PREFIX_KEY}${tokenAddr}`; // it's the next epoch.
    let epoch = await (0, Models_1.getNumber)(cursorKey, parseInt(startEpoch)); //38659021
    async function repeat() {
        try {
            await checker.getEventByEpoch(epoch); // burn
            epoch++;
            await (0, Models_1.updateConfig)(cursorKey, epoch.toString()); // it's the next epoch.
        }
        catch (e) {
            console.log(`Process event fail at epoch/block ${epoch}`, e);
            if (dingToken) {
                await (0, Tool_1.dingMsg)(`Process fail at ${epoch}. ${e}`, dingToken);
            }
            await (0, Tool_1.sleep)(5000);
        }
        setTimeout(repeat, 0);
    }
    repeat().then();
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
    const cfxF = new Fetcher_1.ConfluxFetcher('https://main.confluxrpc.com');
    await cfxF.init();
    let erc20 = 'cfx:acd3fhs4u0yzx7kpzrujhj15yg63st2z6athmtka95';
    cfxF.addContract(erc20); //cDai
    console.log(`core space supply`, await cfxF.fetchSupply(erc20).then(res => (0, utils_1.formatEther)(res)));
}
async function start() {
    // const ef = new EthereumFetcher('https://mainnet.infura.io/v3/')
    const ef = new Fetcher_1.EthereumFetcher('');
    await ef.init();
    let erc20 = '0x0615dbba33fe61a31c7ed131bda6655ed76748b1';
    ef.addContract(erc20);
    console.log(`balance`, await ef.fetchBalance(erc20, erc20));
    console.log(`balance`, await ef.fetchBalance(erc20, '0xb8c435301179b9cd2878c8b2d26a5401bd0c7385'));
    console.log(`supply`, await ef.fetchSupply(erc20));
    // const r = await ef.fetchTx('0x8b9b1b78624c5139affe7c88c1c5ac63439ce5ac8075d53492fb81c580962fa3')
    // console.log(`receipt is`, r)
}
if (module === require.main) {
    main().then();
}
