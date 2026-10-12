import {formatEther, formatUnits, parseEther, parseUnits} from "ethers/lib/utils";
import {sleep} from "../lib/Tool";
import {ethers, utils} from "ethers";
import {fetchEvmOS, fetchEvmOS20, parseList20Text} from "./EvmOS";
import {checkNearTxWith1030memo, convertNearTransfer2evmTransfer, fetchNearId, fetchNearTransfer} from "./NearChain";
import {celerDepositIds, decodeCelerDeposit, matchesCelerDepositReceipt} from "./CelerDeposit";
import has = Reflect.has;

const superagent = require('superagent')
require('superagent-proxy')(superagent);

export function stripAddr(hex:string) {
    return `0x${hex.substring(hex.length-40)}`
}

async function listAccountTransactions(who: string, host: string, etherToken?: string, earlierTimeSec?: number) {
    let apiKeyStr = "";
    if (!host) {
        let apiKey = process.env.ETHER_SCAN_API_KEY || ""
        host = `https://api.etherscan.io/v2`
        apiKeyStr = `&apikey=${apiKey}&chainid=1`
    }
    const action = etherToken === undefined ? 'txlist' : 'tokentx';
    const tokenFilter = etherToken ? `&contractaddress=${etherToken}` : ''
    const result: any[] = [];
    let previousPage = '';
    for (let page = 1; ; page++) {
        const url = `${host}/api?module=account&action=${action}${tokenFilter}&address=${who}&page=${page}&offset=100&sort=desc${apiKeyStr}`;
        // Do not log URLs: explorer API keys and private RPC URLs contain credentials.
        console.log(`list ${action}, account ${who}, page ${page}`)
        let rows: any[] | undefined;
        for (let attempt = 0; attempt < 5; attempt++) {
            const request = superagent.get(url);
            const body = await (process.env.PROXY ? request.proxy(process.env.PROXY) : request)
                .then((res: any) => res.body);
            if (body?.status === '1' && Array.isArray(body.result)) {
                rows = body.result;
                break;
            }
            if (body?.status === '0' && body?.message === 'No transactions found'
                && ((Array.isArray(body.result) && body.result.length === 0) || body.result === 'No transactions found')) {
                rows = [];
                break;
            }
            if (attempt < 4) await sleep(6_000);
        }
        if (!rows) throw new Error(`fetch ${action} from ether scan api failed`);
        console.log(`list ${action}, ether scan api result length: ${rows.length}`);
        const fingerprint = JSON.stringify(rows);
        if (rows.length && fingerprint === previousPage) {
            throw new Error(`ether scan returned the same ${action} page twice`);
        }
        result.push(...rows);
        if (rows.length < 100 || earlierTimeSec === undefined
            || rows.some(row => Number(row.timeStamp) <= earlierTimeSec)) {
            return {status: '1', result};
        }
        previousPage = fingerprint;
    }
}

export async function listTx(who: string, host: string, earlierTimeSec?: number) {
    return listAccountTransactions(who, host, undefined, earlierTimeSec);
}

export async function listTransfer(who: string, etherToken: string, host: string, earlierTimeSec?: number) {
    return listAccountTransactions(who, host, etherToken, earlierTimeSec);
}

