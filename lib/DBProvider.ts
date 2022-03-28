import {Sequelize, Model, DataTypes} from "sequelize";
import {Address, Balance, BalanceTask, Bill, Config, Token} from "./Models";

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
    Bill.register(sequelize);
    await sequelize.sync({});
    console.log(`db inited.`)
}