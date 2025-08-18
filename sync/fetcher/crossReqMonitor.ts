import {parseMesonRequest} from "../MintChecker";
import {CrossReq} from "../../lib/crossReq";
import {ethers} from "ethers";

export async function matchReq(req: string) {
	// 1 give a req id and expected foreign token
	// find by req id
	// find parsed req info
	// check source chain erc20 event: match token address and amount
	const {fromChain, toChain, value} = parseMesonRequest(req);
	const fromChainReq = await CrossReq.findOne({
		where: {chainId: fromChain, reqId: req},
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
