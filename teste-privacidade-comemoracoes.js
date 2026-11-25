// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-privacidade-comemoracoes.js
// Banco de medicao da privacidade dos parabens (25/11/2026, RJN). Dados ficticios.
// Rodar:  node teste-privacidade-comemoracoes.js   (codigo de saida 0 = tudo ok)

const { interpretarConfig, conferirAntesDeEnviar } = require("./jobs/mensagensComemorativas.js");

let falhas = 0;
function checar(nome, cond, detalhe) {
  console.log(`${cond ? "✅" : "❌"} ${nome}${cond ? "" : "  → " + detalhe}`);
  if (!cond) falhas++;
}

(async () => {
  console.log("\n— Configuração: só liga com ativo:true de verdade —");
  checar("ativo:true liga", interpretarConfig({ horario: "0 10 * * *", ativo: true }).ativo === true, "");
  checar("ativo:false desliga", interpretarConfig({ ativo: false }).ativo === false, "");
  checar("arquivo ilegível (null) desliga", interpretarConfig(null).ativo === false, "");
  checar("JSON quebrado (texto) desliga", interpretarConfig('{"ativo": tru').ativo === false, "");
  checar("ativo \"true\" em texto desliga", interpretarConfig({ ativo: "true" }).ativo === false, "");
  checar("sem o campo ativo desliga", interpretarConfig({ horario: "0 10 * * *" }).ativo === false, "");
  checar("lista no lugar de objeto desliga", interpretarConfig([{ ativo: true }]).ativo === false, "");
  checar("hora mínima continua valendo", interpretarConfig({ horario: "0 7 * * *", ativo: true }).horario === "0 10 * * *",
    interpretarConfig({ horario: "0 7 * * *", ativo: true }).horario);

  console.log("\n— Conferência logo antes de cada envio —");
  const reg = { tipo: "aniversario_pessoal", destinatario: "celebrado", nomeCelebrado: "Maria Teste", dia: 10, mes: 12, ano: 1970 };
  const tel = "5521999991111";
  const livre = { estaPausado: () => false, estaPausadoEspecial: () => false };
  const responde = (data) => ({ ...livre, get: async () => ({ data }) });

  checar("PhotoMusic Pro diz elegível: envia",
    (await conferirAntesDeEnviar(reg, tel, responde({ elegivel: true, motivo: "" }))) === "", "");
  checar("revogou depois da lista carregada: não envia",
    (await conferirAntesDeEnviar(reg, tel, responde({ elegivel: false, motivo: "sem_consentimento_ativo" }))) === "sem_consentimento_ativo", "");
  checar("chave geral desligada no PhotoMusic Pro: não envia",
    (await conferirAntesDeEnviar(reg, tel, responde({ elegivel: false, motivo: "envio_desligado" }))) === "envio_desligado", "");
  checar("PhotoMusic Pro fora do ar: não envia",
    (await conferirAntesDeEnviar(reg, tel, { ...livre, get: async () => { throw new Error("ECONNREFUSED"); } })) === "falha_conferencia", "");
  checar("tempo esgotado: não envia",
    (await conferirAntesDeEnviar(reg, tel, { ...livre, get: async () => { throw new Error("timeout of 8000ms exceeded"); } })) === "falha_conferencia", "");
  checar("rota ainda não publicada (404): não envia",
    (await conferirAntesDeEnviar(reg, tel, { ...livre, get: async () => { const e = new Error("404"); e.response = { status: 404 }; throw e; } })) === "falha_conferencia", "");
  checar("resposta estranha (texto/HTML): não envia",
    (await conferirAntesDeEnviar(reg, tel, responde("<html>erro</html>"))) === "resposta_invalida", "");
  checar("elegivel \"true\" em texto: não envia",
    (await conferirAntesDeEnviar(reg, tel, responde({ elegivel: "true" }))) === "resposta_invalida", "");

  let consultou = false;
  const espia = async () => { consultou = true; return { data: { elegivel: true } }; };
  checar("número pausado no bot: não envia nem consulta",
    (await conferirAntesDeEnviar(reg, tel, { estaPausado: (c) => c === tel + "@c.us", estaPausadoEspecial: () => false, get: espia })) === "pausado_no_bot" && !consultou, "");
  checar("pausa especial: não envia",
    (await conferirAntesDeEnviar(reg, tel, { estaPausado: () => false, estaPausadoEspecial: () => true, get: espia })) === "pausa_especial", "");
  checar("conferência de pausa explode: não envia",
    (await conferirAntesDeEnviar(reg, tel, { estaPausado: () => { throw new Error("x"); }, estaPausadoEspecial: () => false, get: espia })) === "falha_conferencia", "");

  let params = null;
  await conferirAntesDeEnviar({ ...reg, ano: null }, tel, { ...livre, get: async (u, o) => { params = o.params; return { data: { elegivel: false, motivo: "idade_desconhecida" } }; } });
  checar("sem ano: vai vazio para o PhotoMusic Pro decidir (idade desconhecida)", params && params.ano === "", JSON.stringify(params));

  const fonte = require("fs").readFileSync(__dirname + "/jobs/mensagensComemorativas.js", "utf8");
  checar("os DOIS laços conferem antes do envio", (fonte.match(/await conferirAntesDeEnviar\(registro, telefone\);/g) || []).length === 2, "");
  checar("não existe mais o fallback que religava (ativo: true fixo)", !/ativo:\s*true\s*\n\s*\}/.test(fonte), "");

  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ Tudo certo");
  process.exit(falhas ? 1 : 0);
})();
