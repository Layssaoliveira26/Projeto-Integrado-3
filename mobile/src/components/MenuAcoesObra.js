import React, { useState } from "react";
import { Alert } from "react-native";
import MenuOpcoesObra from "./MenuOpcoesObra";
import ModalConfirmarExclusaoObra from "./ModalConfirmarExclusaoObra";
import ModalConfirmarArquivamentoObra from "./ModalConfirmarArquivamentoObra";
import ModalAvisoEncerrarCiclo from "./ModalAvisoEncerrarCiclo";
import ModalEncerrarCiclo from "./ModalEncerrarCiclo";
import ModalGerarPlanilha from "./ModalGerarPlanilha";
import api, { deletarObra, arquivarObra } from "../services/api";
import { encerrarCiclo } from "../services/cicloService";
import planilhaFinalService from "../services/planilhaFinalService";

export default function MenuAcoesObra({
  visivel,
  onFechar,
  dadosObra,
  navigation,
  onObraAtualizada = () => {},
  modalEncerrarAbertoExterno = false,
  onFecharModalEncerrarExterno = () => {},
}) {
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);

  const [modalArquivarAberto, setModalArquivarAberto] = useState(false);
  const [processandoArquivamento, setProcessandoArquivamento] = useState(false);

  const [modalPrimeiraConfirmacaoVisivel, setModalPrimeiraConfirmacaoVisivel] = useState(false);
  const [modalEncerrarVisivel, setModalEncerrarVisivel] = useState(false);
  const [encerrandoCiclo, setEncerrandoCiclo] = useState(false);

  const [modalPlanilhaVisivel, setModalPlanilhaVisivel] = useState(false);
  const [estadoPlanilha, setEstadoPlanilha] = useState("gerando");
  const [mensagemErroPlanilha, setMensagemErroPlanilha] = useState("");
  const [dadosPlanilhaFinal, setDadosPlanilhaFinal] = useState(null);

  const obraId = dadosObra?.obra_id || dadosObra?.id;
  const cicloAtivo = dadosObra?.ciclo_ativo;
  const numeroCicloAtual = String(cicloAtivo?.numero_ciclo || 1).padStart(2, "0");

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
        setModalExcluirAberto(true);
        break;

      case "arquivar":
        setModalArquivarAberto(true);
        break;

      case "encerrarCiclo":
        if (cicloAtivo?.status === "aberto") {
          setModalPrimeiraConfirmacaoVisivel(true);
        } else {
          Alert.alert("Aviso", "Esta obra não possui um ciclo aberto para encerramento.");
        }
        break;

      case "gerarPlanilha":
        handleIniciarGeracaoPlanilha();
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
    setMensagemErroPlanilha("");
    setEstadoPlanilha("gerando");
    setModalPlanilhaVisivel(true);

    try {
      const dados = await planilhaFinalService.obterPlanilhaFinal(obraId, cicloId);
      setDadosPlanilhaFinal(dados);
      setEstadoPlanilha("gerada");
    } catch (err) {
      console.error("Erro ao gerar planilha final:", err);
      setMensagemErroPlanilha(
        err.message || "Não foi possível gerar a planilha final de medições.",
      );
      setEstadoPlanilha("erro");
    }
  };

  const handleBaixarArquivoPlanilha = async () => {
    const cicloId = cicloAtivo?.id || null;
    const nomeObra = dadosObra?.nome || "Obra";

    try {
      setEstadoPlanilha("baixando");
      await planilhaFinalService.baixarPlanilhaFinal(obraId, cicloId, nomeObra);
      setEstadoPlanilha("concluido");
    } catch (err) {
      console.error("Erro ao baixar planilha:", err);
      setMensagemErroPlanilha(
        err.message || "Não foi possível baixar o arquivo da planilha final.",
      );
      setEstadoPlanilha("erro");
    }
  };

  const handleVerPlanilha = () => {
    setModalPlanilhaVisivel(false);
    const cicloId = cicloAtivo?.id || null;

    navigation?.navigate?.("VisualizarPlanilhaFinal", {
      obraId,
      cicloId,
      dadosPlanilha: dadosPlanilhaFinal,
      nome: dadosObra?.nome,
    });
  };

  const handleConfirmarExclusao = async () => {
    if (!obraId) {
      Alert.alert("Erro", "ID da obra não encontrado para exclusão.");
      return;
    }

    try {
      setProcessandoExclusao(true);
      await (deletarObra ? deletarObra(obraId) : api.deletarObra(obraId));
      setModalExcluirAberto(false);
      navigation?.navigate?.("Home");
    } catch (error) {
      console.error("Erro ao excluir obra:", error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível excluir a obra. Tente novamente.",
      );
    } finally {
      setProcessandoExclusao(false);
    }
  };

  const handleConfirmarArquivamento = async () => {
    if (!obraId) {
      Alert.alert("Erro", "ID da obra não encontrado para arquivamento.");
      return;
    }

    try {
      setProcessandoArquivamento(true);
      await (arquivarObra ? arquivarObra(obraId) : api.arquivarObra(obraId));
      setModalArquivarAberto(false);
      navigation?.navigate?.("Home");
    } catch (error) {
      console.error("Erro ao arquivar obra:", error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível arquivar a obra. Tente novamente.",
      );
    } finally {
      setProcessandoArquivamento(false);
    }
  };

  const avancarParaModalDefinitivo = () => {
    setModalPrimeiraConfirmacaoVisivel(false);
    onFecharModalEncerrarExterno();
    setModalEncerrarVisivel(true);
  };

  const confirmarEncerramento = async () => {
    const cicloAtivoId = cicloAtivo?.id;
    if (!cicloAtivoId) return;

    try {
      setEncerrandoCiclo(true);
      await encerrarCiclo(cicloAtivoId);
      setModalEncerrarVisivel(false);
      onFecharModalEncerrarExterno();
      onObraAtualizada();
    } catch (error) {
      console.error("Erro ao encerrar ciclo:", error);
      Alert.alert("Erro", error?.message || "Não foi possível encerrar o ciclo.");
    } finally {
      setEncerrandoCiclo(false);
    }
  };

  const avisoCicloVisivel = modalPrimeiraConfirmacaoVisivel || modalEncerrarAbertoExterno;

  return (
    <>
      <MenuOpcoesObra
        visivel={visivel}
        onFechar={onFechar}
        onSelecionar={handleSelecionarOpcaoMenu}
        onSelecionarOpcao={handleSelecionarOpcaoMenu}
      />

      <ModalConfirmarExclusaoObra
        visivel={modalExcluirAberto}
        processando={processandoExclusao}
        onConfirmar={handleConfirmarExclusao}
        onCancelar={() => setModalExcluirAberto(false)}
      />

      <ModalConfirmarArquivamentoObra
        visivel={modalArquivarAberto}
        processando={processandoArquivamento}
        onConfirmar={handleConfirmarArquivamento}
        onCancelar={() => setModalArquivarAberto(false)}
      />

      <ModalAvisoEncerrarCiclo
        visivel={avisoCicloVisivel}
        numeroCiclo={numeroCicloAtual}
        onAvancar={avancarParaModalDefinitivo}
        onCancelar={() => {
          setModalPrimeiraConfirmacaoVisivel(false);
          onFecharModalEncerrarExterno();
        }}
      />

      <ModalEncerrarCiclo
        visivel={modalEncerrarVisivel}
        carregando={encerrandoCiclo}
        onConfirmar={confirmarEncerramento}
        onCancelar={() => {
          setModalEncerrarVisivel(false);
          onFecharModalEncerrarExterno();
        }}
      />

      <ModalGerarPlanilha
        visivel={modalPlanilhaVisivel}
        estado={estadoPlanilha}
        mensagemErro={mensagemErroPlanilha}
        onBaixarArquivo={handleBaixarArquivoPlanilha}
        onVerPlanilha={handleVerPlanilha}
        onFechar={() => setModalPlanilhaVisivel(false)}
      />
    </>
  );
}
