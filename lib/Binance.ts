import {ethers} from "ethers";
import 'dotenv/config'
const superagent = require('superagent')
require('superagent-proxy')(superagent);

const base = 'https://api2.binance.com'
const preset = new Map<string, number>()
preset.set('BTCUSDT', 39040.86000000)
preset.set('ETHUSDT', 2916.41000000)

export function getPriceCache(symbol) {
    return preset.get(symbol)
}
export async function initPrices() {
    await getPrice('BTCUSDT')
    await getPrice('ETHUSDT')
    // await getPrice('DAIUSDT')
    console.log(`prices`, preset)

    setTimeout(()=>initPrices(), 60_000)
}
export async function getPrice(symbol:string) {
    let proxy = process.env.PROXY
    console.log(`proxy ${proxy}`)
    let url = `${base}/api/v3/ticker/price?symbol=${symbol}`;
    const body = await (proxy ? superagent.get(url)
        .proxy(proxy) : superagent.get(url))
        .then((res: any) => res.body)
    console.log(body)
    preset.set(symbol, parseFloat(body.price))
    //
    return body
}

if (module === require.main) {
    // getPrice('BTCUSDT')
    initPrices()
}