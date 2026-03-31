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
  PM_API_BASE,
  PM_API_KEY,
};
