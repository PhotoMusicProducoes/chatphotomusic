// teste-orcamento-api-campos.js - metricas (12/11/2026): o pedido ao plugin leva `perfil_cliente` e `modelo_orcamento` so quando existem
// Rodar:  node teste-orcamento-api-campos.js   (conferir o CODIGO DE SAIDA)
process.env.PM_API_KEY = "chave-de-teste";
const axios = require("axios");
let corpo = null;
axios.post = async (_u, c) => { corpo = c; return { data: { id: 1, url: "https://exemplo/x.pdf", total: 1 } }; };
const { gerarOrcamento } = require("./utils/orcamentoApi.js");
let falhas = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 200)}`); if (!ok) falhas++; }
(async () => {
  await gerarOrcamento({ orcamento: { perfil: "empresa" } }, "5521900000000@c.us", ["foto-cabine"], { situacao: "preliminar", modelo: "preliminar_enxuto" });
  checar("preliminar enxuto de empresa: perfil, situação e modelo seguem", corpo.perfil_cliente === "empresa" && corpo.modelo_orcamento === "preliminar" && corpo.modelo === "preliminar_enxuto", JSON.stringify(corpo));
  await gerarOrcamento({ orcamento: { perfil: "social" } }, "5521900000000@c.us", ["foto-cabine"], { situacao: "definitivo" });
  checar("definitivo social: perfil e situação, sem modelo enxuto", corpo.perfil_cliente === "social" && corpo.modelo_orcamento === "definitivo" && corpo.modelo === undefined, JSON.stringify(corpo));
  await gerarOrcamento({ orcamento: {} }, "5521900000000@c.us", ["foto-cabine"]);
  checar("pedido antigo (sem perfil nem situação): nenhum campo novo vai (nada é sobrescrito)", !("perfil_cliente" in corpo) && !("modelo_orcamento" in corpo) && !("modelo" in corpo), JSON.stringify(corpo));
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error("💥", e); process.exit(1); });
