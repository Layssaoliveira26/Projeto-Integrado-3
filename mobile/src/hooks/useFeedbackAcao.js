import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_OCULTO = {
  visible: false,
  contexto: null,
  estado: "loading",
  acoes: undefined,
};

const TEMPO_MINIMO_LOADING_MS = 600;
const ATRASO_FECHAR_MODAL_MS = 300;

export default function useFeedbackAcao() {
  const [feedback, setFeedback] = useState(FEEDBACK_OCULTO);
  const executandoRef = useRef(false);
  const desmontadoRef = useRef(false);
  const execucaoIdRef = useRef(0);
  const temporizadoresRef = useRef(new Map());

  const aguardar = useCallback(
    (duracao) =>
      new Promise((resolve) => {
        const temporizador = setTimeout(() => {
          temporizadoresRef.current.delete(temporizador);
          resolve();
        }, duracao);
        temporizadoresRef.current.set(temporizador, resolve);
      }),
    [],
  );

  const limparTemporizadores = useCallback(() => {
    temporizadoresRef.current.forEach((resolver, temporizador) => {
      clearTimeout(temporizador);
      resolver();
    });
    temporizadoresRef.current.clear();
  }, []);

  useEffect(() => {
    desmontadoRef.current = false;

    return () => {
      desmontadoRef.current = true;
      execucaoIdRef.current += 1;
      executandoRef.current = false;
      limparTemporizadores();
    };
  }, [limparTemporizadores]);

  const fechar = useCallback(() => {
    execucaoIdRef.current += 1;
    executandoRef.current = false;
    limparTemporizadores();
    if (!desmontadoRef.current) setFeedback(FEEDBACK_OCULTO);
  }, [limparTemporizadores]);

  const executar = useCallback(
    async (
      contexto,
      acao,
      {
        duracaoSucesso = 4000,
        acoes,
        aoConcluir,
        aoFalhar,
      } = {},
    ) => {
      if (executandoRef.current) return undefined;
      if (typeof acao !== "function") {
        throw new TypeError("A ação de feedback precisa ser uma função.");
      }

      executandoRef.current = true;
      const execucaoId = ++execucaoIdRef.current;
      setFeedback({ visible: true, contexto, estado: "loading" });

      let resultadoAcao;
      try {
        const promessaAcao = Promise.resolve()
          .then(acao)
          .then(
            (valor) => ({ sucesso: true, valor }),
            (erro) => ({ sucesso: false, erro }),
          );
        [resultadoAcao] = await Promise.all([
          promessaAcao,
          aguardar(TEMPO_MINIMO_LOADING_MS),
        ]);

        if (
          desmontadoRef.current ||
          execucaoId !== execucaoIdRef.current
        ) {
          executandoRef.current = false;
          return undefined;
        }
        if (!resultadoAcao.sucesso) throw resultadoAcao.erro;

        const acoesSucesso =
          typeof acoes === "function"
            ? acoes(resultadoAcao.valor)
            : acoes;
        setFeedback({
          visible: true,
          contexto,
          estado: "sucesso",
          acoes: acoesSucesso,
          onClose: acoesSucesso?.length > 0 ? fechar : undefined,
        });

        if (duracaoSucesso === null) {
          executandoRef.current = false;
          return resultadoAcao.valor;
        }

        const duracao =
          typeof duracaoSucesso === "number"
            ? Math.max(0, duracaoSucesso)
            : 4000;
        await aguardar(duracao);
      } catch (erro) {
        if (
          desmontadoRef.current ||
          execucaoId !== execucaoIdRef.current
        ) {
          executandoRef.current = false;
          return undefined;
        }

        if (aoFalhar) {
          setFeedback(FEEDBACK_OCULTO);
          await aguardar(ATRASO_FECHAR_MODAL_MS);
          if (
            desmontadoRef.current ||
            execucaoId !== execucaoIdRef.current
          ) {
            executandoRef.current = false;
            return undefined;
          }

          executandoRef.current = false;
          aoFalhar(erro);
        } else {
          executandoRef.current = false;
          setFeedback({
            visible: true,
            contexto,
            estado: "erro",
            titulo: "Erro",
            mensagem: erro?.message || "Não foi possível concluir a ação.",
            acoes: [{ rotulo: "Certo", onPress: fechar }],
            onClose: fechar,
          });
        }
        return undefined;
      }

      if (
        desmontadoRef.current ||
        execucaoId !== execucaoIdRef.current
      ) {
        executandoRef.current = false;
        return undefined;
      }

      setFeedback(FEEDBACK_OCULTO);
      executandoRef.current = false;
      if (aoConcluir) aoConcluir(resultadoAcao.valor);
      return resultadoAcao.valor;
    },
    [aguardar, fechar],
  );

  return { feedback, executar, fechar };
}
