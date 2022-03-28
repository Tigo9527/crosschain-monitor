"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Asset = exports.SupplyTask = exports.Bill = exports.updateConfig = exports.getNumber = exports.Config = exports.EPOCH_PREFIX_KEY = exports.BalanceTask = exports.Address = exports.Balance = exports.Token = void 0;
const sequelize_1 = require("sequelize");
class Token extends sequelize_1.Model {
    static register(seq) {
        Token.init({
            id: { type: sequelize_1.DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true },
            name: { type: sequelize_1.DataTypes.STRING(128), allowNull: false },
            chainId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            address: { type: sequelize_1.DataTypes.STRING(64), allowNull: false },
        }, {
            sequelize: seq,
            tableName: 'token',
            indexes: [
                { name: 'idx_name', fields: ['name'] }
            ]
        });
    }
}
exports.Token = Token;
class Balance extends sequelize_1.Model {
    static register(seq) {
        Balance.init({
            id: { type: sequelize_1.DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true },
            tokenId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            balance: { type: sequelize_1.DataTypes.DECIMAL(65 /*max*/, 0), allowNull: false },
        }, {
            sequelize: seq, tableName: 'balance',
        });
    }
}
exports.Balance = Balance;
class Address extends sequelize_1.Model {
    static register(seq) {
        Address.init({
            id: { type: sequelize_1.DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true },
            hex: { type: sequelize_1.DataTypes.STRING(42), allowNull: false, unique: true },
            name: { type: sequelize_1.DataTypes.STRING(64), allowNull: false, defaultValue: '' },
        }, {
            sequelize: seq, tableName: 'address',
        });
    }
}
exports.Address = Address;
class BalanceTask extends sequelize_1.Model {
    static register(seq) {
        BalanceTask.init({
            id: { type: sequelize_1.DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true },
            name: { type: sequelize_1.DataTypes.STRING(128), allowNull: false },
            tokenId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            addrId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
            chainId: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
        }, {
            sequelize: seq, tableName: 'balance_task',
        });
    }
}
exports.BalanceTask = BalanceTask;
exports.EPOCH_PREFIX_KEY = 'epoch_';
class Config extends sequelize_1.Model {
    static register(seq) {
        Config.init({
            name: { type: sequelize_1.DataTypes.STRING(128), primaryKey: true },
            config: { type: sequelize_1.DataTypes.JSON(), },
        }, {
            sequelize: seq, tableName: 'config',
        });
    }
}
exports.Config = Config;
async function getNumber(name, defaultV, save = true) {
    const bean = await Config.findByPk(name);
    if (bean) {
        return parseInt(bean.config);
    }
    if (save) {
        await Config.create({ name, config: defaultV.toString() });
    }
    return defaultV;
}
exports.getNumber = getNumber;
async function updateConfig(name, conf) {
    return Config.update({ config: conf }, { where: { name } });
}
exports.updateConfig = updateConfig;
class Bill extends sequelize_1.Model {
    static register(seq) {
        Bill.init({
            id: { type: sequelize_1.DataTypes.BIGINT({}), autoIncrement: true, primaryKey: true },
            blockNumber: { type: sequelize_1.DataTypes.BIGINT({}) },
            tx: { type: sequelize_1.DataTypes.STRING(66), allowNull: false, unique: true },
            tokenAddr: { type: sequelize_1.DataTypes.STRING(42), allowNull: false },
            tokenName: { type: sequelize_1.DataTypes.STRING(32), allowNull: false },
            drip: { type: sequelize_1.DataTypes.DECIMAL(65, 0), allowNull: false },
            formatUnit: { type: sequelize_1.DataTypes.DECIMAL(47, 18), allowNull: false },
            minterAddr: { type: sequelize_1.DataTypes.STRING(42), allowNull: false },
            minterName: { type: sequelize_1.DataTypes.STRING(42), allowNull: false },
            minterSupply: { type: sequelize_1.DataTypes.DECIMAL(65, 0), allowNull: false },
            minterSupplyFormat: { type: sequelize_1.DataTypes.DECIMAL(47, 18), allowNull: false },
            ethereumTx: { type: sequelize_1.DataTypes.STRING(66), allowNull: false },
            ethereumTxFrom: { type: sequelize_1.DataTypes.STRING(42), allowNull: false },
            ethereumTxTo: { type: sequelize_1.DataTypes.STRING(42), allowNull: false },
            ethereumTxToken: { type: sequelize_1.DataTypes.STRING(42), allowNull: false },
            ethereumDrip: { type: sequelize_1.DataTypes.DECIMAL(65, 0), allowNull: false },
            ethereumFormatUnit: { type: sequelize_1.DataTypes.DECIMAL(47, 18), allowNull: false },
        }, {
            sequelize: seq, tableName: 'bill',
            indexes: [
                { name: 'idx_minter', fields: ['minterName', 'blockNumber'] }
            ]
        });
    }
}
exports.Bill = Bill;
class SupplyTask {
    constructor(name, address, chaiId) {
        this.name = name;
        this.address = address;
        this.chainId = chaiId;
    }
}
exports.SupplyTask = SupplyTask;
class Asset {
    constructor(name) {
        this.name = name;
    }
}
exports.Asset = Asset;
