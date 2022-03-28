"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = void 0;
const sequelize_1 = require("sequelize");
const Models_1 = require("./Models");
async function initDB(connectUrl = "mysql://root:asd123@localhost:3306/mydb", log = false) {
    const sequelize = new sequelize_1.Sequelize(connectUrl, {
        logging: log ? console.log : false
    });
    // Token.register(sequelize)
    // Balance.register(sequelize)
    // BalanceTask.register(sequelize)
    Models_1.Address.register(sequelize);
    Models_1.Config.register(sequelize);
    Models_1.Config.removeAttribute("id");
    Models_1.Bill.register(sequelize);
    await sequelize.sync({});
    console.log(`db inited.`);
}
exports.initDB = initDB;
