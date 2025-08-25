import {parseMesonRequest} from "../MintChecker";
import {CrossReq, initReqMonitorQueue, ReqMonitorQueue} from "../../lib/crossReq";
import {ethers} from "ethers";
import {IReqInfo} from "../../lib/crossReqIdParser";
import {dingMsg} from "../../lib/Tool";
import {Op} from "sequelize";

export async function matchReq(req: string) {
	// 1 give a req id and expected foreign token
	// find by req id
	// find parsed req info
	// check source chain erc20 event: match token address and amount
	const {fromChain, toChain, value} = parseMesonRequest(req);
	const fromChainReq = await CrossReq.findOne({
		where: {chainId: fromChain, reqId: req, value: {[Op.ne]: '0'}},
		logging: console.log,
		raw: true,
	})
	if (!fromChainReq) {
		console.log(`req on fromChain ${fromChain} not found, ${req}`);
		return null;
	}
	// match amount
	const wantValueFloat = parseFloat(value);
	if (!fromChainReq!.value) {
		console.log(`req on fromChain ${fromChain} without value, ${req}`);
		return null;
	}
	let fromAmountFloat = 0
	let decimals = 6;
	if (fromChain === 1030) {
		decimals = 8;
	}
	const fromAmountStr = ethers.utils.formatUnits(fromChainReq.value, decimals);
	fromAmountFloat = parseFloat(fromAmountStr);

	if (fromAmountFloat < wantValueFloat) {
		console.log(`amount on source chain [${fromChain}] ${fromAmountStr} < ${value} , source tx ${fromChainReq.transactionHash}`);
		return null;
	}

	return fromChainReq;
}

function buildRuleTable() {
	/*
	const mintUnlockArr = [
		'TokenUnlockProposed', 'TokenMintProposed',
		'TokenUnlockExecuted', 'TokenMintExecuted',
	]
	const lockBurnArr = [
		'TokenLockProposed', 'TokenBurnProposed',
		'TokenBurnExecuted', 'TokenBurnExecuted',
	]
	 */
	return {
		// source --> target
		'None':     {"None": "OK",      "Proposed": "WARNING-B", "Executed": "ALERT"},
		'Proposed': {"None": "OK",      "Proposed": "OK",      "Executed": "ALERT"},
		'Executed': {"None": "WARNING-A", "Proposed": "OK",      "Executed": "OK"},
	}
}

export async function repeatCheckCrossReq(dingToken?: string) {
	try {
		await checkReqQueue(dingToken);
	} catch (e) {
		console.error("failed to check", e);
	}
	setTimeout(()=>repeatCheckCrossReq(dingToken), 5000);
}

export async function checkReqQueue(dingToken?: string) {
	const req = await ReqMonitorQueue.findOne({
		raw: true,
		// where: {reqId: "0x0100689b7e63020200000000000186a001180000000000000000000000000000"}, // debug
		order: [['lastCheckTime', 'asc']]
	});
	if (!req) {
		console.log(`${new Date().toISOString()} no request in queue`);
		return null;
	}
	console.log(`\n\n checking cross-chain request ${req.id} at ${new Date().toISOString()}`);


	const arr = await CrossReq.findAll({where: {reqId: req.reqId}, raw: true, order: [['id', 'asc']]});

	let txInfo = arr.map(row=>{
		return `chain ${row.chainId} ${row.type} in tx\n${row.transactionHash}`;
	}).join('\n');

	const {fromChain, toChain, value} = parseMesonRequest(req.reqId, false);
	txInfo = `from ${fromChain} to ${toChain}  value ${value}\nreqId ${req.reqId}\n` + txInfo ;

	const {errorMessage, ruleAction, pairedStep} = matchReqPair(arr)
	const minute = 60_000;
	const alertTimeAllow = req.lastAlertTime == null ? true : (Date.now() - req.lastAlertTime!.getTime() ) > (60 * minute);

	if (errorMessage) {
		await alertWithTimeCheck(alertTimeAllow, `failed to check cross-chain request, \n
		${errorMessage} \n${txInfo}`, dingToken)
	} else if (pairedStep === 'Executed_Executed') {
		await ReqMonitorQueue.destroy({where: {reqId: req.reqId}});
		console.log(`remove finished req ${req.reqId}`);
	} else if (ruleAction.startsWith('WARNING')) {
		await alertWithTimeCheck(alertTimeAllow, `${ruleAction}: cross-chain request is under wrong status ${pairedStep
			} \n${txInfo}`, dingToken)
	} else if (ruleAction === 'ALERT') {
		await alertWithTimeCheck(alertTimeAllow, `ALERT!!: cross-chain request is under wrong status ${pairedStep
			} \n${txInfo}`, dingToken);
	} else {
		console.log(`result is ok, ${ruleAction} ${pairedStep}`);
	}

	// update this field, delay it for the next checking
	const props = {"lastCheckTime": new Date(), amount: Number(value)};
	if (req.ruleAction != ruleAction) {
		props["lastStatusTime"] = new Date();
		props["ruleAction"] = ruleAction;
	}
	if (alertTimeAllow) {
		props["lastAlertTime"] = new Date();
	}
	await ReqMonitorQueue.update(props, {where: {reqId: req.reqId}});
	return req;
}

