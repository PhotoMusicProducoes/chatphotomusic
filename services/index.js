// services/index.js — CommonJS
// Centraliza e exporta todos os serviços da PhotoMusic

const { enviarFotoCabine, enviarOrcamento } = require("./fotoCabine.js");
const { enviarTotemFotografico } = require("./totemFotografico.js");
const { enviarPlataforma360, enviarOrcamentoPlataforma360 } = require("./plataforma360.js");
const { enviarFotoPaparazzi } = require("./paparazziDigital.js");
const { enviarFotoLembranca } = require("./fotoLembranca.js");
const { enviarFotografia } = require("./fotografia.js");
const { enviarSomDJ } = require("./somDJ.js");
const { enviarIluminacao } = require("./iluminacao.js");
const { enviarAvaliacaoEmpresa } = require("./avaliacaoEmpresa.js");
const { enviarEucaristiaManual, paroquiasEucaristia, EUCARISTIA_PDF_URL, EUCARISTIA_FORM_URL } = require("./eucaristia.js");

console.log("📦 [services] Serviços carregados: FotoCabine, TotemFotografico, Plataforma360, Paparazzi, Lembrança, SomDJ, Iluminação, Eucaristia");

module.exports = {
  enviarFotoCabine,
  enviarOrcamento,
  enviarTotemFotografico,
  enviarPlataforma360,
  enviarOrcamentoPlataforma360,
  enviarFotoPaparazzi,
  enviarFotoLembranca,
  enviarFotografia,
  enviarSomDJ,
  enviarIluminacao,
  enviarAvaliacaoEmpresa,
  enviarEucaristiaManual,
  paroquiasEucaristia,
  EUCARISTIA_PDF_URL,
  EUCARISTIA_FORM_URL
};
