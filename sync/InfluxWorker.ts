import 'dotenv/config'
import {FieldType, InfluxDB} from "influx";
import {listSupply} from "../lib/Models";
import {getPrice, getPriceCache, initPrices} from "../lib/Binance";

function connectInflux({host, database, username, password}) {
    const influx = new InfluxDB({
        host,        database, username, password,
        schema: [
            {
                measurement,
                fields: {
                    blockNumber: FieldType.INTEGER,
                    minterSupply: FieldType.STRING,
                    minterAddr: FieldType.STRING,
                    minterName: FieldType.STRING,
                    minterSupplyFormat: FieldType.FLOAT,
                    minterSupplyMarketValue: FieldType.FLOAT,

                    tokenAddr: FieldType.STRING,
                    tokenName: FieldType.STRING,
                    biz: FieldType.STRING,
                },
                tags: [
                    'biz'
                ]
            }
        ]
    })
    return influx;
}

async function query(inf: InfluxDB, t: string, where:string) {
    const sql = `select * from ${t} where ${where}`
    console.log(`sql : ${sql}`)
    const result = await inf.query(sql)
    console.log(` result :`, result)
}

async function setInfluxDB() {
    const config = (process.env.INFLUX || "").replace(/'/g, '"')
    console.log(`influx config`, config)
    console.log(`------init influx done-----`)
    const {host, database, username, password} = JSON.parse(config)
    console.log(`influx db is ${host} ${database} user ${username}`)
    const inf = connectInflux({host, database, username, password})
    return inf;
}

export async function setupInfluxWorker() {
    const inf = await setInfluxDB();
    await initPrices()
    // await test(inf);
    await copyAll(inf)
    setInterval(()=>{
        copyAll(inf)
    }, 1000 * 60); // 1 minute
}
function getPriceM({tokenName}) {
    tokenName = tokenName || ''
    if (tokenName.includes('BTC')) {
        return getPriceCache('BTCUSDT')
    } else if (tokenName.includes('ETH')) {
        return getPriceCache('ETHUSDT')
    } else {
        return 1
    }
}
async function copyAll(inf: InfluxDB) {
    const map = await listSupply()
    const metrics: any[] = []
    for(const token of Object.keys(map)) {
        const minterArr = map[token]
        for (const minter of minterArr) {
            // @ts-ignore
            minter['minterSupplyMarketValue'] = minter.minterSupplyFormat * getPriceM(minter!)
            const bean = {
                measurement, tags: {biz: token},
                fields: minter
            }
            metrics.push(bean)
        }
    }
    await inf.writePoints(metrics)
    console.log(`write influx ${metrics.length}`)
}
const measurement = 'cross_chain_minter';
if (module === require.main) {
    // setupInfluxWorker().then()
    setInfluxDB().then(inf=>{
        query(inf, measurement, '1=1')
    })
}