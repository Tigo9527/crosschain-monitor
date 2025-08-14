import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// Interface for ReqInfo attributes
export interface IReqInfo {
	id?: number;
	reqId: string;
	v: number;
	created: number;
	actionId: number;
	tokenIndex: number;
	value: string;
	fromV: string;
	toV: string;
	fromChain: number;
	toChain: number;
	vault: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

// Attributes that should be optional during creation
interface ReqInfoCreationAttributes extends Optional<IReqInfo, 'id' | 'createdAt' | 'updatedAt'> {}

// Sequelize Model definition
export class ReqInfo extends Model<IReqInfo, ReqInfoCreationAttributes> implements IReqInfo {
	public id!: number;
	public reqId!: string;
	public v!: number;
	public created!: number;
	public actionId!: number;
	public tokenIndex!: number;
	public value!: string;
	public fromV!: string;
	public toV!: string;
	public fromChain!: number;
	public toChain!: number;
	public vault!: boolean;
	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

// Model initialization function
export function initReqInfoModel(sequelize: Sequelize): typeof ReqInfo {
	ReqInfo.init(
		{
			reqId: {
				type: DataTypes.STRING(66),
				allowNull: false,
				primaryKey: true,
			},
			v: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			created: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			actionId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			tokenIndex: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			value: {
				type: DataTypes.STRING(128),
				allowNull: false,
			},
			fromV: {
				type: DataTypes.STRING(42),
				allowNull: false,
			},
			toV: {
				type: DataTypes.STRING(42),
				allowNull: false,
			},
			fromChain: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			toChain: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			vault: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
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
		},
		{
			sequelize,
			modelName: 'ReqInfo',
			tableName: 'req_infos',
			timestamps: true,
			indexes: [
				{
					fields: ['reqId'],
					unique: true,
				},
				{
					fields: ['fromChain'],
				},
				{
					fields: ['toChain'],
				},
				{
					fields: ['createdAt'],
				},
			],
		}
	);

	return ReqInfo;
}

// Updated Repository class
export class ReqInfoRepository {
	/**
	 * Create a new ReqInfo record
	 */
	public static async create(reqInfo: IReqInfo): Promise<ReqInfo> {
		return ReqInfo.create(reqInfo);
	}

	/**
	 * Find by reqId
	 */
	public static async findByReqId(reqId: string): Promise<ReqInfo | null> {
		return ReqInfo.findOne({
			where: { reqId },
		});
	}
	// ... other repository methods ...
}
