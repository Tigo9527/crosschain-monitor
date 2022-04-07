import {Sequelize, Model, DataTypes} from "sequelize";

export interface IToken {
    id?: number
    name: string
    chainId: number
    address: string
}
export class Token extends Model<IToken> implements IToken{
    id!: number // it's address id
    name!: string
    chainId!: number;
    address!: string;
    static register(seq: Sequelize) {
        Token.init({
            id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
            name: {type: DataTypes.STRING(128), allowNull: false},
            chainId: {type: DataTypes.INTEGER, allowNull: false},
            address: {type: DataTypes.STRING(64), allowNull: false},
        }, {
            sequelize: seq,
            tableName: 'token',
            indexes: [
                {name: 'idx_name', fields: ['name']}
            ]
        });
    }
}

export interface IBalance {
    id: number;
    tokenId: number;
    balance: bigint
}
export class Balance extends Model<IBalance> implements IBalance {
    id!: number;
    tokenId!: number;
    balance!: bigint;
    createdAt!: Date;
    updatedAt!: Date;
    static register(seq: Sequelize) {
        Balance.init({
            id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
            tokenId: {type: DataTypes.INTEGER, allowNull: false},
            balance: {type: DataTypes.DECIMAL(65/*max*/, 0), allowNull: false},
        }, {
            sequelize: seq, tableName: 'balance',
        })
    }
}
// save address with name
export interface IAddress {
    id?: number;
    hex: string
    name: string
}
export class Address extends Model<IAddress> implements IAddress {
    id?: number;
    hex!: string;
    name!: string;
    static register(seq: Sequelize) {
        Address.init({
            id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
            hex: {type: DataTypes.STRING(42), allowNull: false, unique: true},
            name: {type: DataTypes.STRING(64), allowNull: false, defaultValue: ''},
        }, {
            sequelize: seq, tableName: 'address',
        })
    }
}
//
export interface IBalanceTask {
    id: number;
    name: string;
    // fetch address's balance of [token id] on [chain id].
    tokenId: number
    addrId: number
    chainId: number
}
export class BalanceTask extends Model<IBalanceTask> implements IBalanceTask {
    id!: number;
    name!: string;
    tokenId!: number;
    addrId!: number;
    chainId!: number;
    static register(seq: Sequelize) {
        BalanceTask.init({
            id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
            name: {type: DataTypes.STRING(128), allowNull: false},
            tokenId: {type: DataTypes.INTEGER, allowNull: false},
            addrId: {type: DataTypes.INTEGER, allowNull: false},
            chainId: {type: DataTypes.INTEGER, allowNull: false},
        }, {
            sequelize: seq, tableName: 'balance_task',
        })
    }
}
export const EPOCH_PREFIX_KEY = 'epoch_'
export interface IConfig {
    name: string
    config: string
}
export class Config extends Model<IConfig> implements IConfig {
    name!: string
    config!: string
    static register(seq:Sequelize) {
        Config.init({
            name: {type: DataTypes.STRING(128), primaryKey: true},
            config: {type: DataTypes.JSON(), },
        },{
            sequelize: seq, tableName: 'config',
        })
    }
}
export async function getNumber(name: string, defaultV: number, save = true ) {
    const bean = await Config.findByPk(name)
    if (bean) {
        return parseInt(bean.config)
    }
    if (save) {
        await Config.create({name, config: defaultV.toString()})
    }
    return defaultV;
}
export async function updateConfig(name: string, conf: string) {
    return Config.update({config: conf},{where: {name}})
}
export interface IDelayedMint {
    id?:number
    blockNumber: number
    mintId: string; refId:string;
    minter: string; minterName:string;
    tx: string; token:string; receiver: string; amount: bigint
    amountFormat: number
}
export class DelayedMint extends Model<IDelayedMint> implements IDelayedMint {
    id?:number
    blockNumber!: number
    mintId!: string; refId!:string;
    minter!: string; minterName!:string;
    tx!: string; token!:string; receiver!: string; amount!: bigint
    amountFormat!: number
    static register(seq: Sequelize) {
        DelayedMint.init({
            id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
            blockNumber: {type: DataTypes.BIGINT({})},
            mintId: {type: DataTypes.STRING(66), allowNull: false, unique: true},
            refId: {type: DataTypes.STRING(66), allowNull: false, unique: true},
            minter: {type: DataTypes.STRING(42), allowNull: false},
            minterName: {type: DataTypes.STRING(32), allowNull: false},
            tx: {type: DataTypes.STRING(66), allowNull: false, unique: true},
            token: {type: DataTypes.STRING(42), allowNull: false},
            receiver: {type: DataTypes.STRING(42), allowNull: false},
            amount: {type: DataTypes.DECIMAL(65, 0), allowNull: false},
            amountFormat: {type: DataTypes.DECIMAL(47, 18), allowNull: false},
        }, {
            sequelize: seq,
            tableName: 'delayedMint',

        })
    }
}
export interface IBill {
    id?:number
    blockNumber?:number
    tx: string
    tokenAddr: string
    tokenName: string
    drip: bigint
    formatUnit: number
    minterAddr: string
    minterName: string
    minterSupply: bigint
    minterSupplyFormat: number
    ethereumTx: string
    ethereumTxFrom: string
    ethereumTxTo: string
    ethereumTxToken: string
    ethereumDrip: bigint
    ethereumFormatUnit: number
    createdAt?: Date
}
export class Bill extends Model<IBill> implements IBill {
    id?:number
    blockNumber!:number
    tx!: string
    tokenAddr!: string
    tokenName!: string
    drip!: bigint
    formatUnit!: number
    minterAddr!: string
    minterName!: string
    minterSupply!: bigint
    minterSupplyFormat!: number
    ethereumTx!: string
    ethereumTxFrom!: string
    ethereumTxTo!: string
    ethereumTxToken!: string
    ethereumDrip!: bigint
    ethereumFormatUnit!: number
    createdAt?: Date
    static register(seq: Sequelize) {
        Bill.init({
            id: {type: DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true},
            blockNumber: {type: DataTypes.BIGINT({})},
            tx: {type: DataTypes.STRING(66), allowNull: false, unique: true},
            tokenAddr: {type: DataTypes.STRING(42), allowNull: false},
            tokenName: {type: DataTypes.STRING(32), allowNull: false},
            drip: {type: DataTypes.DECIMAL(65,0), allowNull: false},
            formatUnit: {type: DataTypes.DECIMAL(47,18), allowNull: false},
            minterAddr: {type: DataTypes.STRING(42), allowNull: false},
            minterName: {type: DataTypes.STRING(42), allowNull: false},
            minterSupply: {type: DataTypes.DECIMAL(65,0), allowNull: false},
            minterSupplyFormat: {type: DataTypes.DECIMAL(47,18), allowNull: false},
            ethereumTx: {type: DataTypes.STRING(66), allowNull: false},
            ethereumTxFrom: {type: DataTypes.STRING(42), allowNull: false},
            ethereumTxTo: {type: DataTypes.STRING(42), allowNull: false},
            ethereumTxToken: {type: DataTypes.STRING(42), allowNull: false},
            ethereumDrip: {type: DataTypes.DECIMAL(65,0), allowNull: false},
            ethereumFormatUnit: {type: DataTypes.DECIMAL(47,18), allowNull: false},
        }, {
            sequelize: seq, tableName: 'bill',
            indexes: [
                {name: 'idx_token_minter', fields: ['tokenAddr', 'minterAddr']},
            ]
        })
    }
}
export class SupplyTask {
    name: string
    address!: string
    chainId!: number
    constructor(name: string, address:string, chaiId:number) {
        this.name = name; this.address = address; this.chainId = chaiId;
    }
}

export class Asset {
    name: string
    constructor(name: string) {
        this.name = name;
    }

}