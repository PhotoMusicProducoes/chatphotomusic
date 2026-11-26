// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-pausa-retomar-banco.js
// 26/11/2026 (RJN): retomar/pausar pelo comando grava no PhotoMusic Pro tambem.
// Dados ficticios; o axios e simulado (nada sai para a internet).
// Rodar: node teste-pausa-retomar-banco.js  (codigo de saida 0 = tudo ok)
const path = require("path");
const fs = require("fs");
let falhas = 0, ok = 0;
function checar(nome, cond) { if (cond) { ok++; console.log("✅ " + nome); } else { falhas++; console.log("❌ " + nome); } }

// axios simulado: lista antiga (arquivo) + banco
const posts = [];
let banco = [{ telefone: "5521911112222", nome: "Pessoa Ficticia", pausado: 1 }];
const arquivo = [{ telefone: "21911112222", nome: "Pessoa Ficticia" }];
const axiosFalso = {
  get: async (url) => {
    if (/pausa-especial\/arquivo/.test(url)) return { data: arquivo };
    if (/pausa-especial\/lista/.test(url)) return { data: banco };
    return { data: [] };
  },
  post: async (url, body) => {
    posts.push(body);
    const r = banco.find(b => b.telefone === body.telefone);
    if (r) r.pausado = body.pausado; else banco.push(body);
    return { data: { sucesso: true } };
  }
};
const caminhoAxios = require.resolve("axios", { paths: [path.join(__dirname, "utils")] });
require.cache[caminhoAxios] = { id: caminhoAxios, filename: caminhoAxios, loaded: true, exports: axiosFalso };

process.env.PM_API_KEY = process.env.PM_API_KEY || "chave-de-teste";
// o modulo grava sessoesRetomadas.json na pasta do bot quando nao ha /data: apaga no fim se o teste criou
const ARQ_SESSOES = path.join(__dirname, "sessoesRetomadas.json");
const existia = fs.existsSync(ARQ_SESSOES);
process.on("exit", () => { if (!existia) { try { fs.unlinkSync(ARQ_SESSOES); } catch (e) {} } });
const fonte = fs.readFileSync(path.join(__dirname, "utils/pausaEspecialControl.js"), "utf8");
const P = require("./utils/pausaEspecialControl.js");

(async () => {
  await P.carregarPausadosEspeciais();
  await P.carregarPausadosDB();
  const chat = "5521911112222@c.us";
  checar("comeca pausado", P.estaPausadoEspecial(chat) === true);

  posts.length = 0;
  await P.retomarEspecial("21 91111-2222");
  checar("retomar: o bot volta a atender", P.estaPausadoEspecial(chat) === false);
  checar("retomar: grava pausado=0 no PhotoMusic Pro, no registro que JA existe", posts.length === 1 && posts[0].pausado === 0 && posts[0].telefone === "5521911112222");
  checar("retomar: nao cria registro duplicado", banco.length === 1);

  posts.length = 0;
  await P.pausarEspecial("21 91111-2222");
  checar("pausar: grava pausado=1 no PhotoMusic Pro", posts.some(b => b.pausado === 1 && b.telefone === "5521911112222"));
  checar("pausar: o bot para de atender", P.estaPausadoEspecial(chat) === true);

  checar("start sincroniza as sessoes retomadas antigas com o banco", /try \{ await sincronizarRetomadasComDB\(\); \} catch \(e\) \{\}/.test(fonte));

  console.log(`\n${ok} OK, ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log("❌ erro: " + e.message); process.exit(1); });
