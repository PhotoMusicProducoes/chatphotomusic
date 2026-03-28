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

module.exports = {
  INSTANCE_ID,
  TOKEN,
  API_URL,
  WEBHOOK_URL,
  urlBase,
  urlBase1,
  urlBase2,
  urlBase3
};
