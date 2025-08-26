import {CrossReq, ReqMonitorQueue} from "../lib/crossReq";
import {ReqInfo} from "../lib/crossReqIdParser";
import {matchReqPair} from "../sync/fetcher/crossReqMonitor";

export function regCrossReqApi(app: any) {
	app.get('/req', async (req, res) => {
		const {reqId, skip = 0, limit = 10} = req.query;
		let list;
		let detail;
		let monitorResult;
		let matchPairResult;
		let count = 0;
		if (reqId) {
			list = await CrossReq.findAll({where: {reqId: reqId}, order: [['createdAt', 'ASC']], raw: true});
			detail = await ReqInfo.findOne({where: {reqId: reqId}, raw: true});
			monitorResult = await ReqMonitorQueue.findOne({where: {reqId: reqId}, raw: true});
			matchPairResult = matchReqPair(list)
			count = list.length;
		} else {
			list = await CrossReq.findAll({order: [['createdAt', 'DESC']], raw: true, offset: parseInt(skip), limit: 10});
			count = await CrossReq.count();
		}
		res.send({list: list, detail, monitorResult, matchPairResult, count});
	})
}
