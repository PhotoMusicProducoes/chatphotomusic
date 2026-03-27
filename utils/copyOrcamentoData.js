/**
 * Copia os dados coletados no fluxo de orçamento para o serviço específico
 * Inclui a duração CALCULADA do evento
 */
function copyOrcamentoData(session, serviceName) {
  if (!session[serviceName]) {
    session[serviceName] = {};
  }

  // Verifica se o orçamento foi completado
  if (session.orcamento && session.orcamento.completo) {
    // Copia TODOS os dados coletados
    session[serviceName].nomeCliente = session.orcamento.nomeCliente;
    session[serviceName].horarioInicio = session.orcamento.horarioInicio;
    session[serviceName].horarioTermino = session.orcamento.horarioTermino;
    session[serviceName].duracao = session.orcamento.duracao; // ⏱️ DURAÇÃO CALCULADA
    session[serviceName].quantidadeConvidados = session.orcamento.quantidadeConvidados;
    session[serviceName].endereco = session.orcamento.endereco;
    
    console.log(`✅ Dados copiados para ${serviceName}:`, {
      duracao: session[serviceName].duracao,
      horarioInicio: session[serviceName].horarioInicio,
      horarioTermino: session[serviceName].horarioTermino
    });
  }
}

module.exports = { copyOrcamentoData };

