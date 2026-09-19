const db = require("../config/db");
const { tratarErro } = require("../utils/errorUtils");

const obterEstruturaObra = async (req, res) => {
  try {
    const { obra_id } = req.params;

    const queryEtapas = `SELECT * FROM etapas WHERE obra_id = $1 ORDER BY ordem ASC;`;
    const { rows: etapas } = await db.query(queryEtapas, [obra_id]);

    const queryServicos = `SELECT * FROM servicos WHERE obra_id = $1 ORDER BY ordem ASC;`;
    const { rows: servicos } = await db.query(queryServicos, [obra_id]);

    const estrutura = etapas.map(etapa => ({
      ...etapa,
      servicos: servicos.filter(s => s.etapa_id === etapa.id)
    }));

    return res.status(200).json({ obra_id, etapas: estrutura });
  } catch (error) {
    return tratarErro(res, error);
  }
};

module.exports = { obterEstruturaObra };