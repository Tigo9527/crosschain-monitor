import {QueryTypes, DataTypes, Model, Op, Sequelize} from "sequelize";
export interface ITokenTransfer {
    createdAt: Date
    blockIndex: number;
    txIndex: number;
    txLogIndex: number
    epoch: number
    contractId: number
    fromId: number
    toId: number
}

export interface IErc20Transfer extends ITokenTransfer{
    id?: number
    value: string
}

export const T_ERC20_TRANSFER = "erc20transfer_2"

export class Erc20Transfer extends Model<IErc20Transfer> implements IErc20Transfer {
    id?: number
    epoch!: number
    createdAt!: Date
    contractId!: number
    blockIndex!: number
    txIndex!: number
    txLogIndex!: number
    fromId!: number
    toId!: number
    value!: string
    static register(seq: Sequelize) {
        Erc20Transfer.init({
            id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false},
            epoch: {type: DataTypes.BIGINT, allowNull: false},
            createdAt: {type: DataTypes.DATE, allowNull: false},
            blockIndex: {type: DataTypes.SMALLINT, allowNull: false},
            txIndex: {type: DataTypes.INTEGER, allowNull: false},
            txLogIndex: {type: DataTypes.INTEGER, allowNull: false},
            contractId: {type: DataTypes.BIGINT, allowNull: false},
            fromId: {type: DataTypes.BIGINT, allowNull: false},
            toId: {type: DataTypes.BIGINT, allowNull: false},
            value: {type: DataTypes.STRING(78), allowNull: false},
        }, {
            sequelize: seq,
            updatedAt: false,
            tableName: T_ERC20_TRANSFER,
            indexes: [
                {
                    name: 'idx_contractId_epoch',  // used in PruneService.
                    fields: ['contractId','epoch']
                },
                {
                    name: 'idx_epoch',
                    fields: [{name: 'epoch', order: "DESC"}]
                },
            ],
        })
    }
}
//
export interface HexMapAttributes {
    id?: number;
    hex: string
    createdAt?: Date
}

export class Hex40Map extends Model<HexMapAttributes> implements HexMapAttributes {
    public id?: number;
    public hex!: string;
    createdAt?: Date
    static register(sequelize) {
        Hex40Map.init(
            {
                id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
                hex: {type: DataTypes.CHAR(40), allowNull: false,},
                createdAt: {type: DataTypes.DATE, allowNull: true,},
            },
            {
                tableName: 'hex40',
                sequelize: sequelize,
                timestamps: false, // prevent default columns: createdAt, updatedAt
                indexes: [
                    {
                        name: `hex40_index`,
                        fields: [{name: 'hex',}],
                        unique: true
                    }
                    // index `createdAt` will affect performance.
                    // implement stat by other table.
                ]
            }
        )
    }
}