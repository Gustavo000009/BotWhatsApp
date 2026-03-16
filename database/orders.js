const connect = require("./mongo")

async function createOrder(number, product){

const db = await connect()

await db.collection("orders").insertOne({

number,
product,
status: "novo",
date: new Date()

})

}

module.exports = {
createOrder
}