import {parseUnits} from "ethers/lib/utils";

const superagent = require('superagent')
async function fetchFlowScanTx(hash:string, accessKey:string) {
    let data = {
        "headers": {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "content-type": "application/json",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Chromium\";v=\"104\", \" Not A;Brand\";v=\"99\", \"Google Chrome\";v=\"104\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "Referer": "https://flowscan.org/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": "{\"operationName\":\"TransactionEventsSectionQuery\",\"variables\":{\"id\":\""+hash+"\",\"first\":20},\"query\":\"query TransactionEventsSectionQuery($id: ID!, $eventTypeFilter: ID, $first: Int, $after: ID) {\\n  checkTransaction(id: $id) {\\n    transaction {\\n      eventTypes {\\n        id\\n        __typename\\n      }\\n      eventCount\\n      events(first: $first, typeId: $eventTypeFilter, after: $after) {\\n        edges {\\n          node {\\n            index\\n            type {\\n              id\\n              __typename\\n            }\\n            fields\\n            __typename\\n          }\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\"}",
        "method": "POST"
    };
    // fetch("https://query.flowgraph.co/?token=5a477c43abe4ded25f1e8cc778a34911134e0590", data);
    const body = JSON.parse(data.body)
    // console.log(`body`, JSON.stringify(body, undefined, 4))
    // console.log(body.query)
    const res = await superagent.post(`https://query.flowgraph.co/?token=${accessKey}`)
        .send(body)
        .set("Referer", "https://flowscan.org/")
    const {data: {checkTransaction: {transaction: {eventCount, events: {edges}}}}} = res.body
    const eArr = edges as any[]
    const matchArr = [] as any[]
    eArr.forEach(e=>{
        const {node: {type: {id}, fields}} = e
        if (id === 'A.08dd120226ec2213.PegBridge.Burn' && fields[4].value === '1030') {
            let item = {id, to: fields[5].value, value: fields[3].value, hash};
            matchArr.push(item)
            console.log(`   flow events: ${id} to ${item.to} x ${item.value}`)
        }
    })
    return matchArr;
}
async function fetchFlowScan(addr: string, accessKey:string) {
    let id = addr.slice( - "d82cfcb7009dcb73".length  )
    console.log(`use account id ${id}`)
    let data = {
        "headers": {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "content-type": "application/json",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Chromium\";v=\"104\", \" Not A;Brand\";v=\"99\", \"Google Chrome\";v=\"104\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "Referer": "https://flowscan.org/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": "{\"operationName\":\"AccountTransfersQuery\",\"variables\":{\"address\":\"0x"+id+"\",\"first\":30},\"query\":\"query AccountTransfersQuery($address: ID!, $first: Int!, $after: ID) {\\n  account(id: $address) {\\n    address\\n    transferCount\\n    tokenTransferCount\\n    nftTransferCount\\n    transferTransactions(first: $first, after: $after) {\\n      pageInfo {\\n        hasNextPage\\n        endCursor\\n        __typename\\n      }\\n      edges {\\n        ...AccountTransfersTableFragment\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\\nfragment AccountTransfersTableFragment on AccountTransferEdge {\\n  transaction {\\n    hash\\n    time\\n    __typename\\n  }\\n  tokenTransfers {\\n    edges {\\n      node {\\n        type\\n        amount {\\n          token {\\n            id\\n            __typename\\n          }\\n          value\\n          __typename\\n        }\\n        counterparty {\\n          address\\n          __typename\\n        }\\n        counterpartiesCount\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n  nftTransfers {\\n    edges {\\n      node {\\n        from {\\n          address\\n          __typename\\n        }\\n        to {\\n          address\\n          __typename\\n        }\\n        nft {\\n          contract {\\n            id\\n            __typename\\n          }\\n          nftId\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n  __typename\\n}\\n\"}",
        "method": "POST"
    };
    const body = JSON.parse(data.body)
    // console.log(`body`, JSON.stringify(body, undefined, 4))
    // console.log(body.query)
    const res = await superagent.post(`https://query.flowgraph.co/?token=${accessKey}`)
        .send(body)
        .set("Referer", "https://flowscan.org/")
    const {data: {account: {transferTransactions:{edges}}}} = res.body
    const arr = edges as any[]
    const transferList = [] as any[]
    for (const e1 of arr.filter(e => e.tokenTransfers)) {
        const {tokenTransfers: {edges: txArr}, transaction:{hash, time}} = e1;
        for (const t of (txArr as any[])) {
            const {node:{type,counterpartiesCount,__typename,amount:{token:{id}, value}}} = t;
            if (id === 'A.231cc0dbbcffc4b7.ceWBTC' && type === 'Withdraw' && counterpartiesCount === 0) {
                let transfer = {hash, time, id, value, events: [] as any[], token: id};
                transferList.push(transfer)
                console.log(`flow scan : ${hash} ${time} ${id} x ${value} ${type}`)
                transfer.events = await fetchFlowScanTx(hash, accessKey)
            }
        }
    }
    return transferList;
    // console.log(`res flow scan`, edges)
    // fetch("https://query.flowgraph.co/?token=5a477c43abe4ded25f1e8cc778a34911134e0590", data);
}
export async function matchFlowScan(addr:string, accessKey:string, wantDripScale18:bigint, beforeTimeSec:number) {
    const earlierTimeSec = beforeTimeSec - 3600 * 1 // recent N hours
    const feeDelta = wantDripScale18 * 8n / 100n;  // 百8
    let includeFee = wantDripScale18 + feeDelta;
    const transferList = await fetchFlowScan(addr, accessKey)
    const similarRows = [] as any[]
    console.log(`want [${wantDripScale18} ${includeFee}], time  ${earlierTimeSec} - ${beforeTimeSec}`)
    for (let transfer of transferList) {
        for (const e of transfer.events) {
            const scale8 = parseUnits(e.value).mul(1_0000_0000).toBigInt();
            const timeStamp = Math.floor(new Date(transfer.time).getTime() / 1000)
            console.log(`value ${e.value} / ${scale8}, time ${transfer.time} / ${timeStamp} s`)
            if (scale8>= wantDripScale18 && scale8 <= includeFee
                && timeStamp < beforeTimeSec && timeStamp > earlierTimeSec) {
                similarRows.push({token:transfer.token, ...e})
            }
        }
    }
    if (similarRows.length == 1) {
        return similarRows[0]
    }
    console.log(`similar row[s] != 1`, similarRows)
    return []
}
if (module === require.main) {
    fetchFlowScan("0x000000000000000000000000d82cfcb7009dcb73", "5a477c43abe4ded25f1e8cc778a34911134e0590").then()
    // fetchFlowScanTx("2bdb2526f7b3802842d182600ef0eb82d79a10d56ff2d1447c456782815555ca").then()
}