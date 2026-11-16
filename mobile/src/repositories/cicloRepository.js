import { getDbConnection } from "../database/index";

export const salvarCiclosObra = async (obraId, ciclos) => {
  const db = await getDbConnection();
  const lista = Array.isArray(ciclos) ? ciclos : [];

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM ciclos_medicao WHERE obra_id = ? OR obra_id = ?;`,
      [obraId, String(obraId)]
    );

    for (const ciclo of lista) {
      if (!ciclo?.id) continue;
      const numero = Number(ciclo.numero_ciclo);
      await db.runAsync(
        `INSERT INTO ciclos_medicao (id, obra_id, numero_ciclo, status) VALUES (?, ?, ?, ?);`,
        [
          String(ciclo.id),
          String(obraId),
          Number.isFinite(numero) ? numero : null,
          ciclo.status ?? null,
        ]
      );
    }
  });
};

export const listarCiclosObraLocal = async (obraId) => {
  const db = await getDbConnection();
  const rows = await db.getAllAsync(
    `SELECT id, obra_id, numero_ciclo, status
     FROM ciclos_medicao
     WHERE obra_id = ? OR obra_id = ?
     ORDER BY numero_ciclo ASC;`,
    [obraId, String(obraId)]
  );
  return rows;
};
