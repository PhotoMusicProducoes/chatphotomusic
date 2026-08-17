// utils/config.js — CommonJS

// Carrega variáveis de ambiente
require("dotenv").config();

// Credenciais Z-API (agora seguras)
const INSTANCE_ID = process.env.INSTANCE_ID;
const TOKEN = process.env.TOKEN;

// Base completa da API
const API_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`;

// URL pública do webhook
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Bases de URL para arquivos da PhotoMusic
const urlBase  = "https://photomusic.com.br/wp-content/uploads/2025/02/";
const urlBase1 = "https://photomusic.com.br/wp-content/uploads/2025/03/";
const urlBase2 = "https://photomusic.com.br/wp-content/uploads/2025/04/";
const urlBase3 = "https://photomusic.com.br/wp-content/uploads/2026/02/";
const urlBase4 = "https://photomusic.com.br/wp-content/uploads/2026/08/";

// Linha do operador (recebe os avisos de falha). 🚨 É a lista de QUEM RECEBE
// aviso, diferente da lista OPERADORES do index.js, que é quem PODE MANDAR
// comando. São coisas separadas de propósito.
const OPERADOR_TELEFONE_ID = "5521964428172@c.us";

// API WordPress — PhotoMusic Pro
// Adicione no .env:  PM_API_KEY=<chave gerada pelo plugin em Configurações>
const PM_API_BASE = process.env.PM_API_BASE || "https://photomusic.com.br/wp-json/photomusic/v1";
const PM_API_KEY  = process.env.PM_API_KEY  || "";

module.exports = {
  INSTANCE_ID,
  TOKEN,
  API_URL,
  WEBHOOK_URL,
  urlBase,
  urlBase1,
  urlBase2,
  urlBase3,
  urlBase4,
  OPERADOR_TELEFONE_ID,
  PM_API_BASE,
  PM_API_KEY,
};
