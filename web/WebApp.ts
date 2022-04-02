import 'dotenv/config'
import {initDB} from "../lib/DBProvider";
import {Bill} from "../lib/Models";
import {QueryTypes} from "sequelize";

const cors = require('cors');
const express = require('express')
const app = express()
app.use(cors())

import {BaseProvider} from "@ethersproject/providers"
import {ethers} from "ethers";
import {addressMap, EventChecker} from "../sync/MintChecker";
import {formatEther} from "ethers/lib/utils";
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

async function listSupply() {
    const sql = `
 select blockNumber,minterAddr, minterName, minterSupplyFormat, tokenAddr, tokenName, minterSupply 
 from bill main where id in 
 (select max(id) from bill group by tokenAddr, minterAddr) order by tokenAddr, minterAddr;`

    const list: any[] = await Bill.sequelize!.query(sql, {type: QueryTypes.SELECT}).catch(err => {
        console.log(`error query supply`, err)
        return []
    })
    const map = {}
    list.forEach(row => {
        row.minterSupply = BigInt(row.minterSupply).toString()
        const arr = map[row.tokenAddr] || []
        arr.push(row)
        map[row.tokenAddr] = arr
    })
    return map;
}

async function getMinters(addressList:string[]) {
    const map = {}
    for(const token of addressList) {
        const ck = new EventChecker(process.env.E_SPACE_RPC!, token)
        await ck.getMintRoles()
        let totalSupply = await ck.confluxContract.totalSupply();
        const supInfo = {totalSupply: totalSupply.toBigInt().toString(), totalUnit: formatEther(totalSupply)}
        for(const minter of ck.minterSet) {
            const supply = await ck.confluxContract.minterSupply(minter)
            const totalUnit = formatEther(supply.total)
            supInfo[minter] = {total: supply.total.toBigInt().toString(), totalUnit}
        }
        map[token] = supInfo
    }
    return map
}

async function getSupplyInfo() {
    const tokens = await listSupply();
    const onChain = await getMinters([...Object.keys(tokens)])
    return {tokens, onChain, addressMap}
}
app.get('/supply', async (req, res) => {
    res.send(await getSupplyInfo())
})
init_DB().then(() => {
    getSupplyInfo().then(console.log)
    app.listen(3003)
})
