import {formatUnits} from "ethers/lib/utils";

const superagent = require('superagent')
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
export function convertNearTransfer2evmTransfer(txns:any[]) {
    return txns.map(t=>{
        const {transaction_hash:hash, token_old_owner_account_id: from, token_new_owner_account_id: to,
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
            hash, from, to, contract, value, valueDrip,
            contractAddress: contract,
            tokenDecimal:decimals, decimals, tokenName, valueUnit, timestamp: time, timeStamp: time,
            timeStr: new Date(time * 1000).toISOString(),
        }
    }).filter(Boolean)
}
async function main() {
    const ret = await fetchNearId('0x8e9df7202da4e7b49267bf5af464e01722b3330f')
    console.log(`it's`, ret)
    const nearTx = await fetchNearTransfer(ret);
    const evmTx = convertNearTransfer2evmTransfer(nearTx.txns)
    console.log(evmTx)
}
if (module === require.main) {
    main().then()
}