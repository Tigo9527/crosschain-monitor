import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// Interface for CrossReq attributes
export interface ICrossReq {
	id?: number;
	reqId: string;
	chainId: number; // Added chain ID
	type: string;  // same as event name
	proposer?: string | null;  // Present for LOCK, null for MINT
	recipient?: string | null; // Present for MINT, null for LOCK
	erc20: string;
	from?: string | null;
	to?: string | null;
	value?: string | null;
	transactionHash: string;
	blockNumber: number;
	createdAt?: Date;
	updatedAt?: Date;
}

// Attributes that should be optional during creation
interface CrossReqCreationAttributes extends Optional<ICrossReq, 'id' | 'createdAt' | 'updatedAt' | 'from' | 'to' | 'value'> {}

// Sequelize Model definition
export class CrossReq extends Model<ICrossReq, CrossReqCreationAttributes> implements ICrossReq {
	public id!: number;
	public reqId!: string;
	public chainId!: number;
	public type!: string;
	public proposer!: string;
	public recipient!: string;
	public erc20!: string;
	public from!: string | null;
	public to!: string | null;
	public value!: string | null;
	public transactionHash!: string;
	public blockNumber!: number;
	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

// Model initialization function
export function initCrossReqModel(sequelize: Sequelize) {
	CrossReq.init(
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			reqId: {
				type: DataTypes.STRING(66),
				allowNull: false,
			},
			chainId: {
				type: DataTypes.BIGINT,
				allowNull: false,
			},
			type: {
				type: DataTypes.STRING(32),
				allowNull: false,
			},
			recipient: {
				type: DataTypes.STRING(42),
				allowNull: true,
			},
			proposer: {
				type: DataTypes.STRING(42),
				allowNull: true,
			},
			erc20: {
				type: DataTypes.STRING(42),
				allowNull: true,
			},
			from: {
				type: DataTypes.STRING(42),
				allowNull: true,
			},
			to: {
				type: DataTypes.STRING(42),
				allowNull: true,
			},
			value: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			transactionHash: {
				type: DataTypes.STRING(66),
				allowNull: false,
			},
			blockNumber: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
		},
		{
			sequelize,
			modelName: 'CrossReq',
			tableName: 'cross_requests',
			timestamps: true,
			indexes: [
				{
					fields: ['reqId'],
				},
				{
					fields: ['transactionHash'],
					unique: true,
				},
				{
					fields: ['blockNumber'],
				},
			],
		}
	);
}

export interface ReqMonitorQueueAttributes {
	id?: number;
	reqId: string;
	createdAt?: Date;
	updatedAt?: Date;
	lastCheckTime?: Date;
	lastStatusTime?: Date;
	lastAlertTime?: Date;
	ruleAction?: string;
	amount?: number;
}

interface ReqMonitorQueueCreationAttributes extends Optional<ReqMonitorQueueAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class ReqMonitorQueue extends Model<ReqMonitorQueueAttributes, ReqMonitorQueueCreationAttributes> implements ReqMonitorQueueAttributes {
	public id!: number;
	public reqId!: string;
	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
	public lastCheckTime?: Date;
	public lastStatusTime?: Date;
	public lastAlertTime?: Date;
	public ruleAction?: string;
	public amount?: number;
}

export function initReqMonitorQueue(sequelize: Sequelize): void {
	ReqMonitorQueue.init(
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			reqId: {
				type: DataTypes.STRING(66),
				allowNull: false,
				unique: true,
			},
			createdAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			updatedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			lastCheckTime: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			lastStatusTime: { type: DataTypes.DATE, allowNull: true},
			lastAlertTime: { type: DataTypes.DATE, allowNull: true},
			amount: { type: DataTypes.DECIMAL(36,6), allowNull: true, defaultValue: 0 },
			ruleAction: {
				type: DataTypes.STRING(32), allowNull: true, defaultValue: "",
			}
		},
		{
			sequelize,
			modelName: 'ReqMonitorQueue',
			tableName: 'req_monitor_queue',
			timestamps: true,
			indexes: [
				{fields: ['lastCheckTime'],}
			]
		}
	);
}
