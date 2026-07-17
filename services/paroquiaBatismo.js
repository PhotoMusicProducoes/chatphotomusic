// services/paroquiaBatismo.js
// BATISMO - inscrição online (fatia 4a). Módulo ISOLADO da bancada Rapha Lumen:
// a ficha de papel da Paróquia São José vira um formulário web com link+token.
//
// 🚨 DADO DE MENOR + DOCUMENTO: na bancada (ChatPhotoMusic em iad/EUA) só entra
// dado FICTÍCIO. O formulário real (documento e criança de verdade) roda na org
// Rapha Lumen / região gru (Brasil). Não divulgar o link a fiel real aqui.
//
// Modelo espelha o schema (batizandos + batizando_padrinhos + batismo_pre_cadastro):
// migra pro Postgres/gru sem reescrever. Guardado em arquivo isolado por enquanto.
// Próximas fatias: 4b upload de documentos, 4c assinatura digital, 4d revisão da
// secretaria (pendências + aviso no WhatsApp), 4e agenda da pastoral.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = fs.existsSync("/data") ? "/data" : __dirname;
const ARQ = path.join(DIR, "psj-batismo.json");
const DIR_DOCS = path.join(DIR, "psj-batismo-docs");   // arquivos anexados (fatia 4b)

// Documentos que a família anexa (foto/arquivo). Espelha a lista da ficha.
// O item "Ficha dos padrinhos assinada" NÃO entra aqui: vira assinatura
// digital na fatia 4c.
const DOCUMENTOS = [
  { id: "nascimento",   label: "Certidão de nascimento da criança" },
  { id: "identidade",   label: "Identidade civil dos padrinhos (se solteiros)" },
  { id: "cas_religioso", label: "Certidão de casamento religioso dos padrinhos (se casados ou viúvos)" },
  { id: "sacramentos",  label: "Comprovante dos sacramentos dos padrinhos (Batismo, 1ª Eucaristia e Crisma)" },
  { id: "residencia",   label: "Comprovante de residência dos pais" },
  { id: "autorizacao",  label: "Autorização da paróquia de origem (se os pais não pertencem a esta comunidade)" }
];
const DOC_LABEL = Object.fromEntries(DOCUMENTOS.map(d => [d.id, d.label]));
const EXT_POR_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

// URL pública da bancada (p/ montar o link que a secretaria copia). Na produção
// vira o domínio da paróquia no gru.
const BASE = process.env.PSJ_BASE || "https://chatphotomusic.fly.dev";

// Regra de datas da São José: 2º sábado = Matriz, 3º = Sta Teresinha, 4º = Penha.
// Sempre às 10h, batismo comunitário. [Maju 18/07]
const LOCAL_POR_SEMANA = {
  2: "Matriz São José",
  3: "Capela Santa Teresinha (Camboinhas)",
  4: "Capela N. Sra. da Penha (Tibau)"
};
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function lerJson() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return []; } }
function salvar(dados) {
  try { fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2)); }
  catch (e) { console.error("🚨 [psj-batismo] Falha ao salvar:", e.message); }
}
function proxId(arr) { return arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1; }

