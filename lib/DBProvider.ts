import {Sequelize, Model, DataTypes} from "sequelize";
import {Address, Balance, BalanceTask, Bill, Config, DelayedMint, Token} from "./Models";
import {ELog} from "../sync/LogSync";

export async function initDB(connectUrl: string = "mysql://root:asd123@localhost:3306/mydb", log=false) {
    const sequelize = new Sequelize(connectUrl, {
        logging: log ? console.log : false
    });
    // Token.register(sequelize)
    // Balance.register(sequelize)
    // BalanceTask.register(sequelize)
    Address.register(sequelize)
    Config.register(sequelize);
    Config.removeAttribute("id")
    DelayedMint.register(sequelize);
    Bill.register(sequelize);
    ELog.register(sequelize)
    await sequelize.sync({});
    console.log(`db inited.`)
}