import { requisicao } from "./api";

export const listarCiclosObra = async (obraId) => {
  return await requisicao(`/ciclos/obra/${obraId}`);
};

export const obterDetalhesCiclo = async (cicloId) => {
  return await requisicao(`/ciclos/${cicloId}/detalhes`);
};

export const encerrarCiclo = async (cicloId) => {
  return await requisicao(`/ciclos/${cicloId}/encerrar`, {
    method: "POST",
  });
};

export default {
  listarCiclosObra,
  encerrarCiclo,
};