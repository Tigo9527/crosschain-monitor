import {formatEther, formatUnits, parseUnits} from "ethers/lib/utils";
import {sleep} from "../lib/Tool";

const superagent = require('superagent')
require('superagent-proxy')(superagent);

// https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-erc20-token-transfer-events-by-address
export async function listTransfer(who:string) {
    const apiKey = process.env.ETHER_SCAN_API_KEY || ""
    //    &contractaddress=0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2
    // &startblock=0
    //     &endblock=27025780

    let host = `https://api.etherscan.io`;
    // host = 'https://cn.etherscan.com' // not work
    const url = `${host}/api
   ?module=account
   &action=tokentx
   &address=${who}
   &page=1
   &offset=5
   &sort=desc
   &apikey=${apiKey}`.replace(/[\n ]*/g,'')
    console.log(`url ${url}`)
    let proxy = process.env.PROXY
    let times = 5
    while (times > 0) {
        times --
        const body = await (proxy ? superagent.get(url)
            .proxy(proxy) : superagent.get(url))
            .then((res: any) => res.body)
        // console.log(`result `, body)
        if (body?.status === '1') {
            return body
        }
        console.log(`ether scan return unsatified content`, body)
        await sleep(6_000) // rate limit is 1/5sec
    }
    throw new Error(`fetch from ether scan api fail.`)
}
export async function fetchErc20Transfer(address: string, wantDripScale18: bigint) {
    const body = await listTransfer(address)
    for(let row of body.result) {
        const {hash, timeStamp, nonce, from, to, contractAddress, value, tokenName, tokenDecimal} = row
        const scale18 = BigInt(value) * BigInt(Math.pow(10,18 - tokenDecimal))
        if (scale18 === wantDripScale18) {
            return row;
        }
        console.log(`not match ${scale18} vs ${wantDripScale18}`)
    }
    console.log(`fetchErc20Transfer from ether scan, account ${address
    }, wantDripScale18 ${wantDripScale18} ${formatEther(wantDripScale18)}`)
    console.log(`${body.result.map((row:any)=>{
        const {hash, timeStamp, nonce, from, to, contractAddress, value, tokenName, tokenDecimal} = row
        const fmtUnit = formatUnits(BigInt(value), parseInt(tokenDecimal))
        return `${new Date(parseInt(timeStamp)*1000).toISOString()} ${from} -> ${to} of ${contractAddress} [${tokenName}] x ${value}(${fmtUnit})`
    }).join('\n')}`);
    return null;
}
async function main() {
    await fetchErc20Transfer('0x27ee985d1e446ec71c277c89cd877ec4eeaa236c', 9n)
}
if (module === require.main) {
    require('dotenv/config')
    main().then()
}