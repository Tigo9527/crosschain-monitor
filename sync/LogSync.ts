import 'dotenv/config'
import {initDB} from "../lib/DBProvider";
import {ethers, utils} from "ethers";
import {BaseProvider} from "@ethersproject/providers";
import {Sequelize, Model, DataTypes, QueryTypes} from "sequelize";
import {Config, LOG_SYNC_KEY} from "../lib/Models";

export interface ILog {
	id?:number;
	blockNumber:number; blockHash:string; address:string; data:string; topicsStr:string; transactionHash: string;
}
export class ELog extends Model<ILog> implements ILog {
	id?:number
	blockNumber!:number;
	blockHash!:string; address!:string; data!:string; topicsStr!:string; transactionHash!: string;
	static register(seq: Sequelize) {
		ELog.init({
			id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
			blockNumber: {type: DataTypes.BIGINT({}),},
			blockHash: {type: DataTypes.STRING(66), allowNull: false},
			address: {type: DataTypes.STRING(42), allowNull: false},
			data: {type: DataTypes.TEXT, allowNull: false},
			topicsStr: {type: DataTypes.STRING(2048), allowNull: false},
			transactionHash: {type: DataTypes.STRING(66), allowNull: false},
		}, {
			sequelize: seq,
			tableName: 'token',
			indexes: [
				{name: 'idx_block_addr', fields: ['blockNumber', 'address']}
			]
		})
	}
}

class LogSync {
	public provider: BaseProvider;

	constructor(url:string) {
		this.provider = ethers.getDefaultProvider(url)
	}
	async init() {
		let config = await Config.findByPk(LOG_SYNC_KEY)
		if (config == null) {
			const block = await this.provider.getBlockNumber()
			config = await Config.create({
				name: LOG_SYNC_KEY, config: (block - 100).toString()
			})
		}
		console.log(` log sync mark at ${config.config}`)
	}
	async repeat() {
		const block = await this.provider.getBlockNumber()
		let config = await Config.findByPk(LOG_SYNC_KEY)
		const preBlock = BigInt(config?.config!)

		let delay = await this.sync(50540715,50540715)
		setTimeout(()=>this.repeat(), delay)
	}
	async sync(fromBlock: number, toBlock: number) {
		const contracts = ['0xfe97e85d13abd9c1c33384e796f10b73905637ce', //usdt
			'0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b', //wcfx
			'0x22f41abf77905f50df398f21213290597e7414dd', //ppi
			];
		let filter = {
			fromBlock, toBlock,
			// address: contracts,//this.tokenAddr,
			topics: [[
				//utils.id("Transfer(address,address,uint256)"),
				'0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',

				// celer delay execution
				// Mint(bytes32 mintId, address token, address account, uint256 amount, uint64 refChainId, bytes32 refId, address depositor)
				'0x5bc84ecccfced5bb04bfc7f3efcdbe7f5cd21949ef146811b4d1967fe41f777a',
				// DelayedTransferAdded(bytes32 id)
				'0xcbcfffe5102114216a85d3aceb14ad4b81a3935b1b5c468fadf3889eb9c5dce6'
			]]
		};
		const logs = await this.provider.getLogs(filter);
		const beans = logs.map(log=>{
			return {...log, id:0, topicsStr: log.topics.join(",")}
		})
		await ELog.sequelize?.transaction(tx=>{
			return Promise.all([
				ELog.bulkCreate(beans, {transaction: tx}),
				Config.update({config: toBlock.toString()}, {where: {name: LOG_SYNC_KEY}})
			])
		})
		console.log(`logs is ${logs.length}, to block ${toBlock}`)
	}
}

async function main() {
	const dbUrl = process.env.DB_URL
	const DING = process.env.DING
	let eSpaceRpc = process.env.E_SPACE_RPC || 'https://evm.confluxrpc.com'
	await initDB(dbUrl, false)
	const sync = new LogSync(eSpaceRpc)
	await sync.init()
	await sync.repeat()
}

if (module === require.main) {
	main().then()
}