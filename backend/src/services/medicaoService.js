const medicaoRepository = require("../repositories/medicaoRepository");
const {
  calcularMedicaoServico,
  paraDecimal,
  calcularPercentual,
  formatarDecimal,
} = require("../utils/precisionCalculo");
const { criarErro } = require("../utils/errorUtils");

/**
 * Valida a quantidade informada para o período.
 * Deve ser um número válido e maior ou igual a zero.
 */
const validarQuantidadePeriodo = (quantidade) => {
  if (quantidade === undefined || quantidade === null || quantidade === "") {
    throw criarErro("A quantidade medida no período é obrigatória.", 400);
  }

  try {
    const dec = paraDecimal(quantidade, "Quantidade medida no período");
    if (dec.isNegative()) {
      throw criarErro("A quantidade medida no período não pode ser negativa.", 400);
    }
    return dec;
  } catch (error) {
    if (error.statusCode) throw error;
    throw criarErro("A quantidade medida no período deve ser um valor numérico válido.", 400);
  }
};

/**
 * Registra ou atualiza a medição de um serviço em um ciclo.
 * Realiza validações de ciclo aberto, coerência de obra e cálculo de alta precisão.
 */
const registrarOuAtualizarMedicao = async ({
  id,
  ciclo_id,
  servico_id,
  usuario_id,
  quantidade_medida_periodo,
}) => {
  if (!ciclo_id) {
    throw criarErro("O ID do ciclo de medição é obrigatório.", 400);
  }
  if (!servico_id) {
    throw criarErro("O ID do serviço é obrigatório.", 400);
  }
  if (!usuario_id) {
    throw criarErro("O ID do usuário responsável pela medição é obrigatório.", 400);
  }

  // 1. Validação de formato da quantidade medida
  validarQuantidadePeriodo(quantidade_medida_periodo);

  // 2. Validação da existência e status do ciclo
  const ciclo = await medicaoRepository.buscarCicloPorId(ciclo_id);
  if (!ciclo) {
    throw criarErro("Ciclo de medição não encontrado.", 404);
  }
  if (ciclo.status !== "aberto") {
    throw criarErro("Não é possível registrar ou alterar medições em um ciclo encerrado.", 400);
  }

  // 3. Validação do serviço e pertinência à obra
  const servico = await medicaoRepository.buscarServicoPorId(servico_id);
  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }
  if (servico.obra_id !== ciclo.obra_id) {
    throw criarErro("O serviço informado não pertence à obra deste ciclo de medição.", 400);
  }

  // 4. Busca da medição imediatamente anterior (ciclos anteriores ao atual)
  const medicaoAnterior = await medicaoRepository.buscarUltimaMedicao(servico_id, ciclo.numero_ciclo);
  const qtdAnterior = medicaoAnterior ? medicaoAnterior.quantidade_acumulada_atual : "0.0000";
  const valAnterior = medicaoAnterior ? medicaoAnterior.valor_acumulado_atual : "0.0000";

  // 5. Execução dos cálculos com representação numérica exata (preserva precisão da planilha)
  const calculos = calcularMedicaoServico({
    quantidadePeriodo: quantidade_medida_periodo,
    quantidadeAnterior: qtdAnterior,
    valorAnterior: valAnterior,
    quantidadeOrcada: servico.quantidade_orcada,
    precoUnitario: servico.preco_unitario,
  });

  // 6. Persistência dos dados calculados
  const medicaoSalva = await medicaoRepository.salvarMedicao({
    id,
    ciclo_id,
    servico_id,
    usuario_id,
    quantidade_medida_periodo: calculos.quantidade_medida_periodo,
    quantidade_acumulada_anterior: calculos.quantidade_acumulada_anterior,
    quantidade_acumulada_atual: calculos.quantidade_acumulada_atual,
    saldo_quantidade: calculos.saldo_quantidade,
    valor_medido_periodo: calculos.valor_medido_periodo,
    valor_acumulado_anterior: calculos.valor_acumulado_anterior,
    valor_acumulado_atual: calculos.valor_acumulado_atual,
    percentual_execucao: calculos.percentual_execucao,
  });

  // 7. Consolidação automática do progresso do serviço, etapa e obra
  let progressoEtapa = null;
  let progressoObra = null;

  try {
    if (typeof medicaoRepository.calcularProgressoObraEEtapa === "function") {
      const progressoConsolidado = await medicaoRepository.calcularProgressoObraEEtapa(
        ciclo.obra_id,
        servico.etapa_id,
        ciclo.id
      );

      if (progressoConsolidado) {
        progressoObra = {
          obra_id: progressoConsolidado.obra_id,
          nome: progressoConsolidado.obra_nome,
          percentual_execucao: parseFloat(
            calcularPercentual(
              progressoConsolidado.valor_executado_obra,
              progressoConsolidado.valor_orcado_obra,
              2
            )
          ),
          valor_executado_total: parseFloat(
            formatarDecimal(progressoConsolidado.valor_executado_obra, 2)
          ),
          valor_orcado_total: parseFloat(
            formatarDecimal(progressoConsolidado.valor_orcado_obra, 2)
          ),
        };

        if (progressoConsolidado.etapa_id) {
          progressoEtapa = {
            etapa_id: progressoConsolidado.etapa_id,
            nome: progressoConsolidado.etapa_nome,
            percentual_execucao: parseFloat(
              calcularPercentual(
                progressoConsolidado.valor_executado_etapa,
                progressoConsolidado.valor_orcado_etapa,
                2
              )
            ),
            valor_executado: parseFloat(
              formatarDecimal(progressoConsolidado.valor_executado_etapa, 2)
            ),
            valor_orcado: parseFloat(
              formatarDecimal(progressoConsolidado.valor_orcado_etapa, 2)
            ),
          };
        }
      }
    }
  } catch (err) {
    // Permite que o registro da medição conclua caso a agregação enfrente indisponibilidade temporária
  }

  return {
    ...medicaoSalva,
    superou_orcamento: calculos.superou_orcamento,
    alerta: calculos.superou_orcamento
      ? "Atenção: A quantidade acumulada medida supera a quantidade prevista na planilha orçamentária."
      : null,
    servico: {
      id: servico.id,
      codigo_servico: servico.codigo_servico,
      descricao: servico.descricao,
      unidade_medida: servico.unidade_medida,
      quantidade_orcada: servico.quantidade_orcada,
      preco_unitario: servico.preco_unitario,
      preco_total: servico.preco_total,
    },
    progresso: {
      servico: {
        id: servico.id,
        codigo_servico: servico.codigo_servico,
        percentual_execucao: parseFloat(calculos.percentual_execucao),
        quantidade_acumulada_atual: calculos.quantidade_acumulada_atual,
        saldo_quantidade: calculos.saldo_quantidade,
        valor_acumulado_atual: calculos.valor_acumulado_atual,
      },
      etapa: progressoEtapa,
      obra: progressoObra,
    },
  };
};

