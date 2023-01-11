import {formatUnits} from "ethers/lib/utils";

const superagent = require('superagent')
require('superagent-proxy')(superagent);
export async function fetchNearId(hex:string) {
    const json = await fetchMultiChainTx(hex)
    const {msg, info} = json;
    const arr = info.filter(e=>e.fromChainID === '1030' && e.from === hex);
    const first = arr[0];
    const {bind} = first;
    return bind;
}
export async function fetchMultiChainTx(hex:string) {
    let url = `https://scanapi.multichain.org/v3/account/txns/${hex}?offset=0&limit=50`
    const res = await superagent.get(url);
    return res.body
}
export async function fetchNearTransfer(nearId:string) {
    const url = `https://api.nearblocks.io/v1/account/${nearId}/ft-txns?&order=desc&page=1&per_page=25`
    console.log(`fetch near txns`, url)
    const res = await superagent.get(url);
    console.log(`near transfer count `, res.body.txns.length || res.body.txns || res.body )
    return res.body
}
export function convertNearTransfer2evmTransfer(txns:any[], evmAcc:string) {
    return txns.map(t=>{
        const {transaction_hash:hash, token_old_owner_account_id: fromNear, token_new_owner_account_id: to,
            amount, block_timestamp, outcomes: {status},
            ft: {contract, name:tokenName, symbol, decimals,}} = t;
        // console.log(`from ${from} to ${to}, status ${status}`)
        if (!status || to !== 'mpc-multichain.near') {
            return false;
        }
        const value = BigInt(amount);
        const valueDrip = BigInt(amount);
        const valueUnit = formatUnits(valueDrip, decimals);
        const time = Number(BigInt(block_timestamp) / BigInt(1_000_000_000))
        return {
            hash, fromNear, from: evmAcc, to, contract, value, valueDrip,
            contractAddress: contract,
            tokenDecimal:decimals, decimals, tokenName, valueUnit, timestamp: time, timeStamp: time,
            timeStr: new Date(time * 1000).toISOString(),
        }
    }).filter(Boolean)
}
export async function checkNearTxWith1030memo(hash:string, accountId: string) {
    const [[,memo]] = await fetchNearTxLogs(hash, accountId);
    // console.log(logs2d)
    console.log(`memo`, memo, 'tx', hash)
    return memo.endsWith(' 1030')
}
export async function fetchNearTxLogs(hash:string, accountId: string) {
    const data = {
        "headers": {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,ca;q=0.5,fr;q=0.4",
            "content-type": "application/json",
            "sec-ch-ua": "\"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"108\", \"Microsoft Edge\";v=\"108\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "Referer": "https://nearblocks.io/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": `{"method":"EXPERIMENTAL_tx_status","params":["${hash}", "${accountId}"],"id":123,"jsonrpc":"2.0"}`,
        "method": "POST"
    }
    // fetch("https://archival-rpc.mainnet.near.org/", );
    const res = await superagent.post(`https://archival-rpc.mainnet.near.org/`)
        .proxy(process.env.PROXY)
        .send(data.body)
        .set(data.headers)
    // console.log(res.body)
    const {result: {receipts_outcome}} = res.body;
    const logs2d = receipts_outcome.map(o=>o.outcome.logs).filter(arr=>arr.length)
    return logs2d;
}
async function main() {
    await fetchNearTxLogs('Br3S1oTQ1QkK5GCBhTFvYgswBNz463wnUDyT9NcFGKMy','' +
        '4c6c75e5551d79d27e7865c6af0900350b2e3250c17e0744e17519e820405910')
}
async function main1() {
    let evmAcc = '0x8e9df7202da4e7b49267bf5af464e01722b3330f';
    const ret = await fetchNearId(evmAcc)
    console.log(`it's`, ret)
    const nearTx = await fetchNearTransfer(ret);
    const evmTx = convertNearTransfer2evmTransfer(nearTx.txns, evmAcc)
    console.log(evmTx)
}
if (module === require.main) {
    main().then()
}