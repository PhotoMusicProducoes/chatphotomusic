// utils/config.js — CommonJS

// Credenciais Z-API
const INSTANCE_ID = "3EBC850F6EE9E27151AA5A0F11A263D4";
const TOKEN = "DE2217CB1AFABE0F630A3C55";

// Base completa da API (já com instance/token)
const API_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`;

// URL pública do webhook (ngrok)
const WEBHOOK_URL = "https://autoplastic-iona-unpatronizingly.ngrok-free.dev/webhook";

// Bases de URL para arquivos da PhotoMusic
const urlBase  = "https://photomusic.com.br/wp-content/uploads/2025/02/";
const urlBase1 = "https://photomusic.com.br/wp-content/uploads/2025/03/";
const urlBase2 = "https://photomusic.com.br/wp-content/uploads/2025/04/";
const urlBase3 = "https://photomusic.com.br/wp-content/uploads/2026/02/";

// API REST do WordPress (PhotoMusic Pro)
// Chave de API: copie em WordPress → Eventos → qualquer evento → 🖼️ Galeria → seção API Key
// (ou acesse /wp-admin → Configurações → WhatsApp → Chave API ChatBot)
const PM_SITE_URL = "https://photomusic.com.br";
const PM_API_KEY  = "COLE_AQUI_A_CHAVE_DO_WORDPRESS"; // ← substituir pela chave real

module.exports = {
  INSTANCE_ID,
  TOKEN,
  API_URL,
  WEBHOOK_URL,
  urlBase,
  urlBase1,
  urlBase2,
  urlBase3,
  PM_SITE_URL,
  PM_API_KEY,
};
