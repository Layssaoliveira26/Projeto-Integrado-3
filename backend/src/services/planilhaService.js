const Decimal = require("decimal.js");
const planilhaRepository = require("../repositories/planilhaRepository");

// Configuração decimal com precisão e arredondamento financeiro
const PrecisionDecimal = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 28,
});

const UNIDADES_INTEIRAS = [
  "un",
  "und",
  "unid",
  "unidade",
  "cj",
  "conjunto",
  "pt",
  "ponto",
  "vb",
  "verba",
  "pc",
  "peca",
  "peça"
];

function criarErro(mensagem, status = 400) {
  const erro = new Error(mensagem);
  erro.status = status;
  erro.statusCode = status;
  return erro;
}

/**
 * Converte e sanitiza números (suporta strings formatadas em pt-BR como "1.250,50" ou "R$ 300,00").
 */
function sanitizarNumero(valor, nomeCampo = "Valor") {
  if (valor === null || valor === undefined || valor === "") {
    throw criarErro(`O campo "${nomeCampo}" é obrigatório e não pode ser vazio.`, 400);
  }

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) {
      throw criarErro(`O campo "${nomeCampo}" possui um valor numérico inválido: ${valor}`, 400);
    }
    return new PrecisionDecimal(valor);
  }

  if (typeof valor === "string") {
    let limpo = valor.trim().replace(/^R\$\s*/i, "");
    if (limpo.includes(",") && limpo.includes(".")) {
      if (limpo.lastIndexOf(",") > limpo.lastIndexOf(".")) {
        // Padrão pt-BR: 1.234,56 (ponto milhar, vírgula decimal)
        limpo = limpo.replace(/\./g, "").replace(",", ".");
      } else {
        // Padrão en-US / SEOBRA: 1,234.56 (vírgula milhar, ponto decimal)
        limpo = limpo.replace(/,/g, "");
      }
    } else if (limpo.includes(",")) {
      limpo = limpo.replace(",", ".");
    }
    limpo = limpo.replace(/[^0-9.-]/g, "");

    try {
      const dec = new PrecisionDecimal(limpo);
      if (!dec.isFinite()) {
        throw new Error();
      }
      return dec;
    } catch {
      throw criarErro(`O campo "${nomeCampo}" possui um valor numérico inválido: "${valor}"`, 400);
    }
  }

  if (valor instanceof Decimal) {
    return valor;
  }

  throw criarErro(`Tipo de dado inválido para o campo "${nomeCampo}".`, 400);
}

/**
 * Valida se a unidade de medida requer quantidade inteira.
 */
function validarUnidadeInteira(unidade, quantidadeDecimal, codigoServico) {
  const limpa = (unidade || "").trim().toLowerCase();
  if (UNIDADES_INTEIRAS.includes(limpa) && quantidadeDecimal.decimalPlaces() > 0) {
    throw criarErro(
      `Para o serviço "${codigoServico}" com unidade inteira (${unidade}), a quantidade orçada não pode conter casas decimais fracionárias.`,
      400
    );
  }
}

/**
 * Importa a planilha-base tratando os dados orçamentários e persistindo em transação atômica.
 */
