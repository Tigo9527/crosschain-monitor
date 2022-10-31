import {formatUnits, parseUnits} from "ethers/lib/utils";

const superagent = require('superagent')
async function list(account: string) {
    let data = {
        "headers": {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Chromium\";v=\"106\", \"Google Chrome\";v=\"106\", \"Not;A=Brand\";v=\"99\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "Referer": "https://scope.klaytn.com/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "GET"
    };
    let url = "https://api-cypress-v2.scope.klaytn.com/v2/accounts/" + account + "/ftTransfers?page=1&token=";
    // fetch(url, data);
    let req = superagent.get(`${url}`);
    // for(let k of Object.keys(data.headers)){}
    req.set(data.headers)
    const {body:res} = await req
   // console.log(`result is `, res)
    return res.result;
}
export async function matchKlaytnScan(account: string, wantDripScale18:bigint, beforeTimeSec:number) {
    if (account.length > 42) {
        account = `0x${account.slice(-40)}`;
    }
    console.log(`---- matchKlaytnScan ----`)
    const result: any[] = await list(account)
    const burnList = result.filter(t=>t.toAddress === '0x0000000000000000000000000000000000000000');
    let similarRows = [] as any[]
    const earlierTimeSec = beforeTimeSec - 3600 * 1 // recent N hours
    const feeDelta = wantDripScale18 * 8n / 100n;  // 百8
    let includeFee = wantDripScale18 + feeDelta;
    console.log(`want [${wantDripScale18} with fee ${includeFee}], time  ${earlierTimeSec} - ${beforeTimeSec}`)
    for(let e of burnList) {
        const scale18 = parseUnits((formatUnits(BigInt(e.amount), e.decimals)), 18).toBigInt();
        const createdAt = e.createdAt;
        console.log(`value ${e.amount} / scale ${scale18}, createdAt ${e.createdAt} / ${createdAt} s`)

        console.log(`scale18>= wantDripScale18`,scale18>= wantDripScale18)
        console.log(`scale18 <= includeFee`, scale18 <= includeFee)
        console.log(`createdAt <= beforeTimeSec`, createdAt <= beforeTimeSec)
        console.log(`createdAt >= earlierTimeSec`, createdAt >= earlierTimeSec)

        if (scale18>= wantDripScale18 && scale18 <= includeFee
            && createdAt <= beforeTimeSec && createdAt >= earlierTimeSec) {
            similarRows.push({token:e.tokenAddress, ...e})
            console.log(`this one is similar`)
        }
    }
    console.log(`similar count`, similarRows.length)
    return similarRows;
}
if (module === require.main) {
    // let account = "0xc4f2381408bd3417f2255f55080b385328b382d3";
    let account = "0x000000000000000000000000c4f2381408bd3417f2255f55080b385328b382d3";
    // console.log(`0x${account.slice(-40)}`)
    matchKlaytnScan(account, 19491367000000000000n, 1665823425)
}