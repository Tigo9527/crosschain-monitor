import 'dotenv/config'
import {initDB} from "../lib/DBProvider";
import {Bill, Config, EPOCH_PREFIX_KEY, listSupply} from "../lib/Models";
import {QueryTypes, Op} from "sequelize";

const cors = require('cors');
const express = require('express')
const app = express()
app.use(cors())

app.get('/test-error', function (req,res,next) {
    // throw new Error(`test-error`)
    next(new Error(`fire error handler`))
})
import {BaseProvider} from "@ethersproject/providers"
import {ethers} from "ethers";
import {addressMap, E_SPACE_USDT, EventChecker, GHOST_USDT_MINTER_1} from "../sync/MintChecker";
import {formatEther} from "ethers/lib/utils";
import {getPrice} from "../lib/Binance";
let rpc: BaseProvider
async function init_DB() {
    const dbUrl = process.env.DB_URL
    // const DING = process.env.DING
    await initDB(dbUrl, false)
    rpc = ethers.getDefaultProvider(process.env.E_SPACE_RPC)
    console.log(`network `, await rpc.getNetwork())
}

app.get('/', function (req, res) {
    res.send('Hello World')
})
app.get('/price-info', async (req,res, next)=>{
    Promise.all([
        getPrice('BTCUSDT'),
        getPrice('ETHUSDT'),
    ]).then(arr=>res.send({list: arr}))
        .catch(e=>next(e))
})
app.get('/sync-info', async (req,res, next)=>{
    try {
        const list = await Config.findAll({where: {name: {[Op.like]: `${EPOCH_PREFIX_KEY}%`}}})
        const block = await rpc.getBlock(rpc.getBlockNumber())
        res.send({list, block})
    } catch (e) {
        next(e)
    }
})

const checkerCache = new Map<string, EventChecker>()
async function getMinters(tokens: object){
    const map = {}
    for(const token of Object.keys(tokens)) {
        let ck = checkerCache.get(token)
        if (!ck) {
            ck = new EventChecker(process.env.E_SPACE_RPC!, token)
            await ck.init()
            await ck.getMintRoles(false)
            if (ck.tokenAddr.toLowerCase() === E_SPACE_USDT.toLowerCase() && !ck.minterSet.has(GHOST_USDT_MINTER_1)) {
                ck.minterSet.add(GHOST_USDT_MINTER_1)
            }
            checkerCache.set(token, ck)
        }
        let totalSupply = await ck.confluxContract.totalSupply();
        const supInfo = {totalSupply: totalSupply.toBigInt().toString(), totalUnit: formatEther(totalSupply)}
        for(const minter of ck.minterSet) {
            const supply = await ck.confluxContract.minterSupply(minter, {blockTag: tokens[token].blockNumber})
            // const supply = await ck.confluxContract.minterSupply(minter, {blockTag: 1})
            const totalUnit = formatEther(supply.total)
            supInfo[minter] = {total: supply.total.toBigInt().toString(), totalUnit}
        }
        map[token] = supInfo
    }
    return map
}

async function getSupplyInfo() {
    const tokens = await listSupply();
    const onChain = await getMinters(tokens)
    return {tokens, onChain, addressMap}
}
app.get('/supply', async (req, res, next) => {
    console.log(`---- /supply`)
    await getSupplyInfo().then(data=>res.send(data)).catch(next)
})
//================
app.use((err, req, res, next) => {
    console.error(`handle ${req.url}`, err)
    res.send({code: 500, message: `${err}`, stack: err.stack})
})
init_DB().then(() => {
    getSupplyInfo().then(console.log).catch(err=>{
        console.log(`startup check fail`, err)
    })
    const port = parseInt(process.env.WEB_PORT || '3003')
    app.listen(port, ()=>{
        console.log(`listen at ${port}`)
    })
})
