import { ethers } from 'ethers';
import {ICrossReq, CrossReq} from "../../lib/crossReq";
import {Config, getNumber, HANDLED_BLOCK_OF_CHAIN} from "../../lib/Models";

export interface EventFetcherConfig {
	rpcUrl: string;
	lockContractAddress: string;
	erc20Address: string;
	chainId: number;
	batchSize?: number;
	pollInterval?: number;
	maxRetries?: number;
	startBlock?: number;
	enable: boolean;
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

		let currentBlock = startBlock;
		while (this.running) {
			try {
				const latestBlock = await this.getLatestBlockWithRetry();

				if (currentBlock > latestBlock) {
					await this.delay(this.config.pollInterval!);
					continue;
				}

				const endBlock = Math.min(
					currentBlock + this.config.batchSize! - 1,
					latestBlock
				);

				console.log(`[Chain ${this.config.chainId}] Processing blocks ${currentBlock}-${endBlock}`);

				const events = await this.fetchEvents(currentBlock, endBlock);
				await this.saveEvents(events, endBlock);
				if (events.length > 0) {
					console.log(`[Chain ${this.config.chainId}] Saved ${events.length} events`);
				}

				currentBlock = endBlock + 1;
				this.retryCount = 0; // Reset retry counter after successful batch

			} catch (error) {
				console.error(`[Chain ${this.config.chainId}] Error:`, error);
				if (++this.retryCount >= this.config.maxRetries!) {
					console.error(`[Chain ${this.config.chainId}] Max retries reached, stopping`);
					this.stop();
					break;
				}
				await this.delay(this.config.pollInterval! * this.retryCount);
			}
		}
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
		const [lockEvents, mintEvents] = await Promise.all([
			this.contract.queryFilter(
				this.contract.filters.TokenLockProposed(),
				fromBlock,
				toBlock
			),
			this.contract.queryFilter(
				this.contract.filters.TokenMintExecuted(),
				fromBlock,
				toBlock
			)
		]);

		const allEvents = [...lockEvents, ...mintEvents]
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

			return {
				...baseEvent,
				proposer: (event.event === 'TokenLockProposed'
					|| event.event === 'TokenBurnProposed') ? event.args?.proposer : null,
				recipient: (event.event === 'TokenMintExecuted'
					|| event.event === 'TokenMintExecuted') ? event.args?.recipient : null,
				erc20: transfer.erc20,
				from: transfer.from,
				to: transfer.to,
				value: transfer.value
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
			await CrossReq.sequelize!.transaction(async dbTx=>{
				await CrossReq.bulkCreate(events, {transaction: dbTx});
				let posKey = HANDLED_BLOCK_OF_CHAIN+this.config.chainId;
				await Config.update({config: (endBlock).toString()},{where: {name: posKey}, transaction: dbTx})
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
