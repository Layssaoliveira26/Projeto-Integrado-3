const medicaoService = require("../services/medicaoService");
const { tratarErro } = require("../utils/errorUtils");

const registrar = async (req, res) => {
  try {
    const usuario_id = req.user?.id;
    const { id, ciclo_id, servico_id, quantidade_medida_periodo } = req.body || {};

    const resultado = await medicaoService.registrarOuAtualizarMedicao({
      id,
      ciclo_id,
      servico_id,
      usuario_id,
      quantidade_medida_periodo
    });

    return res.status(201).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

module.exports = { registrar };