function scaleValue(row:any) {
    const {hash, timeStamp, nonce, from, to, contractAddress, value, tokenName, tokenDecimal} = row
    const scale18 = BigInt(value) * BigInt(Math.pow(10, 18 - tokenDecimal))
    return {timeStamp, from, scale18};
}
async function matchDepositId(etherTxHash:string, expect: string, chainId: number, providerUrl?: string) {
    console.log(`try to matchDepositId, etherTxHash ${etherTxHash}`)
    const provider = ethers.getDefaultProvider(providerUrl);
    const tx = await provider.getTransaction(etherTxHash);
    if (!tx || tx.chainId !== chainId || !decodeCelerDeposit(tx.data)) {
        return false;
    }
    const receipt = await provider.getTransactionReceipt(etherTxHash);
    if (matchesCelerDepositReceipt(tx, receipt, expect)) {
        console.log(`deposit id matches. ether tx ${etherTxHash}`)
        return true
    }
    console.log(`deposit receipt does not match, ether tx ${etherTxHash}, expected ${expect}`)
    return false
}
export async function fetchErc20Transfer(address: string, wantDripScale18: bigint, etherToken:string,
                                         beforeTimeSec: number, refId:string, refChainId: BigInt) {
    address = address.toLowerCase();
    if (!etherToken) {
        console.log(`ether token is invalid, [${etherToken}]`)
        return null;
    }
    let limitHours = 2;
    if (refId === '0x4c925138ccbee83c011aae15417397093428eafde3cde6ad331406ec07935ca7') {
        // Historical delayed deposit, 1030 tx 0xebde7c4c8d51911ba5017168b7624ac693d5414f503c31856160f38340b5ed55.
        limitHours = 5;
    }
    const earlierTimeSec = beforeTimeSec - 3600 * limitHours;
    let host:string = '';
    let providerUrl// = undefined
    let useInfoFromMatchedRecord = false;
    let forceUseSimilar = false;
    let body;
    if (refChainId == BigInt(592)) {
        host = "https://blockscout.com/astar"
        etherToken = ''
        useInfoFromMatchedRecord = true;
        forceUseSimilar = true;
    } else if (refChainId == BigInt(1)) {
        providerUrl = process.env.ETH_RPC;
    } else if (refChainId == BigInt(1284)) {
        host = "https://api-moonbeam.moonscan.io"
        providerUrl = 'https://rpc.api.moonbeam.network'
        etherToken = ''
        useInfoFromMatchedRecord = false;
        forceUseSimilar = true;
    } else if (refChainId == BigInt(7700)) {
        // host = "https://evm.explorer.canto.io"
        host = "https://tuber.build"
        etherToken = '';    useInfoFromMatchedRecord = true;    forceUseSimilar = true;
    } else if (refChainId == BigInt(2002)) {
        host = "https://explorer-mainnet-algorand-rollup.a1.milkomeda.com"
        etherToken = '';    useInfoFromMatchedRecord = true;    forceUseSimilar = true;
    } else if (refChainId == BigInt(42262)) {
        host = "https://explorer.emerald.oasis.dev"
        etherToken = '';    useInfoFromMatchedRecord = true;    forceUseSimilar = true;
    } else if (refChainId == BigInt(2222)) {
        host = "https://explorer.kava.io"
        etherToken = '';    useInfoFromMatchedRecord = true;    forceUseSimilar = true;
    } else if (refChainId == BigInt(2001)) {
        host = "https://explorer-mainnet-cardano-evm.c1.milkomeda.com"
        etherToken = ''
        useInfoFromMatchedRecord = true;
        forceUseSimilar = true;
    } else if (refChainId == BigInt(12340001)) {
        // https://developers.flow.com/flow/faq/developers
        // https://developers.flow.com/http-api
    } else if (refChainId == BigInt(52)) {
        host = "https://api.cronoscan.com"
        etherToken = ''
    } else if (refChainId == BigInt(71402)) {
        host = 'https://gw-mainnet-explorer.nervosdao.community' // /api
        etherToken = ''
        useInfoFromMatchedRecord = false;
        providerUrl = "https://v1.mainnet.godwoken.io/rpc"
        forceUseSimilar = true;
    } else if (refChainId == BigInt(9001)) {
        host = "https://evm.evmos.org"
        providerUrl = 'https://eth.bd.evmos.org:8545'
        etherToken = ''
        useInfoFromMatchedRecord = false;
        forceUseSimilar = true;
        let result = await fetchEvmOS20(address, 1) || [];
        if (result.length > 0 && result[result.length-1].timeStamp > beforeTimeSec) {
            console.log(`try page 2 since earliest time is greater`)
            result = await fetchEvmOS20(address, 2) || [];
        }
        body = {result}
    } else if (refChainId == BigInt(1001313161554)) {
        const nearId = await fetchNearId(address)
        console.log(`near id`, nearId)
        const nearTx = await fetchNearTransfer(nearId);
        const evmTx = convertNearTransfer2evmTransfer(nearTx.txns, address)
        console.log(`candidate count`, evmTx.length)
        body = {result: evmTx};
        useInfoFromMatchedRecord = false;
        forceUseSimilar = true;
    }
    let rawEth = false;
    if (etherToken === 'eth') {
        rawEth = true;
        body = await listTx(address, host, earlierTimeSec);
        useInfoFromMatchedRecord = false;
    } else if (body) {
        // fetched
    } else {
        body = await listTransfer(address, etherToken, host, earlierTimeSec);
    }
    // console.log(`ether scan result:` , body)
    const filtered:any[] = []
    let feeFactor = 15n;
    if (refChainId === BigInt(592)) {
        feeFactor = 5n;
    }
    const feeDelta = wantDripScale18 * feeFactor / 100n;  // 百15
    let includeFee = wantDripScale18 + feeDelta;
    console.log(`time range`, new Date(earlierTimeSec*1000).toISOString(), new Date(beforeTimeSec*1000).toISOString())
    for(let row of body.result) {
        if(process.env.DEBUG_RETRY){
            console.log(`debug retry, skip parse result`)
            break;
        }
        if (!row.value || row.isError === '1' || row.txreceipt_status === '0') {
            // Why don't token transfers have a value field?
            continue
        }
        if (rawEth) {
            row.tokenDecimal = 18;
        }
        const {timeStamp, from, scale18} = scaleValue(row);
        if (useInfoFromMatchedRecord) {
            const decoded = decodeCelerDeposit(row.input);
            if ((decoded && !decoded.args.mintChainId.eq(1030)) || (!decoded && !forceUseSimilar)) {
                continue;
            }
        }
        if (scale18 >= wantDripScale18 && scale18 <= includeFee
            && from.toLowerCase() === address
            && timeStamp < beforeTimeSec && timeStamp > earlierTimeSec) {
            if (row.fromNear) {
                let has1030memo = await checkNearTxWith1030memo(row.hash, row.fromNear);
                if (!has1030memo) {
                    console.log(`near chain , tx without 1030 memo, skip`)
                    continue
                }
            }
            filtered.push(row);
        }
        let debug = false;
        debug && console.log(`\n value ${scale18} ${formatEther(scale18)} >= ${formatEther(wantDripScale18)} ${wantDripScale18
        } ${scale18 >= wantDripScale18
        } \n with fee ${scale18} ${formatEther(scale18)} <= ${formatEther(includeFee)} ${includeFee} ${scale18 < includeFee
        } \n ${from} vs ${address} ${from === address
        } \n ${timeStamp} < ${beforeTimeSec} ${timeStamp < beforeTimeSec
        } \n ${timeStamp} > ${earlierTimeSec} ${timeStamp > earlierTimeSec
        } ${row.timeStr} ${row.hash}`)
    }
    // Explorer token-transfer results can contain several rows for one transaction.
    const candidates = [...new Map(filtered.map(row => [row.hash.toLowerCase(), row])).values()];
    if (candidates.length === 1) {
        let similar = candidates[0];
        const {timeStamp, from, scale18} = scaleValue(similar);
        console.log(`Similar amount candidate ${scale18} vs ${wantDripScale18}, ratio ${
            parseFloat(formatEther(scale18)) / parseFloat(formatEther(wantDripScale18))}`);
        if (similar.fromNear) {
            return similar;
        }
        if (forceUseSimilar){
            console.log(`[ ${refChainId}] take similar as match.`)
            return similar;
        }
    }
    for (let row of candidates) {
        if (useInfoFromMatchedRecord) {
            const {from, input: data, to} = row;
            const ids = celerDepositIds(data, from, Number(refChainId), to);
            if (ids.some(id => id.toLowerCase() === refId.toLowerCase())) {
                console.log(` ${refChainId} chain matchDepositId one by one, hit`)
                return row;
            }
        } else if (!row.fromNear && await matchDepositId(row.hash, refId, Number(refChainId), providerUrl)) {
            console.log(`matchDepositId one by one, hit`)
            return row
        }
    }
    console.log(`fetchErc20Transfer from ether scan, NOT MATCH, account ${address
    }, wantDripScale18 ${wantDripScale18} ${formatEther(wantDripScale18)}`);
    console.log(`${candidates.map((row:any)=>{
        const {hash, timeStamp, nonce, from, to, contractAddress, value, tokenName, tokenDecimal} = row
        const fmtUnit = formatUnits(BigInt(value), parseInt(tokenDecimal))
        return `${new Date(parseInt(timeStamp)*1000).toISOString()} ${from} -> ${to
        } hash ${hash} \n ${contractAddress} [${tokenName}] x ${value} (${fmtUnit})`
    }).join('\n')}\n--- filtered.`);
    console.log(` ether scan api result length ${body.result.length}`)
    return null;
}
async function main() {
    // await calcDepositId('0x68340813ec95ea0c39e69dff7ee330cde44b91785e8f4df83166df8be64d849c'
    // ,'0x27A92BF3245D9144CC8509FA35D43348C3635AED0F1F387F2F6E395D7880E469')
    await main1()
}
async function main1() {
    // https://cn.etherscan.com/tx/0x68340813ec95ea0c39e69dff7ee330cde44b91785e8f4df83166df8be64d849c#eventlog
    // bytes32 depId = keccak256(
    //     // len = 20 + 20 + 32 + 8 + 20 + 8 + 8 = 128
    //     abi.encodePacked(msg.sender, _token, _amount, _mintChainId, _mintAccount, _nonce, uint64(block.chainid))
    // );
    const hex = utils.solidityKeccak256(
        //      0 sender  1 token    2 amount  3 mintChain 4 mintAcc  5 nonce  6 sourceChain
        [ "address", "address","uint256","uint64","address", "uint64", "uint64" ],
               // 0 sender                                      1 token
        [ '0x27ee985d1e446ec71c277c89cd877ec4eeaa236c', '0x6b175474e89094c44da98b954eedeac495271d0f',
            // 2 amount       3 chain id  4 mint acc
            21000000000000000000n, 1030, '0x27ee985d1e446ec71c277c89cd877ec4eeaa236c',
            // 5 nonce, 6 sourceChain
            BigInt('0x17fd07a9e89'),       1
        ])
    console.log(`got       ${hex}`)
    console.log('should be 0x27A92BF3245D9144CC8509FA35D43348C3635AED0F1F387F2F6E395D7880E469')
    await fetchErc20Transfer('0x27ee985d1e446ec71c277c89cd877ec4eeaa236c',
        20999855374966449675n,//
        // parseEther("21").toBigInt(),
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', 1648470450,
        '0x27A92BF3245D9144CC8509FA35D43348C3635AED0F1F387F2F6E395D7880E469', BigInt(1))
}

export async function recoverPubKeyFromTx(tx) {
    const expandedSig = {
        r: tx.r,
        s: tx.s,
        v: tx.v
    }
    const signature = ethers.utils.joinSignature(expandedSig)
    const txData = {
        gasPrice: tx.gasPrice,
        gasLimit: tx.gasLimit,
        value: tx.value,
        nonce: tx.nonce,
        data: tx.data,
        chainId: tx.chainId,
        to: tx.to // you might need to include this if it's a regular tx and not simply a contract deployment
    }
    const rsTx = await ethers.utils.resolveProperties(txData)
    const raw = ethers.utils.serializeTransaction(rsTx) // returns RLP encoded tx
    const msgHash = ethers.utils.keccak256(raw) // as specified by ECDSA
    const msgBytes = ethers.utils.arrayify(msgHash) // create binary hash
    const recoveredPubKey = ethers.utils.recoverPublicKey(msgBytes, signature)
    const recoveredAddress = ethers.utils.recoverAddress(msgBytes, signature)
    return {recoveredPubKey, recoveredAddress};
}
if (module === require.main) {
    require('dotenv/config')
    main().then()
}