/**
 * Obtém os dados orçamentários, histórico acumulado anterior e medição atual do serviço no ciclo.
 * Ideal para carregar formulários de entrada de medição no frontend/mobile.
 */
const obterDadosParaMedicao = async (servico_id, ciclo_id) => {
  if (!servico_id || !ciclo_id) {
    throw criarErro("IDs de serviço e ciclo são obrigatórios.", 400);
  }

  const ciclo = await medicaoRepository.buscarCicloPorId(ciclo_id);
  if (!ciclo) {
    throw criarErro("Ciclo de medição não encontrado.", 404);
  }

  const servico = await medicaoRepository.buscarServicoPorId(servico_id);
  if (!servico) {
    throw criarErro("Serviço não encontrado.", 404);
  }

  if (servico.obra_id !== ciclo.obra_id) {
    throw criarErro("O serviço informado não pertence à obra deste ciclo de medição.", 400);
  }

  // Medição do ciclo anterior
  const medicaoAnterior = await medicaoRepository.buscarUltimaMedicao(servico_id, ciclo.numero_ciclo);
  const qtdAnterior = medicaoAnterior ? medicaoAnterior.quantidade_acumulada_atual : "0.0000";
  const valAnterior = medicaoAnterior ? medicaoAnterior.valor_acumulado_atual : "0.0000";

  // Medição já registrada no ciclo atual, se houver
  const medicaoAtual = await medicaoRepository.buscarMedicaoAtual(servico_id, ciclo_id);

  return {
    ciclo: {
      id: ciclo.id,
      numero_ciclo: ciclo.numero_ciclo,
      status: ciclo.status,
      obra_id: ciclo.obra_id,
    },
    servico: {
      id: servico.id,
      codigo_servico: servico.codigo_servico,
      descricao: servico.descricao,
      unidade_medida: servico.unidade_medida,
      quantidade_orcada: servico.quantidade_orcada,
      preco_unitario: servico.preco_unitario,
      preco_total: servico.preco_total,
    },
    acumulado_anterior: {
      quantidade_acumulada_anterior: qtdAnterior,
      valor_acumulado_anterior: valAnterior,
    },
    medicao_atual: medicaoAtual,
  };
};

/**
 * Lista todas as medições de um ciclo com consolidação financeira.
 */
const listarMedicoesCiclo = async (ciclo_id) => {
  if (!ciclo_id) {
    throw criarErro("ID do ciclo de medição é obrigatório.", 400);
  }

  const ciclo = await medicaoRepository.buscarCicloPorId(ciclo_id);
  if (!ciclo) {
    throw criarErro("Ciclo de medição não encontrado.", 404);
  }

  const medicoes = await medicaoRepository.listarMedicoesPorCiclo(ciclo_id);

  return {
    ciclo: {
      id: ciclo.id,
      numero_ciclo: ciclo.numero_ciclo,
      status: ciclo.status,
      obra_id: ciclo.obra_id,
    },
    total_itens: medicoes.length,
    medicoes,
  };
};

module.exports = {
  validarQuantidadePeriodo,
  registrarOuAtualizarMedicao,
  obterDadosParaMedicao,
  listarMedicoesCiclo,
};