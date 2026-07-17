// services/paroquiaCalendario.js
// Núcleo do CALENDÁRIO PAROQUIAL editável (bancada de teste Rapha Lumen).
//
// O calendário NÃO é fixo e NÃO é só a matriz: é a paróquia toda (matriz +
// capelas) e a secretaria edita. Guardado num arquivo isolado (migra p/ o
// Postgres/tabelas missas_calendario, missas_excecoes, missas_periodos depois).
//
// O calendário real de um dia =
//   PADRÃO recorrente por local (respeitando vigência)
//   - EXCEÇÕES "cancelada" (feriado sem missa à noite)
//   + EXCEÇÕES "extra" (aniversário do padre: missa fora do padrão)
//   aplicando PERÍODOS (suspende_locais = capelas na cirurgia; so_local = festa
//   de capela, concentra numa e suspende as outras).

const fs = require("fs");
const path = require("path");

const DIR_DADOS = fs.existsSync("/data") ? "/data" : __dirname;
const ARQ = path.join(DIR_DADOS, "psj-calendario.json");

// Padrão inicial (matriz + capelas), do que a Maju mandou. dia: 0=dom..6=sáb.
// intencao = a missa aceita intenção pelo chat? (matriz sim, capela não).
const PADRAO_SEED = [
  // Matriz São José
  { local: "Matriz São José", dia: 1, hora: "07:00", intencao: true },
  { local: "Matriz São José", dia: 2, hora: "07:00", intencao: true },
  { local: "Matriz São José", dia: 2, hora: "19:30", intencao: true },
  { local: "Matriz São José", dia: 3, hora: "07:00", intencao: true },
  { local: "Matriz São José", dia: 3, hora: "19:30", intencao: true },
  { local: "Matriz São José", dia: 4, hora: "07:00", intencao: true },
  { local: "Matriz São José", dia: 4, hora: "19:30", intencao: true },
  { local: "Matriz São José", dia: 5, hora: "07:00", intencao: true },
  { local: "Matriz São José", dia: 5, hora: "19:30", intencao: true },
  { local: "Matriz São José", dia: 0, hora: "10:00", intencao: true },
  { local: "Matriz São José", dia: 0, hora: "19:30", intencao: true },
  // Capela N. Sra. do Bonsucesso
  { local: "Capela N. Sra. do Bonsucesso", dia: 2, hora: "19:00", intencao: false },
  { local: "Capela N. Sra. do Bonsucesso", dia: 0, hora: "08:00", intencao: false },
  // Capela Santa Teresinha
  { local: "Capela Santa Teresinha", dia: 3, hora: "19:00", intencao: false },
  { local: "Capela Santa Teresinha", dia: 6, hora: "19:30", intencao: false },
  { local: "Capela Santa Teresinha", dia: 0, hora: "11:00", intencao: false },
  // Capela N. Sra. da Penha
  { local: "Capela N. Sra. da Penha", dia: 4, hora: "19:00", intencao: false },
  { local: "Capela N. Sra. da Penha", dia: 6, hora: "17:30", intencao: false },
  // Capela Santo Antônio
  { local: "Capela Santo Antônio", dia: 0, hora: "17:30", intencao: false }
];

const LOCAIS = [...new Set(PADRAO_SEED.map(p => p.local))];

function lerCalendario() {
  try {
    return JSON.parse(fs.readFileSync(ARQ, "utf8"));
  } catch {
    return { padrao: PADRAO_SEED, excecoes: [], periodos: [] };
  }
}

function salvarCalendario(cal) {
  try { fs.writeFileSync(ARQ, JSON.stringify(cal, null, 2)); }
  catch (e) { console.error("🚨 [psj-cal] Falha ao salvar:", e.message); }
}

// ---- helpers de data ----
function isoData(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function dentro(dataIso, inicio, fim) {
  return dataIso >= inicio && dataIso <= fim;
}

// ---------------------------------------------------------------------------
// Gera as ocorrências de missa de um período (a partir de `agora`, `dias` à
// frente), aplicando padrão + vigência + períodos + exceções.
// Cada item: { iso (Date), data, hora, local, intencao }
// ---------------------------------------------------------------------------
function gerarMissas(agora, dias) {
  const cal = lerCalendario();
  const out = [];

  for (let d = 0; d <= dias; d++) {
    const base = new Date(agora);
    base.setDate(agora.getDate() + d);
    const dow = base.getDay();
    const dataStr = isoData(base);

    // períodos que cobrem este dia
    const pers = (cal.periodos || []).filter(p => dentro(dataStr, p.inicio, p.fim));
    const suspenso = (local) => pers.some(p =>
      (p.escopo === "suspende_locais" && p.locais.includes(local)) ||
      (p.escopo === "so_local" && !p.locais.includes(local))
    );

    // padrão do dia (respeita vigência)
    (cal.padrao || [])
      .filter(p => p.dia === dow)
      .filter(p => !p.vigencia_inicio || dataStr >= p.vigencia_inicio)
      .filter(p => !p.vigencia_fim || dataStr <= p.vigencia_fim)
      .forEach(p => {
        if (suspenso(p.local)) return;
        // cancelada por exceção?
        const cancel = (cal.excecoes || []).some(e =>
          e.tipo === "cancelada" && e.data === dataStr && e.hora === p.hora && e.local === p.local);
        if (cancel) return;
        push(out, base, p.hora, p.local, p.intencao);
      });

    // extras deste dia (mesmo em local suspenso: a extra é uma decisão explícita)
    (cal.excecoes || [])
      .filter(e => e.tipo === "extra" && e.data === dataStr)
      .forEach(e => push(out, base, e.hora, e.local, e.intencao));
  }

  out.sort((a, b) => a.iso - b.iso);
  return out;
}

function push(out, base, hora, local, intencao) {
  const [h, mi] = hora.split(":").map(Number);
  const dt = new Date(base);
  dt.setHours(h, mi, 0, 0);
  out.push({ iso: dt, data: isoData(dt), hora, local, intencao: !!intencao });
}

// ---------------------------------------------------------------------------
// Edições da secretaria (usadas pela tela web)
// ---------------------------------------------------------------------------
function proximoId(arr) {
  return arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
}

function adicionarExcecao({ data, hora, local, tipo, intencao, motivo }) {
  const cal = lerCalendario();
  cal.excecoes = cal.excecoes || [];
  cal.excecoes.push({
    id: proximoId(cal.excecoes),
    data, hora, local, tipo,
    intencao: tipo === "extra" ? !!intencao : undefined,
    motivo: motivo || ""
  });
  salvarCalendario(cal);
}

function adicionarPeriodo({ inicio, fim, escopo, locais, motivo }) {
  const cal = lerCalendario();
  cal.periodos = cal.periodos || [];
  cal.periodos.push({
    id: proximoId(cal.periodos),
    inicio, fim, escopo,
    locais: Array.isArray(locais) ? locais : [locais],
    motivo: motivo || ""
  });
  salvarCalendario(cal);
}

function removerExcecao(id) {
  const cal = lerCalendario();
  cal.excecoes = (cal.excecoes || []).filter(e => e.id !== Number(id));
  salvarCalendario(cal);
}

function removerPeriodo(id) {
  const cal = lerCalendario();
  cal.periodos = (cal.periodos || []).filter(p => p.id !== Number(id));
  salvarCalendario(cal);
}

module.exports = {
  LOCAIS,
  lerCalendario,
  gerarMissas,
  adicionarExcecao,
  adicionarPeriodo,
  removerExcecao,
  removerPeriodo,
  isoData
};
