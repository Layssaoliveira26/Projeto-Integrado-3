import { getDbConnection, initDb } from "../database";

const gerarIdFila = () =>
  `sync_usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const salvarUsuarioLocal = async (usuario) => {
  if (!usuario?.id) return null;
  await initDb();
  const db = await getDbConnection();

  const existente = await db.getFirstAsync(
    "SELECT id, foto_local, foto_url FROM usuarios WHERE id = ?",
    [String(usuario.id)]
  );

  const fotoUrl = usuario.foto_url !== undefined ? usuario.foto_url : existente?.foto_url || null;
  const fotoLocal = usuario.foto_local !== undefined ? usuario.foto_local : existente?.foto_local || null;

  await db.runAsync(
    `INSERT INTO usuarios (id, nome, email, foto_url, foto_local, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       email = excluded.email,
       foto_url = excluded.foto_url,
       foto_local = excluded.foto_local,
       updated_at = CURRENT_TIMESTAMP`,
    [String(usuario.id), usuario.nome || "", usuario.email || "", fotoUrl, fotoLocal]
  );

  return buscarUsuarioLocal(usuario.id);
};

export const buscarUsuarioLocal = async (id) => {
  await initDb();
  const db = await getDbConnection();
  if (id) {
    return await db.getFirstAsync("SELECT * FROM usuarios WHERE id = ?", [String(id)]);
  }
  return await db.getFirstAsync("SELECT * FROM usuarios ORDER BY updated_at DESC LIMIT 1");
};

export const enfileirarAtualizacaoPerfil = async (usuarioId, payload) => {
  await initDb();
  const db = await getDbConnection();

  await db.runAsync(
    `DELETE FROM fila_sincronizacao
     WHERE tabela_referencia = 'usuarios' AND registro_id = ? AND status IN ('pendente', 'erro')`,
    [String(usuarioId)]
  );

  const id = gerarIdFila();
  await db.runAsync(
    `INSERT INTO fila_sincronizacao (id, tabela_referencia, registro_id, operacao, payload, status, tentativas)
     VALUES (?, 'usuarios', ?, 'update', ?, 'pendente', 0)`,
    [id, String(usuarioId), JSON.stringify(payload)]
  );

  return id;
};

export const listarPendenciasPerfil = async (usuarioId = null) => {
  await initDb();
  const db = await getDbConnection();
  if (usuarioId) {
    return await db.getAllAsync(
      `SELECT * FROM fila_sincronizacao
       WHERE tabela_referencia = 'usuarios' AND registro_id = ? AND status IN ('pendente', 'erro')
       ORDER BY created_at ASC`,
      [String(usuarioId)]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM fila_sincronizacao
     WHERE tabela_referencia = 'usuarios' AND status IN ('pendente', 'erro')
     ORDER BY created_at ASC`
  );
};

export const marcarPendenciaPerfilConcluida = async (id) => {
  await initDb();
  const db = await getDbConnection();
  await db.runAsync(
    `UPDATE fila_sincronizacao SET status = 'sincronizado', ultimo_erro = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  );
};

export const registrarErroPendenciaPerfil = async (id, mensagemErro) => {
  await initDb();
  const db = await getDbConnection();
  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'erro', tentativas = COALESCE(tentativas, 0) + 1, ultimo_erro = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [mensagemErro, id]
  );
};

export default {
  salvarUsuarioLocal,
  buscarUsuarioLocal,
  enfileirarAtualizacaoPerfil,
  listarPendenciasPerfil,
  marcarPendenciaPerfilConcluida,
  registrarErroPendenciaPerfil,
};