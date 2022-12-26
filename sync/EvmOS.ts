import * as fs from "fs";

const superagent = require('superagent')
import { parse } from 'node-html-parser';
import {formatUnits} from "ethers/lib/utils";
// @ts-ignore
export async function fetchEvmOS(who:string, pageNo=1) {
    let init = {
        "headers": {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"108\", \"Google Chrome\";v=\"108\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "Referer": `https://escan.live/address/${who}`,
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "GET"
    }
    // 0xfa561e5da14d2ab344e1042796656ee8914bdc4b
    let url = `https://escan.live/AjaxPartialHandler/ErcTransfersOfAddress?p=${pageNo}&s=25&addr=${who}&erc=20`;
    const ret = await superagent.get(url).set(init.headers);
    const text = ret.text;
    // console.log(`evm os result`, text)
    return text;
}
export async function fetchEvmOSTx(hash) {
    let init = {
        "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"108\", \"Google Chrome\";v=\"108\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1"
        },
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET"
    }
    let url = `https://escan.live/tx/${hash}`;
    const ret = await superagent.get(url).set(init.headers);
    const text = ret.text;
    // console.log(`evm os tx result`, text)
    return text;
}
export function parseList20Text(text:string) {
    const root = parse(text);
    let tbody = root.querySelector('tbody');
    let trArr = tbody?.querySelectorAll('tr')
    return trArr?.map(tr=>{
        let tdArr = tr.querySelectorAll('td');
        let tx = tdArr[0].querySelector('a')?.text
        let ago = tdArr[2].text
        let from = tdArr[3].querySelector('a')?.text.trim()
        let toI = tdArr[5].querySelectorAll('i') || [];
        let to = toI[toI.length-1]?.text;
        let valueDiv = tdArr[6].querySelector('div');
        let decimals = valueDiv?.getAttribute('decimals')
        let contract = valueDiv?.getAttribute('contract')
        let valueDrip = BigInt('0x'+valueDiv?.getAttribute('value'));
        let valueUnit = formatUnits(valueDrip, parseInt(decimals!))
        let tokenName = tdArr[7].querySelector('a')?.text.trim();
        return {hash: tx, from, ago, to, contract, value: valueDrip, valueDrip, contractAddress: contract,
            tokenDecimal:decimals, decimals, tokenName, valueUnit, timestamp: 0, timeStamp: 0};
    }).filter(row=>row.to==='Burn')
    // console.log(.join(' \n '))
}
function parseTxTime(text:string) {
    //(Dec 25, 2022 18:12:31 UTC)
    const regex = /\([A-Z][a-z]+ \d+, \d{4} \d{2}:\d{2}:\d{2} UTC\)/
    let [m] = text.match(regex) || [];
    let dtStr = m.substring(1, m.length-1);
    let date_result = new Date(dtStr);
    // console.log(m, date_result);
    return date_result;
}
async function fillTxTime(list20) {
    for(let row of list20) {
        let tx = await fetchEvmOSTx(row["hash"])
        let date = parseTxTime(tx);
        row['timestamp'] = date
        row['timeStamp'] = Math.floor(date.getTime()/1000)
    }
}
export async function fetchEvmOS20(who, page) {
    const list20text = await fetchEvmOS(who, page)
    let list20 = parseList20Text(list20text);
    await fillTxTime(list20);
    return list20;
}
if (module === require.main) {
    (async function test() {
        let list20 = parseList20Text(fs.readFileSync('./list20.log').toString());
        await fillTxTime(list20);
        let list20str = list20
            ?.map(({hash: tx, ago, timestamp,
                       from, to, contract, valueDrip, decimals, tokenName, valueUnit}) => {
                return tx + ' ' + ago + ' ' + timestamp + ' from ' + from + ' to ' + to + ' ' + contract + ' x ' + valueDrip + ' decimals ' + decimals + ' token: ' + tokenName + ' x ' + valueUnit;
            });
        console.log(list20str)
        // fetchEvmOSTx('0x7f5e4d52adec29f65456486c746a038d4de9e6498e15b70389ab0fb1eb72d3b7').then()
        // parseTxTime(fs.readFileSync('./tx.log').toString());
    })();
}