// bot.js — Prioriza LocalAuth (preserva comportamento original) e opcionalmente persiste em Mongo
// Instale: npm i mongodb dotenv whatsapp-web.js qrcode-terminal
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { MongoClient } = require('mongodb');

// seu modules DB — mantive os mesmos imports do seu projeto
const {
  getUser,
  createUser,
  updateStep,
  updateLastMessage,
  addOrder
} = require('./database/users');

const { createOrder } = require('./database/orders');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'whatsapp';
const SESS_COLLECTION = 'sessions';

// detecta se há sessão local em disco (comportamento original)
const localAuthDir = path.join(__dirname, '.wwebjs_auth');
const useLocalAuth = fs.existsSync(localAuthDir);

async function loadSessionFromDB() {
  if (!MONGO_URI) return null;
  const m = new MongoClient(MONGO_URI);
  try {
    await m.connect();
    const db = m.db(DB_NAME);
    const doc = await db.collection(SESS_COLLECTION).findOne({ _id: 'wa-session' });
    return doc ? doc.data : null;
  } catch (err) {
    console.error('Erro ao carregar sessão do MongoDB:', err);
    return null;
  } finally {
    try { await m.close(); } catch(_) {}
  }
}

async function saveSessionToDB(data) {
  if (!MONGO_URI) return;
  const m = new MongoClient(MONGO_URI);
  try {
    await m.connect();
    const db = m.db(DB_NAME);
    await db.collection(SESS_COLLECTION).updateOne(
      { _id: 'wa-session' },
      { $set: { data } },
      { upsert: true }
    );
    console.log('✅ Sessão salva no MongoDB');
  } catch (err) {
    console.error('Erro ao salvar sessão no MongoDB:', err);
  } finally {
    try { await m.close(); } catch(_) {}
  }
}

