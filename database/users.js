const connect = require("./mongo")

/* BUSCAR USUÁRIO */

async function getUser(number){

const db = await connect()

return await db.collection("users").findOne({ number })

}

/* CRIAR USUÁRIO */

async function createUser(number, name){

const db = await connect()

const user = {
number,
name,
step: "menu",
orders: 0,
lastMessage: "",
createdAt: new Date()
}

await db.collection("users").insertOne(user)

return user

}

/* ATUALIZAR ETAPA */

async function updateStep(number, step){

const db = await connect()

await db.collection("users").updateOne(
{ number },
{ $set: { step } },
{ upsert: true }
)

}

/* SALVAR ÚLTIMA MENSAGEM */

async function updateLastMessage(number, msg){

const db = await connect()

await db.collection("users").updateOne(
{ number },
{ $set: { lastMessage: msg } }
)

}

/* CONTADOR DE PEDIDOS */

async function addOrder(number){

const db = await connect()

await db.collection("users").updateOne(
{ number },
{ $inc: { orders: 1 } }
)

}

module.exports = {
getUser,
createUser,
updateStep,
updateLastMessage,
addOrder
}