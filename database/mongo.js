const { MongoClient } = require("mongodb")

const uri = process.env.MONGO_URI

const client = new MongoClient(uri)

let db

async function connect(){

if(!db){

await client.connect()

db = client.db("bot_whatsapp")

console.log("🧠 Banco conectado")

}

return db

}

module.exports = connect