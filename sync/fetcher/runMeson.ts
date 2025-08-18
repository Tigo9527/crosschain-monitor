import { ethers } from "ethers";
import {convertReq, CrossEventFetcher, EventFetcherConfig} from "./crossEventFetcher";
import {initDB} from "../../lib/DBProvider";
import {parseMesonRequest} from "../MintChecker";
import {CrossReq} from "../../lib/crossReq";
import {ReqInfo} from "../../lib/crossReqIdParser";
import {matchReq} from "./crossReqMonitor";

function testParseReq() {
	const req = '0x01006889cc8c0102000000012a05f20001180000000000000000000000000000' // from 42161
	parseMesonRequest(req)
	parseMesonRequest('0x0100688b82b70101000000037e11d60000180000000000000000000000000000') // from 1
}

async function convertReqInfo() {
	await setupWithDB();
	const results = await CrossReq.findAll({
		attributes: ['reqId'],
		group: ['reqId'],
		raw: true
	});

	const reqArr = results.map(r => r.reqId);
	const parsedArr = convertReq(reqArr);
	await ReqInfo.bulkCreate(parsedArr, {updateOnDuplicate: ['updatedAt']});
	console.log(`req info arr length ${parsedArr.length}`);
	return ReqInfo.sequelize!.close()
}

async function main() {
	const [,,cmd,arg1, arg2] = process.argv;
	if (cmd === 'testParseReq') {
		testParseReq();
	} else if (cmd === 'convertReqInfo') {
		return convertReqInfo();
	} else if (cmd === 'fetchOnce') {
		return runFetcher(parseInt(arg1), parseInt(arg2))
	} else if (cmd === 'testMatch') {
		return testMatch(arg1);
	} else {
		return runFetcher()
	}
}

async function testMatch(reqId: string) {
	await setupWithDB();
	const req = await matchReq(reqId);
	console.log(`matched req`, req);
	return ReqInfo.sequelize!.close()
}

async function setupWithDB() {
	require('dotenv/config')
	const dbUrl = process.env.DB_URL
	const DING = process.env.DING
	await initDB(dbUrl, false)
}

async function runFetcher(chain = 0, oneBlock = 0) {
	await setupWithDB();
	// Initialize for multiple chains
	const chains: EventFetcherConfig[] = [
		{
			chainId: 1, // Ethereum
			rpcUrl: `${process.env.ETH_RPC}`,
			lockContractAddress: '0xB1119Ab7fA19CC3Ec0fEE22357732fb3768C8f58',
			erc20Address: ethers.constants.AddressZero,
			startBlock: 23039797,
			enable: true,
		}, {
			chainId: 42161,
			rpcUrl: `${process.env.ARBITRUM_ONE_RPC}`,
			lockContractAddress: '0xB1119Ab7fA19CC3Ec0fEE22357732fb3768C8f58',
			erc20Address: ethers.constants.AddressZero,
			startBlock: 363076701,
			enable: true,
		}, {
			chainId: 1030,
			rpcUrl: `${process.env.E_SPACE_RPC}`,
			lockContractAddress: '0x5AEBF33255dCbfdcc0dfABf23347Eb031441Bb4e',
			erc20Address: ethers.constants.AddressZero,
			startBlock: 127648105,
			enable: true,
			batchSize: 1000, pollInterval: 5000,
			hasReorgFeature: true,
		}
	];
	const fetchers = chains.filter(cfg=>!chain || cfg.chainId == chain)
	.map(config => new CrossEventFetcher({
		batchSize: 2000,
		pollInterval: 30000,
		...config,
		oneBlock: oneBlock,
	}));

	// Start all fetchers
	fetchers.forEach(fetcher => fetcher.start());

	// Graceful shutdown
	process.on('SIGINT', () => {
		fetchers.forEach(fetcher => fetcher.stop());
		process.exit();
	});
}

if (module === require.main) {
	main()
}