// ---- datas de batismo (a partir da regra) ----
function nEsimoSabado(ano, mes, n) {
  let count = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const dt = new Date(ano, mes, dia);
    if (dt.getMonth() !== mes) break;
    if (dt.getDay() === 6 && ++count === n) return dt;
  }
  return null;
}
function rotuloData(dt) {
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${DIAS[dt.getDay()]}, ${dd}/${mm}/${dt.getFullYear()} - 10h`;
}
function proximasDatas(qtd) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const out = [];
  for (let m = 0; m < 8; m++) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth() + m, 1);
    for (const n of [2, 3, 4]) {
      const dt = nEsimoSabado(base.getFullYear(), base.getMonth(), n);
      if (dt && dt >= hoje) {
        out.push({ data: dt.toISOString().slice(0, 10), local: LOCAL_POR_SEMANA[n], rotulo: rotuloData(dt) });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data)).slice(0, qtd || 12);
}

// ---- dados ----
function lerInscricoes() { return lerJson(); }

// A secretaria (ou o chat) gera um convite = token vazio. O fiel abre o link e
// preenche. Devolve o token.
function gerarConvite(whatsapp) {
  const arr = lerInscricoes();
  const reg = {
    id: proxId(arr),
    token: crypto.randomBytes(9).toString("hex"),
    status: "convite",            // convite -> recebida -> pendente | aprovada
    whatsapp: whatsapp || "",
    criada_em: new Date().toISOString()
  };
  arr.push(reg);
  salvar(arr);
  return reg;
}

function acharPorToken(token) { return lerInscricoes().find(i => i.token === token); }

function salvarPreenchimento(token, dados) {
  const arr = lerInscricoes();
  const i = arr.findIndex(x => x.token === token);
  if (i < 0) return null;
  arr[i] = { ...arr[i], ...dados, status: "recebida", preenchida_em: new Date().toISOString() };
  salvar(arr);
  return arr[i];
}

function removerInscricao(id) {
  const reg = lerInscricoes().find(i => i.id === Number(id));
  if (reg && reg.documentos) reg.documentos.forEach(doc => apagarArquivoDoc(doc));
  salvar(lerInscricoes().filter(i => i.id !== Number(id)));
}

function linkDoToken(token) { return `${BASE}/psj/b/${token}`; }

// ---- documentos anexados (fatia 4b) ----
function apagarArquivoDoc(doc) {
  try { if (doc && doc.arquivo) fs.unlinkSync(path.join(DIR_DOCS, doc.arquivo)); } catch (_) {}
}

// Recebe um dataURL ("data:image/jpeg;base64,...") já comprimido no navegador,
// grava o arquivo em disco e anexa à inscrição. Devolve o doc ou {erro}.
function salvarDoc(token, { tipo, nome, dataUrl }) {
  const reg = acharPorToken(token);
  if (!reg) return { erro: "Link inválido." };
  if (!DOC_LABEL[tipo]) return { erro: "Tipo de documento inválido." };
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) return { erro: "Arquivo inválido." };
  const mime = m[1];
  const ext = EXT_POR_MIME[mime];
  if (!ext) return { erro: "Formato não aceito (use foto JPG/PNG ou PDF)." };
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 12 * 1024 * 1024) return { erro: "Arquivo muito grande." };

  try { fs.mkdirSync(DIR_DOCS, { recursive: true }); } catch (_) {}
  const arr = lerInscricoes();
  const i = arr.findIndex(x => x.token === token);
  arr[i].documentos = arr[i].documentos || [];
  const docId = (arr[i].documentos.reduce((mx, d) => Math.max(mx, d.id || 0), 0) || 0) + 1;
  const arquivo = `${token}__${docId}.${ext}`;
  try { fs.writeFileSync(path.join(DIR_DOCS, arquivo), buf); }
  catch (e) { console.error("🚨 [psj-batismo] doc:", e.message); return { erro: "Falha ao salvar o arquivo." }; }
  const doc = { id: docId, tipo, nome: String(nome || "").slice(0, 120), arquivo, mime, enviado_em: new Date().toISOString() };
  arr[i].documentos.push(doc);
  salvar(arr);
  return { ok: true, doc };
}

function removerDoc(token, docId) {
  const arr = lerInscricoes();
  const i = arr.findIndex(x => x.token === token);
  if (i < 0) return;
  const doc = (arr[i].documentos || []).find(d => d.id === Number(docId));
  if (doc) apagarArquivoDoc(doc);
  arr[i].documentos = (arr[i].documentos || []).filter(d => d.id !== Number(docId));
  salvar(arr);
}

// Caminho absoluto + mime de um doc, p/ a rota que serve o arquivo.
function arquivoDoc(token, docId) {
  const reg = acharPorToken(token);
  const doc = reg && (reg.documentos || []).find(d => d.id === Number(docId));
  if (!doc) return null;
  return { caminho: path.join(DIR_DOCS, doc.arquivo), mime: doc.mime, nome: doc.nome };
}

// ---------------------------------------------------------------------------
// Formulário PÚBLICO (o fiel preenche). Espelha a ficha de papel da paróquia.
// ---------------------------------------------------------------------------
function estiloForm() {
  return `<style>
  *{box-sizing:border-box} body{font-family:system-ui,Arial,sans-serif;margin:0;background:#f4f6f8;color:#1f2937}
  .wrap{max-width:640px;margin:0 auto;padding:16px}
  h1{font-size:1.3rem;margin:.2rem 0} h2{font-size:1rem;margin:1.2rem 0 .3rem;color:#1d4ed8}
  .sub{color:#6b7280;font-size:.9rem;margin:.2rem 0 1rem}
  section{background:#fff;padding:14px 16px;border-radius:10px;box-shadow:0 1px 6px #0001;margin-bottom:14px}
  label{display:block;margin:.6rem 0 .2rem;font-size:.85rem;color:#374151}
  input,select{font-size:1rem;padding:.55rem;border:1px solid #d1d5db;border-radius:8px;width:100%}
  .lin{display:flex;gap:8px} .lin>div{flex:1}
  .simnao{display:flex;gap:16px;margin-top:.2rem} .simnao label{display:flex;align-items:center;gap:.3rem;margin:0;font-size:.95rem}
  .simnao input{width:auto}
  .hint{color:#6b7280;font-size:.8rem;margin:.1rem 0 0}
  button{font-size:1.05rem;padding:.7rem;border:none;border-radius:8px;width:100%;background:#2563eb;color:#fff;cursor:pointer;margin-top:.6rem}
  .ok{background:#dcfce7;color:#166534;padding:1rem;border-radius:10px} .erro{background:#fee2e2;color:#991b1b;padding:.6rem;border-radius:8px;margin-bottom:10px}
  .tag{background:#fef3c7;color:#92400e;border-radius:6px;padding:.15rem .5rem;font-size:.75rem}
  .doc{border-top:1px solid #eef0f2;padding:.7rem 0}
  .doc-cab{font-size:.9rem} .cnt{background:#dbeafe;color:#1d4ed8;border-radius:999px;padding:0 .5rem;font-size:.75rem}
  .anexos{display:flex;flex-wrap:wrap;gap:8px;margin:.4rem 0}
  .anexo{position:relative} .anexo img{width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #d1d5db}
  .anexo .pdf{display:inline-block;padding:.4rem .6rem;background:#f3f4f6;border-radius:8px;font-size:.8rem;text-decoration:none;color:#374151}
  .anexo .rm{position:static;display:block;margin-top:.2rem;font-size:.72rem;color:#a11;background:none;border:none;cursor:pointer;padding:0;width:auto}
  .add{display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px dashed #93c5fd;border-radius:8px;padding:.5rem .8rem;font-size:.88rem;cursor:pointer;margin-top:.2rem}
  .ov{display:none;position:fixed;inset:0;background:#0006;align-items:center;justify-content:center;z-index:9}
  .ov-box{background:#fff;padding:1rem 1.4rem;border-radius:10px;font-size:.95rem}
  </style>`;
}

// Campo texto
function ft(label, name, val, opt) {
  opt = opt || {};
  return `<label>${label}${opt.req ? " *" : ""}</label>` +
    `<input type="${opt.type || "text"}" name="${name}" value="${esc(val || "")}" ${opt.req ? "required" : ""} ${opt.ph ? `placeholder="${esc(opt.ph)}"` : ""}>`;
}
// Sim/Não (radio)
function fsn(label, name, val) {
  return `<label>${label}</label><div class="simnao">
    <label><input type="radio" name="${name}" value="sim" ${val === "sim" ? "checked" : ""}> Sim</label>
    <label><input type="radio" name="${name}" value="nao" ${val === "nao" ? "checked" : ""}> Não</label>
  </div>`;
}

// Bloco de padrinho OU madrinha (mesmas perguntas da ficha).
function blocoPadrinho(titulo, pfx, d) {
  d = d || {};
  return `<section>
    <h2>${titulo}</h2>
    ${ft("Nome", pfx + "_nome", d.nome, { req: true })}
    ${ft("Telefone", pfx + "_tel", d.tel, { type: "tel" })}
    ${fsn("É batizado(a)?", pfx + "_batizado", d.batizado)}
    ${fsn("É católico(a)?", pfx + "_catolico", d.catolico)}
    ${fsn("Fez 1ª Eucaristia?", pfx + "_eucaristia", d.eucaristia)}
    <p class="hint">Condição necessária ao padrinho e à madrinha.</p>
    ${fsn("É crismado(a)?", pfx + "_crismado", d.crismado)}
    <p class="hint">Os dois padrinhos devem ser crismados.</p>
    ${fsn("É casado(a)?", pfx + "_casado", d.casado)}
    ${fsn("Casado(a) na Igreja Católica?", pfx + "_casado_igreja", d.casado_igreja)}
    <p class="hint">Casados só no civil ou em outra igreja não podem ser padrinhos (Cânon 874).</p>
    ${ft("Nome do cônjuge", pfx + "_conjuge", d.conjuge)}
    ${fsn("Frequenta outra religião que não a católica?", pfx + "_outra_religiao", d.outra_religiao)}
    ${fsn("Frequenta Missa aos domingos?", pfx + "_missa_domingo", d.missa_domingo)}
    ${ft("Se em outra igreja, qual?", pfx + "_missa_qual", d.missa_qual)}
  </section>`;
}

// Seção de documentos (aparece depois que a inscrição foi salva). Cada tipo
// aceita 1+ arquivos (padrinho e madrinha, por ex.). Upload é assíncrono
// (fetch) p/ não perder o formulário. Miniatura + remover p/ cada anexo.
function secaoDocumentos(reg) {
  const docs = reg.documentos || [];
  const itens = DOCUMENTOS.map(tp => {
    const enviados = docs.filter(d => d.tipo === tp.id);
    const lista = enviados.map(d => {
      const url = `/psj/b/${reg.token}/doc/${d.id}`;
      const thumb = d.mime === "application/pdf"
        ? `<a href="${url}" target="_blank" class="pdf">📄 ${esc(d.nome || "documento.pdf")}</a>`
        : `<a href="${url}" target="_blank"><img src="${url}" alt=""></a>`;
      return `<div class="anexo">${thumb}
        <button type="button" class="rm" onclick="removerDoc('${reg.token}',${d.id})">remover</button></div>`;
    }).join("");
    return `<div class="doc">
      <div class="doc-cab"><b>${esc(tp.label)}</b>${enviados.length ? ` <span class="cnt">${enviados.length}</span>` : ""}</div>
      <div class="anexos">${lista}</div>
      <label class="add">➕ Anexar foto ou PDF
        <input type="file" accept="image/*,application/pdf" capture="environment"
          onchange="enviarDoc('${reg.token}','${tp.id}',this)" hidden>
      </label>
    </div>`;
  }).join("");

  return `<section id="documentos">
    <h2>Documentos</h2>
    <p class="hint">Anexe uma foto legível (ou PDF) de cada documento. Pode enviar mais de um por item (padrinho e madrinha). A secretaria confere e avisa se faltar algo.</p>
    ${itens}
  </section>
  <div id="ov" class="ov"><div class="ov-box">Enviando documento...</div></div>
  <script>
  async function enviarDoc(token, tipo, input){
    var f = input.files[0]; if(!f) return;
    document.getElementById('ov').style.display='flex';
    try{
      var dataUrl = await comprimir(f);
      var r = await fetch('/psj/b/'+token+'/doc', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:tipo,nome:f.name,dataUrl:dataUrl})});
      var j = await r.json();
      if(j.ok){ location.reload(); } else { alert(j.erro||'Falha ao enviar.'); document.getElementById('ov').style.display='none'; }
    }catch(e){ alert('Não consegui ler o arquivo.'); document.getElementById('ov').style.display='none'; }
  }
  async function removerDoc(token, id){
    if(!confirm('Remover este anexo?')) return;
    var r = await fetch('/psj/b/'+token+'/doc-excluir', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id})});
    if((await r.json()).ok) location.reload(); else alert('Falha ao remover.');
  }
  // Comprime imagem no navegador (máx 1400px, JPEG) p/ subir leve. PDF/arquivo
  // vai como está.
  function comprimir(file){
    return new Promise(function(res,rej){
      if(!file.type || file.type.indexOf('image/')!==0){
        var fr0=new FileReader(); fr0.onload=function(){res(fr0.result)}; fr0.onerror=rej; fr0.readAsDataURL(file); return;
      }
      var fr=new FileReader();
      fr.onload=function(){ var img=new Image();
        img.onload=function(){ var max=1400,w=img.width,h=img.height;
          if(w>max||h>max){var s=Math.min(max/w,max/h); w=Math.round(w*s); h=Math.round(h*s);}
          var c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          res(c.toDataURL('image/jpeg',0.72));
        }; img.onerror=rej; img.src=fr.result;
      }; fr.onerror=rej; fr.readAsDataURL(file);
    });
  }
  </script>`;
}

function paginaForm(token, msg, erro) {
  const reg = acharPorToken(token);
  if (!reg) {
    return `<!doctype html><meta charset="utf-8">${estiloForm()}<div class="wrap"><section>
      <h1>Link inválido</h1><p>Este link de inscrição não foi encontrado ou expirou. Procure a secretaria da paróquia. 🙏</p></section></div>`;
  }
  if (reg.status !== "convite" && !erro && !msg) {
    // Já preenchido: confirma e deixa reenviar (correção).
    msg = "Recebemos a sua inscrição. Se precisar corrigir algo, altere abaixo e envie de novo.";
  }
  const d = reg;
  const datas = proximasDatas(12);
  const opcoesData = datas.map(x =>
    `<option value="${esc(x.data + "|" + x.local)}" ${d.batismo_data === x.data && d.batismo_local === x.local ? "selected" : ""}>${esc(x.rotulo)} - ${esc(x.local)}</option>`).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inscrição de Batismo - Paróquia São José</title>${estiloForm()}</head><body>
<div class="wrap">
<h1>⛪ Inscrição de Batismo</h1>
<p class="sub">Paróquia São José <span class="tag">bancada de teste - use dados fictícios</span></p>
${erro ? `<p class="erro">${esc(erro)}</p>` : ""}
${msg ? `<p class="ok">${esc(msg)}</p>` : ""}
<form method="post" action="/psj/b/${esc(token)}">

<section>
  <h2>Data desejada</h2>
  <label>Escolha a data e o local do batismo *</label>
  <select name="batismo" required><option value="">Selecione...</option>${opcoesData}</select>
  <p class="hint">O batismo é comunitário e sempre às 10h. O preenchimento não garante a reserva: ela se confirma na secretaria.</p>
</section>

<section>
  <h2>Dados da criança</h2>
  ${ft("Nome da criança", "crianca_nome", d.crianca_nome, { req: true })}
  <div class="lin">
    <div>${ft("Data de nascimento", "crianca_nascimento", d.crianca_nascimento, { type: "date", req: true })}</div>
  </div>
  <div class="lin">
    <div>${ft("Cidade de nascimento", "crianca_cidade", d.crianca_cidade)}</div>
    <div style="max-width:90px">${ft("UF", "crianca_uf", d.crianca_uf)}</div>
  </div>
  ${ft("Naturalidade", "crianca_natural", d.crianca_natural)}
</section>

<section>
  <h2>Pais</h2>
  ${ft("Nome do pai", "pai_nome", d.pai_nome)}
  ${ft("Telefone do pai", "pai_tel", d.pai_tel, { type: "tel" })}
  ${ft("Nome da mãe", "mae_nome", d.mae_nome)}
  ${ft("Telefone da mãe", "mae_tel", d.mae_tel, { type: "tel" })}
  <div class="lin">
    <div style="flex:3">${ft("Endereço", "endereco", d.endereco)}</div>
    <div>${ft("Nº", "numero", d.numero)}</div>
  </div>
  ${ft("Bairro", "bairro", d.bairro)}
  <div class="lin">
    <div>${ft("Cidade", "cidade", d.cidade)}</div>
    <div>${ft("CEP", "cep", d.cep)}</div>
  </div>
  ${ft("Paróquia que os pais frequentam", "paroquia_frequentam", d.paroquia_frequentam)}
  ${fsn("Os pais são casados?", "pais_casados", d.pais_casados)}
  ${fsn("Casados na Igreja Católica?", "pais_casados_igreja", d.pais_casados_igreja)}
</section>

${blocoPadrinho("Padrinho", "padrinho", {
  nome: d.padrinho_nome, tel: d.padrinho_tel, batizado: d.padrinho_batizado,
  catolico: d.padrinho_catolico, eucaristia: d.padrinho_eucaristia, crismado: d.padrinho_crismado,
  casado: d.padrinho_casado, casado_igreja: d.padrinho_casado_igreja, conjuge: d.padrinho_conjuge,
  outra_religiao: d.padrinho_outra_religiao, missa_domingo: d.padrinho_missa_domingo, missa_qual: d.padrinho_missa_qual
})}

${blocoPadrinho("Madrinha", "madrinha", {
  nome: d.madrinha_nome, tel: d.madrinha_tel, batizado: d.madrinha_batizado,
  catolico: d.madrinha_catolico, eucaristia: d.madrinha_eucaristia, crismado: d.madrinha_crismado,
  casado: d.madrinha_casado, casado_igreja: d.madrinha_casado_igreja, conjuge: d.madrinha_conjuge,
  outra_religiao: d.madrinha_outra_religiao, missa_domingo: d.madrinha_missa_domingo, missa_qual: d.madrinha_missa_qual
})}

<button type="submit">${reg.status === "convite" ? "Enviar inscrição" : "Salvar alterações"}</button>
</form>
${reg.status !== "convite" ? secaoDocumentos(reg)
  : `<p class="hint" style="text-align:center;margin-top:.6rem">Depois de enviar, você poderá anexar os documentos aqui mesmo. A assinatura entra na próxima etapa.</p>`}
</div></body></html>`;
}

// Salva o POST do formulário público.
function processarPost(token, body) {
  const reg = acharPorToken(token);
  if (!reg) return { erro: "Link inválido." };
  if (!body.crianca_nome || !body.batismo) {
    return { erro: "Informe ao menos o nome da criança e a data desejada." };
  }
  const [batismo_data, batismo_local] = String(body.batismo).split("|");
  const dados = { batismo_data, batismo_local };
  // copia todos os campos conhecidos (texto e sim/não) direto do form
  for (const k of Object.keys(body)) {
    if (k === "batismo" || k === "s") continue;
    dados[k] = typeof body[k] === "string" ? body[k].trim() : body[k];
  }
  salvarPreenchimento(token, dados);
  return { ok: true };
}

module.exports = {
  proximasDatas, gerarConvite, acharPorToken, lerInscricoes,
  salvarPreenchimento, removerInscricao, linkDoToken,
  paginaForm, processarPost, esc,
  DOCUMENTOS, DOC_LABEL, salvarDoc, removerDoc, arquivoDoc
};
