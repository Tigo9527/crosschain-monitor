import { ethers } from 'ethers';
import {ICrossReq, CrossReq} from "../../lib/crossReq";
import {Config, getNumber, HANDLED_BLOCK_OF_CHAIN} from "../../lib/Models";
import {parseMesonRequest} from "../MintChecker";
import {IReqInfo, ReqInfo} from "../../lib/crossReqIdParser";

export interface EventFetcherConfig {
	rpcUrl: string;
	lockContractAddress: string;
	erc20Address: string;
	chainId: number;
	batchSize?: number;
	pollInterval?: number;
	maxRetries?: number;
	startBlock?: number;
	oneBlock?: number;
	enable: boolean;
	hasReorgFeature?: boolean;
}

export class CrossEventFetcher {
	private provider: ethers.providers.JsonRpcProvider;
	private contract: ethers.Contract;
	private erc20Contract: ethers.Contract;
	private running = false;
	private retryCount = 0;

	constructor(private config: EventFetcherConfig) {
		this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
		this.config.batchSize = config.batchSize || 100;
		this.config.pollInterval = config.pollInterval || 15000;
		this.config.maxRetries = config.maxRetries || 5;

		this.contract = new ethers.Contract(
			config.lockContractAddress,
			[
				'event TokenLockProposed(bytes32 indexed reqId, address indexed proposer)',
				'event TokenBurnProposed(bytes32 indexed reqId, address indexed proposer)',
				'event TokenUnlockExecuted (bytes32 indexed reqId, address indexed recipient)',
				'event TokenMintExecuted(bytes32 indexed reqId, address indexed recipient)'
			],
			this.provider
		);

		this.erc20Contract = new ethers.Contract(
			config.erc20Address,
			[
				'event Transfer(address indexed from, address indexed to, uint256 value)'
			],
			this.provider
		);
	}

	public async start() {
		const network = await this.provider.getNetwork();
		console.log(`network: ${network.chainId} ${network.name}`);
		if (!this.config.enable) {
			console.log(`not enable, stop`)
			return;
		}

		let startBlock = this.config.startBlock || 0;
		// prefer DB savepoint
		const dbPos = await getNumber(HANDLED_BLOCK_OF_CHAIN + this.config.chainId, 0);
		if (dbPos > startBlock) {
			startBlock = dbPos + 1
		}

		this.running = true;
		console.log(`Starting fetcher for chain ${this.config.chainId} from block ${startBlock}`);

		let latestBlock = await this.getLatestBlockWithRetry();
		let currentBlock = startBlock;
		let round = 0
		while (this.running) {
			round ++;
			try {

				if (currentBlock > latestBlock) {
					await this.delay(this.config.pollInterval!);
					latestBlock = await this.getLatestBlockWithRetry();
					continue;
				}

				const endBlock = this.config.oneBlock ? currentBlock : Math.min(
					currentBlock + this.config.batchSize! - 1,
					latestBlock
				);

				if (round % 100 === 1){
					console.log(`[Chain ${(this.config.chainId).toString().padStart(6," ")
						}] Processing blocks ${currentBlock}-${endBlock} , gap to latest: ${latestBlock - currentBlock}`);
				}

				const events = await this.fetchEvents(currentBlock, endBlock);
				await this.saveEvents(events, endBlock);
				if (events.length > 0) {
					console.log(`[Chain ${this.config.chainId}] Saved ${events.length} events`);
				}

				if (this.config.hasReorgFeature && latestBlock - endBlock < 100) {
					// console.log(`[Chain ${(this.config.chainId).toString().padStart(6," ")
					// 	}] near latest , gap ${latestBlock - currentBlock}`)
					// console.log(` latest ${latestBlock} , current ${currentBlock}`);

					await this.delay(this.config.pollInterval!);

					latestBlock = await this.getLatestBlockWithRetry();
					currentBlock = Math.min(latestBlock - 100, endBlock + 1);

					// console.log(`end ${endBlock} , cur set to ${currentBlock
					// 	} , latest ${latestBlock}`);
				} else {
					currentBlock = endBlock + 1;
				}
				this.retryCount = 0; // Reset retry counter after successful batch
				if (this.config.oneBlock) {
					this.running = false;
					break;
				}
			} catch (error: any) {
				let msg = ''
				if (error["body"]) {
					try {
						const json = JSON.parse(error["body"]);
						if (json.message) {
							msg = json.message;
						}
					} catch (e) {}
				}
				console.error(`[Chain ${this.config.chainId}] Error:`, msg || error);
				if (++this.retryCount >= this.config.maxRetries!) {
					console.error(`[Chain ${this.config.chainId}] Max retries reached, stopping`);
					// this.stop();
					// TODO send alert
					// break;
				}
				await this.delay(this.config.pollInterval! * this.retryCount);
			}
		}
		console.log(`finished`)
	}

