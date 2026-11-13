// teste-cego-ia/rodar.js - TESTE CEGO do extrator de mensagens livres: Claude x OpenAI (12/11/2026, NAZ)
//
// SEM RISCO POR PADRAO: sem `--executar` so mostra o plano e o custo ESTIMADO. Nao ativa IA no bot, nao envia nada a cliente.
// Com `--executar` chama as APIs de verdade (centavos de dolar; precisa de ANTHROPIC_API_KEY e/ou OPENAI_API_KEY no ambiente).
//
//   node teste-cego-ia/rodar.js                                  (plano + custo estimado, nada pago)
//   node teste-cego-ia/rodar.js --executar --modelos claude:claude-haiku-5-5,openai:SEU-MODELO
//
// O que mede por modelo: acerto de nome, perfil, servicos e convidados; INVENCOES (campo preenchido que a mensagem
// nao sustenta); falhas de interpretacao (JSON invalido/erro); tokens e custo, e o custo por 1.000 conversas.
// Precos: teste-cego-ia/precos.json (por milhao de tokens). Os da OpenAI vieram colados pelo Mario e NAO foram verificados.

const fs = require("fs");
const path = require("path");
const { criarExtrator, SCHEMA } = require("../utils/iaExtrair.js");

// Copia do catalogo do bot (SERVICOS_NOMES do index.js). Mudou la, mude aqui.
const SERVICOS = { 1: "Foto Cabine", 2: "Totem Fotográfico", 3: "Plataforma 360º", 4: "Foto Paparazzi Digital", 5: "Foto Lembrança", 6: "Cobertura Fotográfica", 7: "Som Completo com DJ", 8: "Iluminação para Pista de Dança", 13: "Totem Retrô" };
const args = process.argv.slice(2);
const executar = args.includes("--executar");
const modelos = (args[args.indexOf("--modelos") + 1] || "claude:claude-haiku-5-5,claude:claude-sonnet-5-5").split(",").filter(x => x && !x.startsWith("--"));
const casos = JSON.parse(fs.readFileSync(path.join(__dirname, "mensagens.json"), "utf8")).casos;
const precos = JSON.parse(fs.readFileSync(path.join(__dirname, "precos.json"), "utf8"));
const { instrucao, } = criarExtrator({ servicos: SERVICOS });

const mesmoSet = (a, b) => a.length === b.length && a.slice().sort().join() === b.slice().sort().join();
function conferir(r, g, texto) {
  const res = { nome: false, perfil: false, servicos: false, convidados: false, invencao: false };
  const nomeOk = g.nome === "" ? !r.nome : String(r.nome || "").toLowerCase() === g.nome.toLowerCase();
  res.nome = nomeOk;
  res.perfil = Array.isArray(g.perfil) ? g.perfil.includes(r.perfil || "") : (r.perfil || "") === g.perfil;
  const gs = Array.isArray(g.servicos[0]) ? g.servicos : [g.servicos];
  res.servicos = gs.some(x => mesmoSet(x, r.servicos || []));
  res.convidados = (r.convidados || 0) === (g.convidados || 0);
  // invencao: nome que nao esta no texto, servico fora de todos os aceitos, convidados que nao aparecem no texto
  const todosAceitos = new Set(gs.flat());
  const nomeInv = r.nome && !texto.toLowerCase().includes(String(r.nome).toLowerCase());
  const servInv = (r.servicos || []).some(s => !todosAceitos.has(s));
  const convInv = r.convidados && !texto.replace(/\./g, "").includes(String(r.convidados));
  res.invencao = !!(nomeInv || servInv || convInv);
  return res;
}

async function chamar(modelo, msg) {
  const [forn, id] = [modelo.split(":")[0], modelo.split(":").slice(1).join(":")];
  if (forn === "claude") {
    const { obterCliente } = require("../utils/roteadorIA.js");
    const c = obterCliente(); if (!c) throw new Error("sem cliente Anthropic");
    const r = await c.messages.create({ model: id, max_tokens: 1500, output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: instrucao }], messages: [{ role: "user", content: `Mensagem recebida no WhatsApp:\n\n${msg}` }] }, { timeout: 20000 });
    const txt = (r.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return { json: JSON.parse(txt), tin: r.usage.input_tokens, tout: r.usage.output_tokens };
  }
  if (forn === "openai") {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({ model: id, messages: [{ role: "system", content: instrucao }, { role: "user", content: `Mensagem recebida no WhatsApp:\n\n${msg}` }],
        response_format: { type: "json_schema", json_schema: { name: "extracao", strict: true, schema: SCHEMA } } }) });
    const j = await resp.json(); if (!j.choices) throw new Error(JSON.stringify(j).slice(0, 200));
    return { json: JSON.parse(j.choices[0].message.content), tin: j.usage.prompt_tokens, tout: j.usage.completion_tokens };
  }
  throw new Error("fornecedor desconhecido: " + forn);
}

(async () => {
  const tokEnt = Math.round((instrucao.length + 200) / 3.2), tokSai = 120;   // estimativa grosseira por conversa
  console.log(`Casos: ${casos.length} | modelos: ${modelos.join(", ")} | ${executar ? "EXECUTANDO (chama as APIs)" : "PLANO (nada pago; use --executar)"}`);
  for (const m of modelos) {
    const p = precos[m];
    const est = p ? ((tokEnt * p.entrada + tokSai * p.saida) / 1e6) * 1000 : null;
    console.log(`  ${m}: ~${tokEnt} tokens de entrada + ~${tokSai} de saida por conversa -> ${est === null ? "sem preco em precos.json" : "US$ " + est.toFixed(2) + " por 1.000 conversas (estimado)"}`);
  }
  if (!executar) return;
  const quadro = [];
  for (const m of modelos) {
    const t = { modelo: m, n: 0, nome: 0, perfil: 0, servicos: 0, convidados: 0, invencoes: 0, falhas: 0, tin: 0, tout: 0 };
    for (const c of casos) {
      t.n++;
      try {
        const o = await chamar(m, c.texto); t.tin += o.tin; t.tout += o.tout;
        const r = conferir(o.json, c.gabarito, c.texto);
        ["nome", "perfil", "servicos", "convidados"].forEach(k => { if (r[k]) t[k]++; });
        if (r.invencao) { t.invencoes++; console.log(`   ⚠ invenção em ${m} no caso ${c.id}: ${JSON.stringify(o.json)}`); }
      } catch (e) { t.falhas++; console.log(`   ✖ falha em ${m} no caso ${c.id}: ${e.message}`); }
    }
    const p = precos[m]; t.custo1000 = p ? ((t.tin / t.n * p.entrada + t.tout / t.n * p.saida) / 1e6) * 1000 : null;
    quadro.push(t);
  }
  console.log("\nRESULTADO (acertos / casos):");
  for (const t of quadro) console.log(`${t.modelo}: nome ${t.nome}/${t.n} | perfil ${t.perfil}/${t.n} | serviços ${t.servicos}/${t.n} | convidados ${t.convidados}/${t.n} | INVENÇÕES ${t.invencoes} | falhas ${t.falhas} | custo/1.000: ${t.custo1000 === null ? "?" : "US$ " + t.custo1000.toFixed(2)}`);
})().catch(e => { console.error("💥", e); process.exit(1); });
