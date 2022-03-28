import {Address, Token} from "./Models";

const superagent = require('superagent')

export async function addAddress(hex: string, name: string = ''): Promise<Address> {
    let bean = await Address.findOne({where: {hex}})
    if (bean) {
        if (name && name !== bean.name) {
            await Address.update({name}, {where: {id: bean.id}})
            console.log(`address exists, update name to ${name}`)
            return bean;
        }
        console.log(`address exists`)
        return bean;
    }
    const result = await Address.create({hex, name})
    console.log(`create new address ${hex} ${name}`)
    return result
}

export async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms))
}

export async function addToken(hex: string, name: string, chainId: number) {
    const addr = await addAddress(hex, name)
    const pre = await Token.findOne({where: {address: hex}})
    if (pre) {
        console.log(`token exists`)
        return pre;
    }
    const result = await Token.create({id: addr.id, address: hex, name, chainId})
    console.log(`create token ${hex} ${name} on chain ${chainId}`)
    return result
}

// export async function addTask(name:string,erc20:string, who:string, chainId:number) {
//     const token = await addToken(erc20, '', chainId)
//     const addr = await addAddress(who, '')
//     const pre = await Task.findOne({where: {tokenId: token.id, addrId: addr.id}})
//     if (pre) {
//         console.log(`task exists`)
//         return pre;
//     }
//     const result = await Task.create({id: 0, name, tokenId: token.id, addrId: addr.id, chainId})
//     console.log(`create task ${name}`)
//     return result;
// }


export async function dingMsg(msg: string, dingTalkToken: string) {
    console.log(`pre send msg:${msg}`);
    if (!dingTalkToken) {
        return;
    }
    let url = 'https://oapi.dingtalk.com/robot/send?access_token=' + dingTalkToken;
    return superagent.post(url,
        {
            "msgtype": "text",
            "text": {
                "content": `${msg}\n[scan]`
            }
        }).then( (res:any) => {
            console.log(`send ding message done, success:`, res.ok);
        })
        .catch( (err:Error) => {
            console.log(`send ding message fail: ${msg}`);
        })
}