async function alertWithTimeCheck(timeAllow: boolean, msg: string, token?: string) {
	if (!timeAllow) {
		console.log(`time not allow, message: \n${msg}`)
		return
	}
	return dingMsg(msg, token!)
}

function matchReqPair(reqWithSameReqId: CrossReq[]) {
	const parsedArr = reqWithSameReqId.map(req=>parseReq(req));
	const errArr: string[] = [];
	parsedArr.forEach(row=>{
		if (row.errorMessage) {
			errArr.push(row.errorMessage)
		}
	})
	if (errArr.length > 0) {
		return {errorMessage: errArr.join('\n')}
	}

	let source =  parsedArr.find(row=>row.side === "source")
		|| {step: "None", action: "Unknown"};
	let target =
		// find Executed first
		parsedArr.find(row=>row.side === "target" && row.step === "Executed")
		// or Proposed
		|| parsedArr.find(row=>row.side === "target" && row.step === "Proposed")
		// fallback
		|| {step: "None", action: "Unknown"};

	// match rule table
	const ruleTable = buildRuleTable();
	const ruleRow = ruleTable[source.step]
	if (!ruleRow) {
		return {errorMessage: `rue row not found: ${source.step}`};
	}
	const ruleAction = ruleRow[target.step]
	if (!ruleAction) {
		return {errorMessage: `rue action not found: ${target.step} , at row ${source.step}`};
	}

	return {errorMessage: '', ruleAction: ruleAction, pairedStep: `${source.step}_${target.step}`};
}

export function parseReq(req: CrossReq) {
	const {type} = req;
	const {fromChain, toChain} = parseMesonRequest(req.reqId, false);
	const errorArr: string[] = []
	let step = "UnknownStep"
	if (type.endsWith("Proposed")) {
		step = "Proposed"
	} else if (type.endsWith("Executed")) {
		step = "Executed"
	} else {
		let msg = `unknown type ${type} , can not determine step`;
		errorArr.push(msg)
		console.log(msg);
	}

	let action = "";
	const actions = ["Lock", "Burn", "Mint", "Unlock"];
	actions.forEach(act => {
		if (type.includes(act)) {
			action = act;
		}
	})
	// console.log(`match event ${type} to action ${action}`)

	let side = "Unknown";
		if (action === "Unlock" || action === "Mint") {
			side = "target"
			// let message = `invalid action, ${action} should not happened on source chain`;
			// errorArr.push(message)
			// console.log(message)
		} else if (action === "Lock" || action === "Burn") {
			side = "source"
			// let message = `invalid action, ${action} should not happened on target chain`;
			// errorArr.push(message)
			// console.log(message)
		} else {
			let message = `invalid req, on chain ${req.chainId} , not match { from: ${fromChain} , to: ${toChain}  } `;
			errorArr.push(message);
			console.log(message);
		}

	return {req, step, action, side, errorMessage: errorArr.join("\n")};
}
