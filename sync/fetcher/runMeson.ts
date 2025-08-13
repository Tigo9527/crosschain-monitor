import { ethers } from "ethers";
import {CrossEventFetcher, EventFetcherConfig} from "./crossEventFetcher";
import {initDB} from "../../lib/DBProvider";

async function main() {
	require('dotenv/config')
	const dbUrl = process.env.DB_URL
	const DING = process.env.DING
	await initDB(dbUrl, false)
	// Initialize for multiple chains
	const chains: EventFetcherConfig[] = [
		{
			chainId: 1, // Ethereum
			rpcUrl: `${process.env.ETH_RPC}`,
			lockContractAddress: '0xB1119Ab7fA19CC3Ec0fEE22357732fb3768C8f58',
			erc20Address: ethers.constants.AddressZero,
			startBlock: 23039797,
			enable: false,
		}, {
			chainId: 42161,
			rpcUrl: `${process.env.ARBITRUM_ONE_RPC}`,
			lockContractAddress: '0xB1119Ab7fA19CC3Ec0fEE22357732fb3768C8f58',
			erc20Address: ethers.constants.AddressZero,
			startBlock: 363076701,
			enable: false,
		}, {
			chainId: 1030,
			rpcUrl: `${process.env.E_SPACE_RPC}`,
			lockContractAddress: '0x5AEBF33255dCbfdcc0dfABf23347Eb031441Bb4e',
			erc20Address: ethers.constants.AddressZero,
			startBlock: 127648105,
			enable: true,
		}
	];
	const fetchers = chains.map(config => new CrossEventFetcher({
		...config,
		batchSize: 2000,
		pollInterval: 30000
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
