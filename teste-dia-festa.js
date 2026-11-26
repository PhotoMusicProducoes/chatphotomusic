// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-dia-festa.js
// 26/11/2026 (RJN): rotina "Chegou o grande dia". Dados ficticios, nada sai de verdade.
// Rodar: node teste-dia-festa.js  (codigo de saida 0 = tudo ok)
const { executarDiaFesta, conferir } = require("./jobs/mensagemDiaFesta.js");

let falhas = 0, ok = 0;
function checar(nome, cond) { if (cond) { ok++; console.log("✅ " + nome); } else { falhas++; console.log("❌ " + nome); } }

const ITEM = { id_evento: 7, telefone: "5521988887777", mensagem: "Bom dia, *Carla*! 🎉" };
const livre = { estaPausado: () => false, estaPausadoEspecial: () => false, estaRevogadoLocal: () => false };
function deps(extra = {}) {
  const enviados = [], marcados = [];
  const d = Object.assign({}, livre, {
    get: async (url, opts) => ({ data: { ativo: true, lista: [ITEM] } }),
    post: async (url, body) => { marcados.push(body.id_evento); return { data: { ok: true } }; },
    sendText: async (chat, msg) => { enviados.push([chat, msg]); },
    esperar: async () => {},
    marcarComemorativa: () => {}
  }, extra);
  d._enviados = enviados; d._marcados = marcados;
  return d;
}

(async () => {
  let d = deps();
  let r = await executarDiaFesta(d);
  checar("evento valido: envia 1 e marca no PhotoMusic Pro", r.enviadas === 1 && d._enviados[0][0] === "5521988887777@c.us" && d._marcados[0] === 7);

  d = deps({ get: async () => ({ data: { ativo: false, lista: [] } }) });
  r = await executarDiaFesta(d);
  checar("chave desligada no PhotoMusic Pro: nada sai", r.enviadas === 0 && d._enviados.length === 0);

  d = deps({ get: async () => { throw new Error("fora do ar"); } });
  r = await executarDiaFesta(d);
  checar("PhotoMusic Pro fora do ar: nada sai", r.enviadas === 0 && d._enviados.length === 0);

  let chamadas = 0;
  d = deps({ get: async (url, opts) => { chamadas++; return { data: { ativo: true, lista: (opts && opts.params) ? [] : [ITEM] } }; } });
  r = await executarDiaFesta(d);
  checar("evento cancelado ou SAIR entre a lista e o envio: barra", r.enviadas === 0 && r.barradas === 1 && chamadas === 2);

  d = deps({ estaPausado: () => true });
  r = await executarDiaFesta(d);
  checar("numero pausado no bot: nao envia", r.enviadas === 0 && r.barradas === 1);
  d = deps({ estaPausadoEspecial: () => true });
  checar("pausa especial: nao envia", (await executarDiaFesta(d)).enviadas === 0);
  d = deps({ estaRevogadoLocal: () => true });
  checar("mandou SAIR no WhatsApp: nao envia", (await executarDiaFesta(d)).enviadas === 0);

  checar("telefone invalido: nao envia", (await conferir({ id_evento: 1, telefone: "123", mensagem: "x" }, deps())) === "telefone_invalido");
  checar("sem texto: nao envia", (await conferir({ id_evento: 1, telefone: "5521988887777" }, deps())) === "sem_mensagem");

  d = deps({ sendText: async () => { throw new Error("whatsapp caiu"); } });
  r = await executarDiaFesta(d);
  checar("WhatsApp falhou: conta erro e NAO marca como enviada", r.erros === 1 && d._marcados.length === 0);

  const fs = require("fs");
  const fonte = fs.readFileSync(__dirname + "/jobs/mensagemDiaFesta.js", "utf8");
  checar("rotina nao monta texto proprio (usa o aprovado do PhotoMusic Pro)", !/Chegou o grande dia/.test(fonte.replace(/^\/\*[\s\S]*?\*\//m, "")));
  const sv = fs.readFileSync(__dirname + "/server.js", "utf8");
  checar("rotina ligada no server.js", /inicializarDiaFesta\(\);/.test(sv));

  console.log(`\n${ok} OK, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})();