(async () => {
  try {
    // Carrega session do Mongo (somente se necessário)
    const sessionData = await loadSessionFromDB();

    const puppeteerOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };

    // Lógica de prioridade:
    // 1) Se existe .wwebjs_auth, usa LocalAuth (mantém seu comportamento antigo)
    // 2) Else, se há sessionData no Mongo, usa session
    // 3) Else, se MONGO_URI definido, cria Client sem authStrategy (gerará QR e salvará no Mongo ao autenticar)
    // 4) Else fallback: LocalAuth (desenvolvimento)
    let client;
    if (useLocalAuth) {
      console.log('Usando LocalAuth (.wwebjs_auth) — comportamento local preservado.');
      client = new Client({ authStrategy: new LocalAuth(), puppeteer: puppeteerOpts });
    } else if (sessionData) {
      console.log('Sessão carregada do Mongo — usando session do DB.');
      client = new Client({ session: sessionData, puppeteer: puppeteerOpts });
    } else if (MONGO_URI) {
      console.log('MONGO_URI definido e sem sessão local — iniciando para gerar QR e salvar no Mongo.');
      client = new Client({ puppeteer: puppeteerOpts });
    } else {
      console.log('Nenhuma sessão encontrada — usando LocalAuth fallback.');
      client = new Client({ authStrategy: new LocalAuth(), puppeteer: puppeteerOpts });
    }

    client.on('qr', qr => {
      console.log('📱 QR gerado — escaneie (apenas se necessário):');
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', async (session) => {
      console.log('🔐 Evento authenticated recebido.');
      // Se estivermos usando LocalAuth, o módulo já gravou a sessão em disco;
      // ainda assim, se MONGO_URI estiver definido, gravamos também no DB para produção.
      if (MONGO_URI) {
        try {
          await saveSessionToDB(session);
        } catch (e) {
          console.error('Erro salvando sessão no authenticated:', e);
        }
      } else {
        console.log('MONGO_URI não definido — sessão salva localmente por LocalAuth.');
      }
    });

    client.on('auth_failure', msg => {
      console.error('Falha de autenticação:', msg);
    });

    client.once('ready', async () => {
      console.log('🤖 Bot conectado com sucesso!');
      // Algumas versões do whatsapp-web.js não emitem authenticated em todas as situações,
      // mas possuem client.authInfo — tente salvar isso no Mongo se disponível e MONGO_URI definido.
      if (MONGO_URI && client.authInfo) {
        try {
          await saveSessionToDB(client.authInfo);
        } catch (e) {
          console.error('Erro salvando authInfo no ready:', e);
        }
      }
    });

    // ===== handlers (mantive a sua lógica) =====
    const mensagensProcessadas = new Set();
    function saudacao(){ const hora = new Date().getHours(); if (hora < 12) return '🌅 Bom dia'; if (hora < 18) return '☀️ Boa tarde'; return '🌙 Boa noite'; }

    client.on('message', async (message) => {
      try {
        if (mensagensProcessadas.has(message.id.id)) return;
        mensagensProcessadas.add(message.id.id);
        if (message.from === 'status@broadcast') return;
        if (message.from.includes('@g.us')) return;
        if (!message.body) return;

        const msg = message.body.toLowerCase();
        const number = message.from;
        console.log('Mensagem:', msg);

        const contact = await message.getContact();
        const nome = contact.pushname || 'cliente';

        let user = await getUser(number);

        if (!user) {
          await createUser(number, nome);
          user = { number, name: nome, step: 'menu' };
        }

        await updateLastMessage(number, msg);

        if (user.step === 'human') {
          if (msg === '/voltar') {
            await updateStep(number, 'menu');
            return message.reply('🤖 Bot reativado.\n\nDigite *menu* para ver as opções.');
          }
          return;
        }

        if (msg === '/voltar') {
          await updateStep(number, 'menu');
          return message.reply(`🔙 Voltando ao menu principal.\n\n📋 *MENU*\n\n1️⃣ Produtos\n2️⃣ Horários\n3️⃣ Localização\n4️⃣ Atendimento`);
        }

        if (['oi','olá','ola','bom dia','boa tarde','boa noite'].some(w => msg.includes(w)) || msg === 'menu') {
          await updateStep(number,'menu');
          return message.reply(`${saudacao()} ${nome} 👋\n\nBem-vindo ao *${process.env.BOT_NAME || 'Bot WhatsApp'}*\n\n📋 *MENU PRINCIPAL*\n\n1️⃣ 🛍️ Produtos\n2️⃣ 🕒 Horários\n3️⃣ 📍 Localização\n4️⃣ 👨‍💼 Atendimento\n\nDigite o número da opção.`);
        }

        switch (msg) {
          case '1':
            await updateStep(number,'produtos');
            return message.reply('🛍️ *PRODUTOS DISPONÍVEIS*\n\n1️⃣ Produto A — R$50\n2️⃣ Produto B — R$80\n\nDigite o número do produto para comprar.');
          case '2':
            return message.reply('🕒 *HORÁRIO DE FUNCIONAMENTO*\n\nSegunda a Sexta  \n08h às 18h');
          case '3':
            return message.reply('📍 *LOCALIZAÇÃO*\n\nClique no link para abrir no mapa:\nhttps://maps.app.goo.gl/Rpr5wR4g4WNeHvme9');
          case '4':
            await updateStep(number,'human');
            return message.reply('👨‍💼 *ATENDIMENTO HUMANO*\n\nUm atendente falará com você em breve.\n\n🕒 Tempo médio de resposta:\n5 a 15 minutos.\n\nDigite */voltar* para retornar ao bot.');
        }

        if (user.step === 'produtos') {
          if (msg === '1') {
            await createOrder(number,'Produto A');
            await addOrder(number);
            await updateStep(number,'menu');
            return message.reply('✅ Pedido realizado!\n\n📦 Produto: Produto A\n💰 Valor: R$50\n\nUm atendente confirmará seu pedido.');
          }
          if (msg === '2') {
            await createOrder(number,'Produto B');
            await addOrder(number);
            await updateStep(number,'menu');
            return message.reply('✅ Pedido realizado!\n\n📦 Produto: Produto B\n💰 Valor: R$80\n\nUm atendente confirmará seu pedido.');
          }
        }

      } catch (error) {
        console.error('Erro no handler message:', error);
      }
    });

    await client.initialize();

  } catch (err) {
    console.error('Erro no fluxo principal:', err);
    process.exit(1);
  }
})();