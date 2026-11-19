import {
  CHAVES_FILTRO_OBRA,
  VALORES_FILTRO_OBRA,
} from "./filtroObraConstantes.js";

const DURACAO_FILTROS_DIAS = {
  [VALORES_FILTRO_OBRA.SEMANA]: 7,
  [VALORES_FILTRO_OBRA.MES]: 30,
  [VALORES_FILTRO_OBRA.TRIMESTRE]: 90,
  [VALORES_FILTRO_OBRA.SEMESTRE]: 180,
};

const dataDentroDoPeriodo = (valor, periodo, agora) => {
  const timestamp = valor ? new Date(valor).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return false;

  const idadeEmDias = (agora - timestamp) / (1000 * 60 * 60 * 24);
  if (periodo === VALORES_FILTRO_OBRA.ANO_MAIS) {
    return idadeEmDias > 365;
  }

  const duracao = DURACAO_FILTROS_DIAS[periodo];
  return duracao !== undefined && idadeEmDias >= -0.05 && idadeEmDias <= duracao;
};

const progressoDaObra = (obra) => {
  const progresso = Number(
    obra.progresso ?? obra._raw?.estrutura?.progresso_geral_percentual,
  );
  return Number.isFinite(progresso) ? progresso : null;
};

const correspondeAoProgresso = (progresso, filtro) => {
  if (progresso === null) return false;

  if (filtro === VALORES_FILTRO_OBRA.NENHUM) return progresso === 0;
  if (filtro === VALORES_FILTRO_OBRA.ABAIXO_50) {
    return progresso > 0 && progresso < 50;
  }
  if (filtro === VALORES_FILTRO_OBRA.ACIMA_50) return progresso >= 50;
  return true;
};

const correspondeAosCiclos = (quantidade, filtro) => {
  if (quantidade === null || quantidade === undefined) return false;
  const total = Number(quantidade);
  if (!Number.isFinite(total)) return false;

  if (filtro === VALORES_FILTRO_OBRA.PRIMEIRO) return total === 1;
  if (filtro === VALORES_FILTRO_OBRA.MENOS_10) return total < 10;
  if (filtro === VALORES_FILTRO_OBRA.MAIS_10) return total >= 10;
  return true;
};

export function filtrarObras(obras, filtros, agora = new Date()) {
  const opcoes = filtros || {};

  return obras.filter((obra) => {
    const dataCriacao = opcoes[CHAVES_FILTRO_OBRA.DATA_CRIACAO];
    if (
      dataCriacao &&
      !dataDentroDoPeriodo(obra._raw?.obra?.created_at, dataCriacao, agora)
    ) {
      return false;
    }

    const registroMedicao = opcoes[CHAVES_FILTRO_OBRA.REGISTRO_MEDICAO];
    if (
      registroMedicao &&
      !dataDentroDoPeriodo(obra.data_ultima_medicao, registroMedicao, agora)
    ) {
      return false;
    }

    const filtroProgresso = opcoes[CHAVES_FILTRO_OBRA.PROGRESSO];
    if (
      filtroProgresso &&
      !correspondeAoProgresso(progressoDaObra(obra), filtroProgresso)
    ) {
      return false;
    }

    const filtroCiclos = opcoes[CHAVES_FILTRO_OBRA.CICLOS];
    if (
      filtroCiclos &&
      !correspondeAosCiclos(obra.quantidade_ciclos, filtroCiclos)
    ) {
      return false;
    }

    return true;
  });
}
