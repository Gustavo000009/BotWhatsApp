require("dotenv").config()

const { Client, LocalAuth } = require("whatsapp-web.js")
const qrcode = require("qrcode-terminal")

const {
getUser,
createUser,
updateStep,
updateLastMessage,
addOrder
} = require("./database/users")

const { createOrder } = require("./database/orders")

const client = new Client({
authStrategy: new LocalAuth()
})

const mensagensProcessadas = new Set()

/* SAUDAÇÃO INTELIGENTE */

function saudacao(){

const hora = new Date().getHours()

if(hora < 12) return "🌅 Bom dia"
if(hora < 18) return "☀️ Boa tarde"

return "🌙 Boa noite"

}

/* QR CODE */

client.on("qr", (qr) => {

console.log("📱 Escaneie o QR Code abaixo:")
qrcode.generate(qr, { small: true })

})

/* BOT PRONTO */

client.once("ready", () => {

console.log("🤖 Bot conectado com sucesso!")

})

/* MENSAGENS */

client.on("message", async (message) => {

try{

/* BLOQUEAR DUPLICAÇÃO */

if(mensagensProcessadas.has(message.id.id)) return
mensagensProcessadas.add(message.id.id)

/* BLOQUEIOS */

if(message.from === "status@broadcast") return
if(message.from.includes("@g.us")) return
if(!message.body) return

const msg = message.body.toLowerCase()
const number = message.from

console.log("Mensagem:", msg)

/* NOME DO CONTATO */

const contact = await message.getContact()
const nome = contact.pushname || "cliente"

/* BANCO */

let user = await getUser(number)

if(!user){

await createUser(number,nome)

user = {
number,
name: nome,
step: "menu"
}

}

/* SALVAR ÚLTIMA MENSAGEM */

await updateLastMessage(number,msg)

/* ===== ATENDIMENTO HUMANO ===== */

if(user.step === "human"){

if(msg === "/voltar"){

await updateStep(number,"menu")

return message.reply(
`🤖 Bot reativado.

Digite *menu* para ver as opções.`
)

}

return

}

/* COMANDO VOLTAR */

if(msg === "/voltar"){

await updateStep(number,"menu")

return message.reply(
`🔙 Voltando ao menu principal.

📋 *MENU*

1️⃣ Produtos
2️⃣ Horários
3️⃣ Localização
4️⃣ Atendimento`
)

}

/* SAUDAÇÃO */

if(
msg.includes("oi") ||
msg.includes("olá") ||
msg.includes("ola") ||
msg.includes("bom dia") ||
msg.includes("boa tarde") ||
msg.includes("boa noite") ||
msg === "menu"
){

await updateStep(number,"menu")

return message.reply(
`${saudacao()} ${nome} 👋

Bem-vindo ao *${process.env.BOT_NAME}*

📋 *MENU PRINCIPAL*

1️⃣ 🛍️ Produtos
2️⃣ 🕒 Horários
3️⃣ 📍 Localização
4️⃣ 👨‍💼 Atendimento

Digite o número da opção.`
)

}

/* MENU */

switch(msg){

case "1":

await updateStep(number,"produtos")

return message.reply(
`🛍️ *PRODUTOS DISPONÍVEIS*

1️⃣ Produto A — R$50
2️⃣ Produto B — R$80

Digite o número do produto para comprar.`
)

case "2":

return message.reply(
`🕒 *HORÁRIO DE FUNCIONAMENTO*

Segunda a Sexta  
08h às 18h`
)

case "3":
return message.reply(
    `📍 *LOCALIZAÇÃO*\n\nClique no link para abrir no mapa:\nhttps://maps.app.goo.gl/Rpr5wR4g4WNeHvme9`
)    

case "4":

await updateStep(number,"human")

return message.reply(
`👨‍💼 *ATENDIMENTO HUMANO*

Um atendente falará com você em breve.

🕒 Tempo médio de resposta:
5 a 15 minutos.

Digite */voltar* para retornar ao bot.`
)

}

/* SISTEMA DE PEDIDOS */

if(user.step === "produtos"){

if(msg === "1"){

await createOrder(number,"Produto A")
await addOrder(number)

await updateStep(number,"menu")

return message.reply(
`✅ Pedido realizado!

📦 Produto: Produto A
💰 Valor: R$50

Um atendente confirmará seu pedido.`
)

}

if(msg === "2"){

await createOrder(number,"Produto B")
await addOrder(number)

await updateStep(number,"menu")

return message.reply(
`✅ Pedido realizado!

📦 Produto: Produto B
💰 Valor: R$80

Um atendente confirmará seu pedido.`
)

}

}

}catch(error){

console.log("Erro:", error)

}

})

client.initialize()