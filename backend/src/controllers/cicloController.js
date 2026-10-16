const crypto = require("crypto");
const db = require("../config/db");

exports.encerrar = async (req, res) => {
  const { id } = req.params;
  let client;

  try {
    if (db.pool && typeof db.pool.connect === "function") {
      client = await db.pool.connect();
    } else if (typeof db.connect === "function") {
      client = await db.connect();
    } else {
      throw new Error("Não foi possível conectar ao banco de dados no formato esperado.");
    }

    await client.query("BEGIN");

    const cicloRes = await client.query(
      "SELECT * FROM ciclos_medicao WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (cicloRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensagem: "Ciclo não encontrado." });
    }

    const cicloAtual = cicloRes.rows[0];

    if (cicloAtual.status === "encerrado") {
      await client.query("ROLLBACK");
      return res.status(400).json({ mensagem: "Este ciclo já está encerrado." });
    }

    // 1. Encerra o ciclo atual
    await client.query(
      "UPDATE ciclos_medicao SET status = 'encerrado', data_encerramento = NOW(), updated_at = NOW() WHERE id = $1",
      [id]
    );

    // 2. Cria o novo ciclo
    const novoCicloId = crypto.randomUUID();
    const proximoNumero = Number(cicloAtual.numero_ciclo) + 1;

    const novoCicloRes = await client.query(
      `INSERT INTO ciclos_medicao (id, obra_id, numero_ciclo, status, data_inicio)
       VALUES ($1, $2, $3, 'aberto', NOW())
       RETURNING *`,
      [novoCicloId, cicloAtual.obra_id, proximoNumero]
    );

    // 3. Herança de Progresso: Copia o progresso acumulado do ciclo anterior para o novo ciclo
    await client.query(
      `INSERT INTO medicoes (
        id, ciclo_id, servico_id, usuario_id,
        quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
        saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
        valor_acumulado_atual, percentual_execucao, updated_at
      )
      SELECT 
        gen_random_uuid(), $1, servico_id, usuario_id,
        0, quantidade_acumulada_atual, quantidade_acumulada_atual,
        saldo_quantidade, 0, valor_acumulado_atual,
        valor_acumulado_atual, percentual_execucao, NOW()
      FROM medicoes
      WHERE ciclo_id = $2`,
      [novoCicloId, cicloAtual.id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      mensagem: "Ciclo encerrado com sucesso!",
      cicloEncerrado: id,
      novoCiclo: novoCicloRes.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    return res.status(500).json({ mensagem: error.message || "Erro interno ao encerrar ciclo." });
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.listarPorObra = async (req, res) => {
  try {
    const { obra_id } = req.params;

    const querySQL = `
      SELECT 
        c.id,
        c.numero_ciclo,
        c.status,
        c.data_inicio,
        c.data_encerramento,
        COALESCE(
          ROUND(
            (
              SUM(m.valor_acumulado_atual) / NULLIF((SELECT SUM(preco_total) FROM servicos WHERE obra_id = $1), 0)
            ) * 100
          ), 
          0
        ) AS progresso_percentual
      FROM ciclos_medicao c
      LEFT JOIN medicoes m ON m.ciclo_id = c.id
      WHERE c.obra_id = $1
      GROUP BY c.id
      ORDER BY c.numero_ciclo DESC;
    `;

    const resultado = await db.query(querySQL, [obra_id]);
    return res.status(200).json(resultado.rows);
  } catch (error) {
    console.error("[Ciclo] Erro ao listar ciclos:", error);
    return res.status(500).json({ mensagem: "Erro ao listar ciclos." });
  }
};

exports.obterDetalhes = async (req, res) => {
  try {
    const { id } = req.params;

    const cicloRes = await db.query(
      `SELECT c.*, o.nome AS obra_nome 
       FROM ciclos_medicao c
       JOIN obras o ON c.obra_id = o.id
       WHERE c.id = $1`,
      [id]
    );

    if (cicloRes.rows.length === 0) {
      return res.status(404).json({ mensagem: "Ciclo não encontrado." });
    }

    const ciclo = cicloRes.rows[0];

    const medicoesRes = await db.query(
      `SELECT m.*, s.descricao, s.codigo_servico, s.preco_total
       FROM medicoes m
       JOIN servicos s ON m.servico_id = s.id
       WHERE m.ciclo_id = $1`,
      [id]
    );

    const orcamentoRes = await db.query(
      `SELECT COALESCE(SUM(preco_total), 0) AS total_orcado
       FROM servicos
       WHERE obra_id = $1`,
      [ciclo.obra_id]
    );
    const totalOrcadoObra = Number(orcamentoRes.rows[0].total_orcado || 0);

    const inicio = new Date(ciclo.data_inicio);
    const fim = ciclo.data_encerramento ? new Date(ciclo.data_encerramento) : new Date();
    const duracao_dias = Math.max(1, Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)));

    let valorTotalAcumuladoCiclo = 0;
    const servicosMapeados = medicoesRes.rows.map((m) => {
      const valorAcumulado = Number(m.valor_acumulado_atual || 0);
      valorTotalAcumuladoCiclo += valorAcumulado;

      return {
        id: m.servico_id,
        descricao: m.descricao || m.codigo_servico,
        valor_medido: valorAcumulado,
        percentual: Math.round(Number(m.percentual_execucao || 0)),
      };
    });

    const progresso_atribuido = totalOrcadoObra > 0
      ? Math.round((valorTotalAcumuladoCiclo / totalOrcadoObra) * 100)
      : 0;

    return res.status(200).json({
      ciclo_id: ciclo.id,
      obra_nome: ciclo.obra_nome,
      numero_ciclo: ciclo.numero_ciclo,
      status: ciclo.status,
      duracao_dias,
      data_inicio: ciclo.data_inicio,
      data_encerramento: ciclo.data_encerramento,
      progresso_atribuido,
      servicos: servicosMapeados,
    });
  } catch (error) {
    console.error("[Ciclo] Erro ao obter detalhes:", error);
    return res.status(500).json({ mensagem: "Erro ao obter detalhes do ciclo." });
  }
};