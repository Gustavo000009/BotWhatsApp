const menu = require("../commands/menu")
const { getUser, updateState } = require("../database/users")

function delay(ms){
return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = (client) => {

client.on("message", async (message) => {

try{

if (message.from === "status@broadcast") return
if (message.from.includes("@g.us")) return
if (message.fromMe) return
if (!message.body) return

const msg = message.body.toLowerCase().trim()
const numero = message.from

const user = await getUser(numero)

console.log("Estado:", user.estado)


// SAUDAÇÃO
if(
msg.includes("oi") ||
msg.includes("olá") ||
msg.includes("bom dia") ||
msg.includes("boa tarde") ||
msg.includes("boa noite") ||
msg.includes("ola")
){

await delay(2000)

await updateState(numero, "menu")

return menu(message)

}


// MENU
if(user.estado === "menu"){

switch(msg){

case "1":

await delay(2000)

message.reply(
`🛍️ Produtos disponíveis

Produto A - R$50
Produto B - R$80

Digite *comprar* para fazer um pedido`
)

await updateState(numero, "produtos")

break


case "2":

await delay(2000)

message.reply(
`🕒 Horário de funcionamento

Segunda a Sexta
08h às 18h`
)

break


case "3":

await delay(2000)

message.reply(
`📍 Localização

Rua Exemplo 123`
)

break

}

}


// FLUXO PRODUTOS
if(user.estado === "produtos"){

if(msg.includes("comprar")){

await delay(2000)

message.reply("Quantas unidades você deseja?")

await updateState(numero, "quantidade")

}

}


// QUANTIDADE
if(user.estado === "quantidade"){

await delay(2000)

message.reply(`Pedido registrado: ${msg} unidades.`)

await updateState(numero, "menu")

}

}catch(err){

console.log("Erro:", err)

}

})

}