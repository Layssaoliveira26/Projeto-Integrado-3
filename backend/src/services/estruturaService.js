const estruturaRepository = require("../repositories/estruturaRepository");

async function obterEstruturaAcompanhamento(obraId, cicloIdParam) {
  let ciclo = null;

  if (cicloIdParam) {
    ciclo = { id: cicloIdParam };
  } else {
    ciclo = await estruturaRepository.buscarCicloAtivo(obraId);
  }

  const cicloId = ciclo ? ciclo.id : null;
  const linhas = await estruturaRepository.buscarEstruturaAcompanhamento(obraId, cicloId);

  if (!linhas || linhas.length === 0) {
    return null;
  }

  let valorOrcadoObra = 0;
  let valorExecutadoObra = 0;
  const etapasMap = new Map();

  linhas.forEach((linha) => {
    const precoTotalServico = parseFloat(linha.servico_preco_total) || 0;
    const valorExecutadoServico = parseFloat(linha.valor_acumulado_atual) || 0;

    valorOrcadoObra += precoTotalServico;
    valorExecutadoObra += valorExecutadoServico;

    if (!etapasMap.has(linha.etapa_id)) {
      etapasMap.set(linha.etapa_id, {
        id: linha.etapa_id,
        nome: linha.etapa_nome,
        ordem: linha.etapa_ordem,
        total_servicos: 0,
        valor_orcado_etapa: 0,
        valor_executado_etapa: 0,
        progresso_etapa_percentual: 0,
        servicos: []
      });
    }

    const etapa = etapasMap.get(linha.etapa_id);
    etapa.total_servicos += 1;
    etapa.valor_orcado_etapa += precoTotalServico;
    etapa.valor_executado_etapa += valorExecutadoServico;

    etapa.servicos.push({
      id: linha.servico_id,
      codigo_servico: linha.codigo_servico,
      descricao: linha.servico_descricao,
      unidade_medida: linha.unidade_medida,
      preco_total_orcado: precoTotalServico,
      valor_acumulado_atual: valorExecutadoServico,
      percentual_execucao: parseFloat(linha.percentual_execucao) || 0
    });
  });

  const etapas = Array.from(etapasMap.values()).map((etapa) => {
    const progressoEtapa = etapa.valor_orcado_etapa > 0
      ? (etapa.valor_executado_etapa / etapa.valor_orcado_etapa) * 100
      : 0;

    return {
      ...etapa,
      progresso_etapa_percentual: parseFloat(progressoEtapa.toFixed(2))
    };
  });

  const progressoGeral = valorOrcadoObra > 0
    ? (valorExecutadoObra / valorOrcadoObra) * 100
    : 0;

  return {
    obra_id: linhas[0].obra_id,
    nome: linhas[0].obra_nome,
    ciclo_ativo: ciclo,
    progresso_geral_percentual: parseFloat(progressoGeral.toFixed(2)),
    valor_executado_total: parseFloat(valorExecutadoObra.toFixed(2)),
    valor_orcado_total: parseFloat(valorOrcadoObra.toFixed(2)),
    etapas
  };
}

module.exports = {
  obterEstruturaAcompanhamento
};