import React, { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import MenuOpcoesObra from "./MenuOpcoesObra";
import ModalConfirmacao from "./ModalConfirmacao";
import ModalFeedback from "./ModalFeedback";
import ModalGerarPlanilha from "./ModalGerarPlanilha";
import api, { deletarObra, arquivarObra, encerrarObra } from "../services/api";
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
  const [processandoEncerramentoObra, setProcessandoEncerramentoObra] = useState(false);
  const [encerrandoCiclo, setEncerrandoCiclo] = useState(false);

  const [modalErroPlanilhaVisivel, setModalErroPlanilhaVisivel] = useState(false);
  const [mensagemErroPlanilha, setMensagemErroPlanilha] = useState("");
  const { feedback, executar, fechar } = useFeedbackAcao();

  const temporizadorAbrirConfirmacaoRef = useRef(null);
  const temporizadorGeracaoRef = useRef(null);
  const obraId = dadosObra?.obra_id || dadosObra?.id;
  const cicloAtivo = dadosObra?.ciclo_ativo;

  useEffect(() => {
    if (modalEncerrarAbertoExterno && cicloAtivo?.status === "aberto") {
      setConfirmacao("encerrarCiclo");
    }
  }, [modalEncerrarAbertoExterno, cicloAtivo?.status]);

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
          obra: dadosObra,
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

      case "encerrarObra":
        abrirConfirmacao("encerrarObra");
        break;

      case "encerrarCiclo":
        if (cicloAtivo?.status === "aberto") {
          abrirConfirmacao("encerrarCiclo");
        } else {
          setTimeout(
            () =>
              Alert.alert(
                "Aviso",
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
      Alert.alert("Erro", "ID da obra não encontrado.");
      return;
    }

    const cicloId = cicloAtivo?.id || null;
    const nomeObra = dadosObra?.nome || "Obra";

    setModalErroPlanilhaVisivel(false);
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
                    setMensagemErroPlanilha(
                      erro?.message ||
                        "Não foi possível baixar o arquivo da planilha final.",
                    );
                    setModalErroPlanilhaVisivel(true);
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
          setMensagemErroPlanilha(
            erro?.message ||
              "Não foi possível gerar a planilha final de medições.",
          );
          setModalErroPlanilhaVisivel(true);
        },
      },
    );
  };

  const handleConfirmarExclusao = async () => {
    if (!obraId) {
      fecharEExecutarDepois(() =>
        Alert.alert("Erro", "ID da obra não encontrado para exclusão."),
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
        Alert.alert(
          "Erro",
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
        Alert.alert("Erro", "ID da obra não encontrado para arquivamento."),
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
        Alert.alert(
          "Erro",
          error.message || "Não foi possível arquivar a obra. Tente novamente.",
        ),
      );
    } finally {
      setProcessandoArquivamento(false);
    }
  };

  const handleConfirmarEncerramentoObra = async () => {
    if (!obraId) {
      fecharEExecutarDepois(() =>
        Alert.alert("Erro", "ID da obra não encontrado para encerramento."),
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
        Alert.alert(
          "Erro",
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
        Alert.alert("Erro", error?.message || "Não foi possível encerrar o ciclo."),
      );
    } finally {
      setEncerrandoCiclo(false);
    }
  };

  const confirmarAcao = {
    excluir: handleConfirmarExclusao,
    arquivar: handleConfirmarArquivamento,
    encerrarCiclo: confirmarEncerramento,
    encerrarObra: handleConfirmarEncerramentoObra,
  }[confirmacao];
  const processandoConfirmacao =
    (confirmacao === "excluir" && processandoExclusao) ||
    (confirmacao === "arquivar" && processandoArquivamento) ||
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
      <ModalGerarPlanilha
        visivel={modalErroPlanilhaVisivel}
        estado="erro"
        mensagemErro={mensagemErroPlanilha}
        onFechar={() => setModalErroPlanilhaVisivel(false)}
      />
    </>
  );
}
