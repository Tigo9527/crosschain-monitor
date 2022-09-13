import {formatEther, formatUnits, parseEther, parseUnits} from "ethers/lib/utils";
import {sleep} from "../lib/Tool";
import {ethers, utils} from "ethers";

const superagent = require('superagent')
require('superagent-proxy')(superagent);

// https://docs.etherscan.io/api-endpoints/accounts#get-a-list-of-erc20-token-transfer-events-by-address
export async function listTransfer(who: string, etherToken: string, host) {
    const apiKey = process.env.ETHER_SCAN_API_KEY || ""
    // &startblock=0
    //     &endblock=27025780

    host = host || `https://api.etherscan.io`;
    const tokenFilter = etherToken ? `&contractaddress=${etherToken}` : ''
    // host = 'https://cn.etherscan.com' // not work
    const url = `${host}/api
   ?module=account
   &action=tokentx
   ${tokenFilter}
   &address=${who}
   &page=1
   &offset=100
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
        console.log(`ether scan api result length:`, body?.result?.length)
        if (body?.status === '1') {
            return body
        }
        console.log(`ether scan return unsatisfied content`, body)
        await sleep(6_000) // rate limit is 1/5sec
    }
    throw new Error(`fetch from ether scan api fail.`)
}

function scaleValue(row:any) {
    const {hash, timeStamp, nonce, from, to, contractAddress, value, tokenName, tokenDecimal} = row
    const scale18 = BigInt(value) * BigInt(Math.pow(10, 18 - tokenDecimal))
    return {timeStamp, from, scale18};
}
async function matchDepositId(etherTxHash:string, expect: string, providerUrl = undefined) {
    console.log(`try to matchDepositId, etherTxHash ${etherTxHash}`)
    let txInfo = await ethers.getDefaultProvider(providerUrl).getTransaction(etherTxHash).catch(err => {
        console.log(`ethers getTransaction fail`, err)
        throw err
    });
    const {hash, data, from, chainId} = txInfo
    return matchDepositId0(hash, data, from, chainId, etherTxHash, expect);
}

function decodeTxData(data: string) {
    const MethodID = '0x23463624'
    const headlessData = data.substring(MethodID.length)
    const token = '0x' + headlessData.substring(64 * 0 + 24, 64 * 1)
    const amount = BigInt('0x' + headlessData.substring(64 * 1, 64 * 2))
    const mintChainId = BigInt('0x' + headlessData.substring(64 * 2, 64 * 3))
    const mintAccount = '0x' + headlessData.substring(64 * 3 + 24, 64 * 4)
    const nonce = BigInt('0x' + headlessData.substring(64 * 4, 64 * 5))
    return {token, amount, mintChainId, mintAccount, nonce};
}

async function matchDepositId0(hash: string, data:string, from:string, chainId:number, etherTxHash:string, expect:string) {
    // console.log(`raw tx`, data || txInfo)
    // Function: deposit(address _token, uint256 _amount, uint64 _mintChainId, address _mintAccount, uint64 _nonce)
    const {token, amount, mintChainId, mintAccount, nonce} = decodeTxData(data);
    const hex = utils.solidityKeccak256(
        //      0 sender  1 token    2 amount  3 mintChain 4 mintAcc  5 nonce  6 sourceChain
        [ "address", "address","uint256","uint64",    "address",  "uint64", "uint64" ],
        [from,       token,     amount,  mintChainId, mintAccount, nonce, chainId]
    )
    if (hex.toLowerCase() === expect.toLowerCase()) {
        console.log(`deposit id matches. ether tx ${etherTxHash}`)
        return true
    }
    console.log(`not match, from ${from}, token ${token}, amount ${amount}, mint chain ${mintChainId
    }, mintAccount ${mintAccount} nonce ${nonce}, source chain ${chainId}`)
    console.log(`actual ${hex} vs ${expect} expect`)
    return false
}
export async function fetchErc20Transfer(address: string, wantDripScale18: bigint, etherToken:string,
                                         beforeTimeSec: number, refId:string, refChainId: BigInt) {
    if (!etherToken) {
        console.log(`ether token is invalid, [${etherToken}]`)
        return null;
    }
    let host:string = '';
    let providerUrl// = undefined
    let useInfoFromMatchedRecord = false;
    let forceUseSimilar = false;
    if (refChainId == BigInt(592)) {
        host = "https://blockscout.com/astar"
        etherToken = ''
        useInfoFromMatchedRecord = true;
        forceUseSimilar = true;
    } else if (refChainId == BigInt(1284)) {
        host = "https://api-moonbeam.moonscan.io"
        providerUrl = 'https://rpc.api.moonbeam.network'
        etherToken = ''
        useInfoFromMatchedRecord = false;
        forceUseSimilar = true;
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
    } else if (refChainId == BigInt(9001)) {
        host = "https://evm.evmos.org"
        etherToken = ''
        useInfoFromMatchedRecord = true;
        forceUseSimilar = true;
    }
    const body = await listTransfer(address, etherToken, host);
    // console.log(`ether scan result:` , body)
    const filtered:any[] = []
    const earlierTimeSec = beforeTimeSec - 3600 * 2 // recent 2 hours
    const feeDelta = wantDripScale18 * 8n / 100n;  // 百8
    let includeFee = wantDripScale18 + feeDelta;
    for(let row of body.result) {
        if(process.env.DEBUG_RETRY){
            console.log(`debug retry, skip parse result`)
            break;
        }
        if (!row.value) {
            // Why don't token transfers have a value field?
            continue
        }
        const {timeStamp, from, scale18} = scaleValue(row);
        if (useInfoFromMatchedRecord) {
            const {hash, from, input: data,} = row;
            try {
                const {token, amount, mintChainId, mintAccount, nonce} = decodeTxData(data);
                if (mintChainId.toString() != '1030') {
                    continue
                }
            } catch (e) {
            }
        }
        if (scale18 >= wantDripScale18 && scale18 <= includeFee
            && from === address
            && timeStamp < beforeTimeSec && timeStamp > earlierTimeSec) {
            filtered.push(row)
            if (scale18 === wantDripScale18) {
                console.log(`Match Exact ${scale18} vs ${wantDripScale18}`)
                if (await matchDepositId(row.hash, refId) ) {
                    return row;
                }
            }
        }
        // console.log(`not match ${scale18} vs ${wantDripScale18
        // } ${scale18 >= wantDripScale18
        // } \n ${scale18} <= ${includeFee} ${scale18 < includeFee
        // } \n ${from} vs ${address} ${from === address
        // } \n ${timeStamp} < ${beforeTimeSec} ${timeStamp < beforeTimeSec
        // } \n ${timeStamp} > ${earlierTimeSec} ${timeStamp > earlierTimeSec
        // }`)
    }
    if (filtered.length === 1) {
        let similar = filtered[0];
        const {timeStamp, from, scale18} = scaleValue(similar);
        console.log(`Match Similar ${scale18} vs ${wantDripScale18}, ratio ${
            parseFloat(formatEther(scale18)) / parseFloat(formatEther(wantDripScale18))}`)
        if (useInfoFromMatchedRecord) {
            const {hash, from, input: data,} = similar;
            if (await matchDepositId0(hash, data, from, Number(refChainId), hash, refId)) {
                console.log(` ${refChainId} matchDepositId one by one, hit case 1`)
                return similar;
            }if (forceUseSimilar){
                console.log(`[ ${refChainId}] take similar as match.`)
                return similar;
            }
        } else
        if (await matchDepositId(similar.hash, refId, providerUrl) ) {
            return similar
        } else if (forceUseSimilar) {
            console.log(`[ ${refChainId}] take similar as match, case 2.`)
            return similar;
        }
    }
    for (let row of filtered) {
        if (useInfoFromMatchedRecord) {
            const {hash, from, input: data,} = row;
            if (await matchDepositId0(hash, data, from, Number(refChainId), hash, refId)) {
                console.log(` ${refChainId} chain matchDepositId one by one, hit`)
                return row;
            }
        } else
        if (await matchDepositId(row.hash, refId, providerUrl) ) {
            console.log(`matchDepositId one by one, hit`)
            return row
        }
    }
    console.log(`fetchErc20Transfer from ether scan, NOT MATCH, account ${address
    }, wantDripScale18 ${wantDripScale18} ${formatEther(wantDripScale18)}`);
    console.log(`[ ${filtered.filter((row:any)=>row.from === address).map((row:any)=>{
        const {hash, timeStamp, nonce, from, to, contractAddress, value, tokenName, tokenDecimal} = row
        const fmtUnit = formatUnits(BigInt(value), parseInt(tokenDecimal))
        return `${new Date(parseInt(timeStamp)*1000).toISOString()} ${from} -> ${to
        } \n ${contractAddress} [${tokenName}] x ${value} (${fmtUnit})`
    }).join('\n')} ]--- filtered.`);
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
if (module === require.main) {
    require('dotenv/config')
    main().then()
}