async function importarPlanilhaBase({ obraId, usuarioId, nomeArquivo, etapas, totais_rodape, totaisRodape }) {
  if (!obraId) {
    throw criarErro("ID da obra não informado.", 400);
  }

  const rodape = totais_rodape || totaisRodape || {};

  // 1. Validação da obra e permissão do usuário
  const obra = await planilhaRepository.buscarObraComPermissao(obraId, usuarioId);
  if (!obra) {
    throw criarErro("Obra não encontrada ou você não tem permissão para acessá-la.", 404);
  }

  // 2. Proteção de histórico: verifica se a obra já possui medições registradas
  const temMedicoes = await planilhaRepository.verificarMedicoesExistentes(obraId);
  if (temMedicoes) {
    throw criarErro(
      "Esta obra já possui medições registradas. Não é possível sobrescrever a planilha orçamentária base para preservar a integridade histórica.",
      409
    );
  }

  // 3. Validação da estrutura de etapas
  if (!Array.isArray(etapas) || etapas.length === 0) {
    throw criarErro("A planilha deve conter pelo menos uma etapa com serviços.", 400);
  }

  const codigosExistentes = new Set();
  const etapasTratadas = [];
  let totalOrcamento = new PrecisionDecimal(0);
  let totalServicosCount = 0;

  for (let i = 0; i < etapas.length; i++) {
    const etapaRaw = etapas[i];
    const nomeEtapa = (etapaRaw.nome || "").trim();

    if (!nomeEtapa) {
      throw criarErro(`A etapa no índice ${i + 1} precisa ter um nome válido.`, 400);
    }

    if (!Array.isArray(etapaRaw.servicos) || etapaRaw.servicos.length === 0) {
      throw criarErro(`A etapa "${nomeEtapa}" deve conter pelo menos um serviço.`, 400);
    }

    const servicosTratados = [];

    for (let j = 0; j < etapaRaw.servicos.length; j++) {
      const sRaw = etapaRaw.servicos[j];
      const codigo = String(sRaw.codigo_servico || sRaw.codigo || "").trim();
      const descricao = (sRaw.descricao || "").trim();
      const unidade = (sRaw.unidade_medida || sRaw.unidade || "").trim().toUpperCase();

      if (!codigo) {
        throw criarErro(`Serviço no índice ${j + 1} da etapa "${nomeEtapa}" está sem código de serviço.`, 400);
      }

      if (codigosExistentes.has(codigo)) {
        throw criarErro(
          `Código de serviço duplicado na planilha: "${codigo}". Cada serviço na obra deve ter um código único.`,
          400
        );
      }
      codigosExistentes.add(codigo);

      if (!descricao) {
        throw criarErro(`O serviço de código "${codigo}" deve ter uma descrição válida.`, 400);
      }

      if (!unidade) {
        throw criarErro(`O serviço de código "${codigo}" deve ter uma unidade de medida informada.`, 400);
      }

      const qtdDec = sanitizarNumero(sRaw.quantidade_orcada ?? sRaw.quantidade, `Quantidade do serviço ${codigo}`);
      if (qtdDec.lte(0)) {
        throw criarErro(`A quantidade orçada do serviço "${codigo}" deve ser maior que zero.`, 400);
      }

      validarUnidadeInteira(unidade, qtdDec, codigo);

      let precoUnitDec = sanitizarNumero(sRaw.preco_unitario ?? sRaw.valor_unitario ?? 0, `Preço unitário do serviço ${codigo}`);
      if (precoUnitDec.lt(0)) {
        throw criarErro(`O preço unitário do serviço "${codigo}" não pode ser negativo.`, 400);
      }

      let precoTotalDec = qtdDec.times(precoUnitDec);

      // Prioriza o preço total informado na planilha para manter precisão idêntica ao orçamento padrão
      if (sRaw.preco_total) {
        try {
          const ptDec = sanitizarNumero(sRaw.preco_total, `Preço total do serviço ${codigo}`);
          if (ptDec.gt(0)) {
            precoTotalDec = ptDec;
            if (precoUnitDec.isZero()) {
              precoUnitDec = ptDec.dividedBy(qtdDec);
            }
          }
        } catch {
          // Mantém valor calculado
        }
      }

      totalOrcamento = totalOrcamento.plus(precoTotalDec);
      totalServicosCount += 1;

      servicosTratados.push({
        codigoServico: codigo,
        descricao,
        fonteOrigem: (sRaw.fonte_origem || sRaw.fonte || null)?.trim() || null,
        unidadeMedida: unidade,
        quantidadeOrcada: qtdDec.toFixed(4),
        precoUnitario: precoUnitDec.toFixed(4),
        precoTotal: precoTotalDec.toFixed(4),
        ordem: typeof sRaw.ordem === "number" ? sRaw.ordem : j + 1
      });
    }

    etapasTratadas.push({
      nome: nomeEtapa,
      ordem: typeof etapaRaw.ordem === "number" ? etapaRaw.ordem : i + 1,
      preco_total: etapaRaw.preco_total || null,
      servicos: servicosTratados
    });
  }

  if (totalServicosCount === 0) {
    throw criarErro("Nenhum serviço válido encontrado na planilha.", 400);
  }

  // 4. Execução da persistência dentro de transação atômica no PostgreSQL
  const orcamentoTotalFinal = totalOrcamento.toFixed(2);

  // Se o rodapé da planilha continha VALOR ORÇAMENTO (custo direto) explícito:
  let orcamentoBaseObra = orcamentoTotalFinal;
  if (rodape.valor_orcamento) {
    try {
      orcamentoBaseObra = sanitizarNumero(rodape.valor_orcamento, "Valor Orçamento").toFixed(2);
    } catch {}
  }

  await planilhaRepository.executarEmTransacao(async (client) => {
    // Registra a planilha base
    await planilhaRepository.salvarPlanilhaBase(client, {
      obraId,
      nomeArquivo: nomeArquivo || "planilha_padrao.xlsx",
      statusValidacao: "valida"
    });

    // Limpa etapas e serviços prévios de rascunho
    await planilhaRepository.limparEstruturaObra(client, obraId);

    // Insere cada etapa e seus serviços
    for (const etapa of etapasTratadas) {
      const etapaCriada = await planilhaRepository.salvarEtapa(client, {
        obraId,
        nome: etapa.nome,
        ordem: etapa.ordem
      });

      for (const servico of etapa.servicos) {
        await planilhaRepository.salvarServico(client, {
          obraId,
          etapaId: etapaCriada.id,
          ...servico
        });
      }
    }

    // Atualiza o orçamento total consolidado da obra
    await planilhaRepository.atualizarOrcamentoObra(client, obraId, orcamentoTotalFinal);

    // Garante que o Ciclo 1 está criado e ativo
    await planilhaRepository.garantirCicloInicial(client, obraId);
  });

  return {
    sucesso: true,
    mensagem: "Planilha orçamentária importada com sucesso.",
    resumo: {
      obra_id: obraId,
      nome_obra: obra.nome,
      nome_arquivo: nomeArquivo || "planilha_padrao.xlsx",
      total_etapas: etapasTratadas.length,
      total_servicos: totalServicosCount,
      orcamento_total: parseFloat(orcamentoTotalFinal),
      ciclo_inicial: 1
    }
  };
}

/**
 * Consulta as informações da planilha-base importada para a obra.
 */
async function obterPlanilhaBase(obraId, usuarioId) {
  if (!obraId) {
    throw criarErro("ID da obra não informado.", 400);
  }

  const obra = await planilhaRepository.buscarObraComPermissao(obraId, usuarioId);
  if (!obra) {
    throw criarErro("Obra não encontrada ou você não tem permissão para acessá-la.", 404);
  }

  const planilha = await planilhaRepository.buscarPlanilhaPorObraId(obraId);
  return {
    obra_id: obraId,
    nome_obra: obra.nome,
    orcamento_total: parseFloat(obra.orcamento_total || 0),
    planilha: planilha || null
  };
}

module.exports = {
  importarPlanilhaBase,
  obterPlanilhaBase,
  sanitizarNumero
};
