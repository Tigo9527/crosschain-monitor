"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dingMsg = exports.addToken = exports.sleep = exports.addAddress = void 0;
const Models_1 = require("./Models");
const superagent = require('superagent');
async function addAddress(hex, name = '') {
    let bean = await Models_1.Address.findOne({ where: { hex } });
    if (bean) {
        if (name && name !== bean.name) {
            await Models_1.Address.update({ name }, { where: { id: bean.id } });
            console.log(`address exists, update name to ${name}`);
            return bean;
        }
        console.log(`address exists`);
        return bean;
    }
    const result = await Models_1.Address.create({ hex, name });
    console.log(`create new address ${hex} ${name}`);
    return result;
}
exports.addAddress = addAddress;
async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
exports.sleep = sleep;
async function addToken(hex, name, chainId) {
    const addr = await addAddress(hex, name);
    const pre = await Models_1.Token.findOne({ where: { address: hex } });
    if (pre) {
        console.log(`token exists`);
        return pre;
    }
    const result = await Models_1.Token.create({ id: addr.id, address: hex, name, chainId });
    console.log(`create token ${hex} ${name} on chain ${chainId}`);
    return result;
}
exports.addToken = addToken;
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
async function dingMsg(msg, dingTalkToken) {
    console.log(`pre send msg:${msg}`);
    if (!dingTalkToken) {
        return;
    }
    let url = 'https://oapi.dingtalk.com/robot/send?access_token=' + dingTalkToken;
    return superagent.post(url, {
        "msgtype": "text",
        "text": {
            "content": `${msg}\n[scan]`
        }
    }).then((res) => {
        console.log(`send ding message done, success:`, res.ok);
    })
        .catch((err) => {
        console.log(`send ding message fail: ${msg}`);
    });
}
exports.dingMsg = dingMsg;
