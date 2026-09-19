const medicaoRepository = require("../repositories/medicaoRepository");

const registrarOuAtualizarMedicao = async ({ id, ciclo_id, servico_id, usuario_id, quantidade_medida_periodo }) => {
  const servico = await medicaoRepository.buscarServicoPorId(servico_id);
  if (!servico) throw new Error("Serviço não encontrado");

  const medicaoAnterior = await medicaoRepository.buscarUltimaMedicao(servico_id, ciclo_id);

  const qtdAnterior = medicaoAnterior ? Number(medicaoAnterior.quantidade_acumulada_atual) : 0;
  const valAnterior = medicaoAnterior ? Number(medicaoAnterior.valor_acumulado_atual) : 0;

  const qtdOrcada = Number(servico.quantidade_orcada);
  const precoUnitario = Number(servico.preco_unitario);
  const qtdPeriodo = Number(quantidade_medida_periodo);

  const qtdAcumuladaAtual = qtdAnterior + qtdPeriodo;
  const saldoQtd = qtdOrcada - qtdAcumuladaAtual;

  const valMedidoPeriodo = qtdPeriodo * precoUnitario;
  const valAcumuladoAtual = valAnterior + valMedidoPeriodo;
  const pctExecucao = qtdOrcada > 0 ? (qtdAcumuladaAtual / qtdOrcada) * 100 : 0;

  return await medicaoRepository.salvarMedicao({
    id,
    ciclo_id,
    servico_id,
    usuario_id,
    quantidade_medida_periodo: qtdPeriodo,
    quantidade_acumulada_anterior: qtdAnterior,
    quantidade_acumulada_atual: qtdAcumuladaAtual,
    saldo_quantidade: saldoQtd,
    valor_medido_periodo: valMedidoPeriodo,
    valor_acumulado_anterior: valAnterior,
    valor_acumulado_atual: valAcumuladoAtual,
    percentual_execucao: pctExecucao
  });
};

module.exports = { registrarOuAtualizarMedicao };