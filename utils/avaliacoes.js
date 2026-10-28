// utils/avaliacoes.js
//
// Quantas avaliações 5 estrelas a empresa tem no Google, para as mensagens de
// abertura e do menu. O número NÃO fica mais escrito à mão aqui: o Mario digita o
// valor exato em WordPress > Dados da Empresa e o plugin devolve em
// /empresa-numeros ("1.700" = a centena de baixo, para nunca prometer o que não tem).
//
// Síncrono para quem monta a mensagem: devolve o último valor conhecido (ou o
// reserva se o site estiver fora) e atualiza em segundo plano, no máximo a cada 30 min.

const axios = require("axios");
const { PM_API_BASE, PM_API_KEY } = require("./config.js");

const RESERVA = "1.700";
const VALIDADE_MS = 30 * 60 * 1000;

let texto = RESERVA;
let ultimaBusca = 0;
let buscando = false;

async function atualizar() {
  if (buscando) return;
  buscando = true;
  ultimaBusca = Date.now();
  try {
    const r = await axios.get(`${PM_API_BASE}/empresa-numeros`, {
      headers: { "X-PM-Api-Key": PM_API_KEY },
      timeout: 6000,
    });
    const t = r && r.data && r.data.avaliacoes_texto;
    if (typeof t === "string" && /^\d{1,3}(\.\d{3})*$/.test(t)) texto = t;
  } catch (e) {
    // site fora ou plugin ainda sem o endpoint: segue com o último valor
  } finally {
    buscando = false;
  }
}

/** "1.700" (sem o "mais de"). */
function avaliacoesTexto() {
  if (Date.now() - ultimaBusca > VALIDADE_MS) atualizar();
  return texto;
}

module.exports = { avaliacoesTexto, atualizar };
