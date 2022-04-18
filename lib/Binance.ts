import {ethers} from "ethers";

const base = 'https://api.binance.com'
export async function getPrice(symbol:string) {
    const json = await ethers.utils.fetchJson(`${base}/api/v3/ticker/price?symbol=${symbol}`)
    console.log(json)
}

if (module === require.main) {
    getPrice('BTCUSDT')
}