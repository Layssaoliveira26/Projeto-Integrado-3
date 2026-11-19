import React, { useEffect, useRef, useState } from "react";
import MenuOpcoesObra from "./MenuOpcoesObra";
import ModalAviso from "./ModalAviso";
import ModalConfirmacao from "./ModalConfirmacao";
import ModalFeedback from "./ModalFeedback";
import api, {
  deletarObra,
  arquivarObra,
  desarquivarObra,
  encerrarObra,
} from "../services/api";
import { encerrarCiclo } from "../services/cicloService";
import planilhaFinalService from "../services/planilhaFinalService";
import { CONFIRMACOES } from "../constants/mensagensConfirmacao";
import useFeedbackAcao from "../hooks/useFeedbackAcao";

const ATRASO_FECHAR_MODAL_MS = 300;

export default function MenuAcoesObra({
  visivel,
  onFechar,
  dadosObra,
  navigation,
  onObraAtualizada = () => {},
  modalEncerrarAbertoExterno = false,
  onFecharModalEncerrarExterno = () => {},
}) {
  const [confirmacao, setConfirmacao] = useState(null);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);
  const [processandoArquivamento, setProcessandoArquivamento] = useState(false);
  const [processandoDesarquivamento, setProcessandoDesarquivamento] =
    useState(false);
  const [processandoEncerramentoObra, setProcessandoEncerramentoObra] = useState(false);
  const [encerrandoCiclo, setEncerrandoCiclo] = useState(false);

  const [avisoModal, setAvisoModal] = useState({
    visivel: false,
    titulo: "",
    mensagem: "",
  });
  const { feedback, executar, fechar } = useFeedbackAcao();

  const exibirAviso = (titulo, mensagem) => {
    setAvisoModal({ visivel: true, titulo, mensagem });
  };

  const temporizadorAbrirConfirmacaoRef = useRef(null);
  const temporizadorGeracaoRef = useRef(null);
  const obraId = dadosObra?.obra_id || dadosObra?.id;
  const cicloAtivo = dadosObra?.ciclo_ativo;
  const statusObra = dadosObra?.status || "ativa";

  useEffect(() => {
    if (
      modalEncerrarAbertoExterno &&
      statusObra === "ativa" &&
      cicloAtivo?.status === "aberto"
    ) {
      setConfirmacao("encerrarCiclo");
    }
  }, [modalEncerrarAbertoExterno, statusObra, cicloAtivo?.status]);

  useEffect(
    () => () => {
      if (temporizadorAbrirConfirmacaoRef.current) {
        clearTimeout(temporizadorAbrirConfirmacaoRef.current);
      }
      if (temporizadorGeracaoRef.current) {
        clearTimeout(temporizadorGeracaoRef.current);
      }
    },
    [],
  );

  const abrirConfirmacao = (chave) => {
    if (temporizadorAbrirConfirmacaoRef.current) {
      clearTimeout(temporizadorAbrirConfirmacaoRef.current);
    }
    temporizadorAbrirConfirmacaoRef.current = setTimeout(() => {
      temporizadorAbrirConfirmacaoRef.current = null;
      setConfirmacao(chave);
    }, ATRASO_FECHAR_MODAL_MS);
  };

  const fecharEExecutarDepois = (acao) => {
    setConfirmacao(null);
    setTimeout(acao, ATRASO_FECHAR_MODAL_MS);
  };

  const cancelarConfirmacao = () => {
    const eraEncerramentoCiclo = confirmacao === "encerrarCiclo";
    setConfirmacao(null);
    if (eraEncerramentoCiclo) onFecharModalEncerrarExterno();
  };

  const handleSelecionarOpcaoMenu = (chave) => {
    onFechar();

    switch (chave) {
      case "dadosProjeto":
        navigation?.navigate?.("DadosProjeto", {
          obraId,
        });
        break;

      case "editarObra":
        navigation?.navigate?.("EditarObra", { obraId });
        break;

      case "excluir":
        abrirConfirmacao("excluir");
        break;

      case "arquivar":
        abrirConfirmacao("arquivar");
        break;

      case "desarquivar":
        abrirConfirmacao("desarquivar");
        break;

      case "encerrarObra":
        abrirConfirmacao("encerrarObra");
        break;

      case "encerrarCiclo":
        if (cicloAtivo?.status === "aberto") {
          abrirConfirmacao("encerrarCiclo");
        } else {
          setTimeout(
            () =>
              exibirAviso(
                "Atenção",
                "Esta obra não possui um ciclo aberto para encerramento.",
              ),
            ATRASO_FECHAR_MODAL_MS,
          );
        }
        break;

      case "gerarPlanilha":
        temporizadorGeracaoRef.current = setTimeout(() => {
          temporizadorGeracaoRef.current = null;
          handleIniciarGeracaoPlanilha();
        }, ATRASO_FECHAR_MODAL_MS);
        break;

      default:
        break;
    }
  };

  const handleIniciarGeracaoPlanilha = async () => {
    if (!obraId) {
      exibirAviso("Erro!", "ID da obra não encontrado.");
      return;
    }

    const cicloId = cicloAtivo?.id || null;
    const nomeObra = dadosObra?.nome || "Obra";

    setAvisoModal((atual) => ({ ...atual, visivel: false }));
    await executar(
      "gerarPlanilhaFinal",
      () => planilhaFinalService.obterPlanilhaFinal(obraId, cicloId),
      {
        duracaoSucesso: null,
        acoes: (dadosPlanilha) => [
          {
            rotulo: "Baixar arquivo",
            onPress: () =>
              executar(
                "downloadPlanilhaFinal",
                () =>
                  planilhaFinalService.baixarPlanilhaFinal(
                    obraId,
                    cicloId,
                    nomeObra,
                  ),
                {
                  aoFalhar: (erro) => {
                    console.error("Erro ao baixar planilha:", erro);
                    exibirAviso(
                      "Erro ao baixar planilha",
                      erro?.message ||
                        "Não foi possível baixar o arquivo da planilha final.",
                    );
                  },
                },
              ),
          },
          {
            rotulo: "Ver planilha",
            onPress: () => {
              fechar();
              navigation?.navigate?.("VisualizarPlanilhaFinal", {
                obraId,
                cicloId,
                dadosPlanilha,
                nome: nomeObra,
              });
            },
          },
        ],
        aoFalhar: (erro) => {
          console.error("Erro ao gerar planilha final:", erro);
          exibirAviso(
            "Erro ao gerar planilha",
            erro?.message ||
              "Não foi possível gerar a planilha final de medições.",
          );
        },
      },
    );
  };

  const handleConfirmarExclusao = async () => {
    if (!obraId) {
      fecharEExecutarDepois(() =>
        exibirAviso("Erro!", "ID da obra não encontrado para exclusão."),
      );
      return;
    }

    try {
      setProcessandoExclusao(true);
      await (deletarObra ? deletarObra(obraId) : api.deletarObra(obraId));
      fecharEExecutarDepois(() => navigation?.navigate?.("Home"));
    } catch (error) {
      console.error("Erro ao excluir obra:", error);
      fecharEExecutarDepois(() =>
        exibirAviso(
          "Erro!",
          error.message || "Não foi possível excluir a obra. Tente novamente.",
        ),
      );
    } finally {
      setProcessandoExclusao(false);
    }
  };

  const handleConfirmarArquivamento = async () => {
    if (!obraId) {
      fecharEExecutarDepois(() =>
        exibirAviso("Erro!", "ID da obra não encontrado para arquivamento."),
      );
      return;
    }

    try {
      setProcessandoArquivamento(true);
      await (arquivarObra ? arquivarObra(obraId) : api.arquivarObra(obraId));
      fecharEExecutarDepois(() => navigation?.navigate?.("Home"));
    } catch (error) {
      console.error("Erro ao arquivar obra:", error);
      fecharEExecutarDepois(() =>
        exibirAviso(
          "Erro!",
          error.message || "Não foi possível arquivar a obra. Tente novamente.",
        ),
      );
    } finally {
      setProcessandoArquivamento(false);
    }
  };

  const handleConfirmarDesarquivamento = async () => {
    if (!obraId) {
      fecharEExecutarDepois(() =>
        exibirAviso("Erro!", "ID da obra não encontrado para desarquivamento."),
      );
      return;
    }

    try {
      setProcessandoDesarquivamento(true);
      await (desarquivarObra
        ? desarquivarObra(obraId)
        : api.desarquivarObra(obraId));
      fecharEExecutarDepois(() => {
        onObraAtualizada();
        navigation?.navigate?.("Home");
      });
    } catch (error) {
      console.error("Erro ao desarquivar obra:", error);
      fecharEExecutarDepois(() =>
        exibirAviso(
          "Erro!",
          error.message ||
            "Não foi possível desarquivar a obra. Tente novamente.",
        ),
      );
    } finally {
      setProcessandoDesarquivamento(false);
    }
  };

  const handleConfirmarEncerramentoObra = async () => {
    if (!obraId) {
      fecharEExecutarDepois(() =>
        exibirAviso("Erro!", "ID da obra não encontrado para encerramento."),
      );
      return;
    }

    try {
      setProcessandoEncerramentoObra(true);
      await (encerrarObra ? encerrarObra(obraId) : api.encerrarObra(obraId));
      fecharEExecutarDepois(() => navigation?.navigate?.("Home"));
    } catch (error) {
      console.error("Erro ao encerrar obra:", error);
      fecharEExecutarDepois(() =>
        exibirAviso(
          "Erro!",
          error.message || "Não foi possível encerrar a obra. Tente novamente.",
        ),
      );
    } finally {
      setProcessandoEncerramentoObra(false);
    }
  };

  const confirmarEncerramento = async () => {
    const cicloAtivoId = cicloAtivo?.id;
    if (!cicloAtivoId) {
      fecharEExecutarDepois(() => onFecharModalEncerrarExterno());
      return;
    }

    try {
      setEncerrandoCiclo(true);
      await encerrarCiclo(cicloAtivoId);
      onFecharModalEncerrarExterno();
      fecharEExecutarDepois(onObraAtualizada);
    } catch (error) {
      console.error("Erro ao encerrar ciclo:", error);
      onFecharModalEncerrarExterno();
      fecharEExecutarDepois(() =>
        exibirAviso(
          "Erro!",
          error?.message || "Não foi possível encerrar o ciclo.",
        ),
      );
    } finally {
      setEncerrandoCiclo(false);
    }
  };

  const confirmarAcao = {
    excluir: handleConfirmarExclusao,
    arquivar: handleConfirmarArquivamento,
    desarquivar: handleConfirmarDesarquivamento,
    encerrarCiclo: confirmarEncerramento,
    encerrarObra: handleConfirmarEncerramentoObra,
  }[confirmacao];
  const processandoConfirmacao =
    (confirmacao === "excluir" && processandoExclusao) ||
    (confirmacao === "arquivar" && processandoArquivamento) ||
    (confirmacao === "desarquivar" && processandoDesarquivamento) ||
    (confirmacao === "encerrarCiclo" && encerrandoCiclo) ||
    (confirmacao === "encerrarObra" && processandoEncerramentoObra);
  const dadosConfirmacao = confirmacao
    ? CONFIRMACOES[confirmacao]
    : null;

  return (
    <>
      <MenuOpcoesObra
        visivel={visivel}
        onFechar={onFechar}
        statusObra={statusObra}
        onSelecionar={handleSelecionarOpcaoMenu}
        onSelecionarOpcao={handleSelecionarOpcaoMenu}
      />

      <ModalConfirmacao
        visible={Boolean(confirmacao)}
        titulo={dadosConfirmacao?.titulo}
        mensagem={dadosConfirmacao?.mensagem}
        textoConfirmar={dadosConfirmacao?.textoConfirmar}
        onConfirmar={confirmarAcao}
        onCancelar={cancelarConfirmacao}
        processando={Boolean(processandoConfirmacao)}
      />

      <ModalFeedback {...feedback} />
      <ModalAviso
        visible={avisoModal.visivel}
        titulo={avisoModal.titulo}
        mensagem={avisoModal.mensagem}
        onFechar={() =>
          setAvisoModal((atual) => ({ ...atual, visivel: false }))
        }
      />
    </>
  );
}