	public stop() {
		this.running = false;
	}

	private async getLatestBlockWithRetry(): Promise<number> {
		for (let i = 0; i < 3; i++) {
			try {
				return await this.provider.getBlockNumber();
			} catch (error) {
				if (i === 2) throw error;
				await this.delay(1000 * (i + 1));
			}
		}
		throw new Error('Failed to get latest block');
	}

	private async fetchEvents(fromBlock: number, toBlock: number): Promise<ICrossReq[]> {
		// Get all events from the contract in single query
		const eventsRaw = await this.contract.queryFilter(
			{
				address: this.contract.address,
			},
			fromBlock,
			toBlock
		);

		// Filter for only the events we care about (defined in contract ABI)
		const filteredEvents = eventsRaw.filter(event =>
			event.event === 'TokenLockProposed' ||
			event.event === 'TokenBurnProposed' ||
			event.event === 'TokenUnlockExecuted' ||
			event.event === 'TokenMintExecuted'
		);

		const allEvents = filteredEvents
		.sort((a, b) => a.blockNumber - b.blockNumber);

		const processedEvents: ICrossReq[] = [];
		const processPromises: Promise<any>[] = [];

		for (const event of allEvents) {
			const baseEvent = {
				chainId: this.config.chainId,
				reqId: event.args?.reqId,
				transactionHash: event.transactionHash,
				blockNumber: event.blockNumber,
				type: event.event!,
			};

			const processPromise = this.processEvent(event, baseEvent)
			.then(processed => processed && processedEvents.push(processed));
			processPromises.push(processPromise);
		}

		await Promise.all(processPromises);
		return processedEvents;
	}

	private async processEvent(
		event: ethers.Event,
		baseEvent: Pick<ICrossReq, 'chainId' | 'reqId' | 'transactionHash' | 'blockNumber' | 'type'>
	): Promise<ICrossReq | null> {
		try {
			const transfer = await this.getTransferEvent(event.transactionHash);
			if (!transfer) {
				console.warn(`[Chain ${this.config.chainId}] No transfer found for tx ${event.transactionHash}`);
				return null;
			}

			const block = await event.getBlock()
			if (!block) {
				console.log(`block not found ? ${event.blockHash}`)
			}

			return {
				...baseEvent,
				proposer: (event.event === 'TokenLockProposed'
					|| event.event === 'TokenBurnProposed') ? event.args?.proposer : null,
				recipient: (event.event === 'TokenMintExecuted'
					|| event.event === 'TokenUnlockExecuted') ? event.args?.recipient : null,
				erc20: transfer.erc20,
				from: transfer.from,
				to: transfer.to,
				value: transfer.value,
				createdAt: block ? new Date(block.timestamp * 1000) : undefined,
			};
		} catch (error) {
			console.error(`[Chain ${this.config.chainId}] Error processing event:`, error);
			return null;
		}
	}

	private async getTransferEvent(txHash: string) {
		const receipt = await this.provider.getTransactionReceipt(txHash);
		if (!receipt) return null;

		const transferLog = receipt.logs.find(log =>
			// do not filter ERC20 address
			// log.address.toLowerCase() === this.config.erc20Address.toLowerCase() &&
			this.erc20Contract.interface.getEventTopic('Transfer') === log.topics[0]
		);

		if (!transferLog) return null;

		const parsedLog = this.erc20Contract.interface.parseLog(transferLog);
		return {
			erc20: transferLog.address,
			from: parsedLog.args.from,
			to: parsedLog.args.to,
			value: parsedLog.args.value.toString()
		};
	}

	private async saveEvents(events: ICrossReq[], endBlock: number) {
		try {
			const parsedReqArr = convertReq(events.map(e=>e.reqId));
			await CrossReq.sequelize!.transaction(async dbTx=>{
				await CrossReq.bulkCreate(events, {transaction: dbTx,
					updateOnDuplicate: this.config.hasReorgFeature ? ['updatedAt'] : undefined}
				);

				await ReqInfo.bulkCreate(parsedReqArr, {transaction: dbTx, updateOnDuplicate: ['updatedAt']});

				if (!this.config.oneBlock) {
					let posKey = HANDLED_BLOCK_OF_CHAIN + this.config.chainId;
					await Config.update({config: (endBlock).toString()}, {where: {name: posKey}, transaction: dbTx})
				}
			})
		} catch (error) {
			console.error(`[Chain ${this.config.chainId}] Error saving events:`, error);
			throw error;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

export function convertReq(reqArr: string[]) {
	return reqArr.map((r) => {
		const parsed = parseMesonRequest(r)
		return {
			...parsed,
			reqId: parsed.id,
			id: 0
		} as IReqInfo
	});
}
