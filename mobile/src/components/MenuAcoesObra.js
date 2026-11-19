import React, { useState } from "react";
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AlertTriangleGradient from "./AlertTriangleGradient";
import MenuOpcoesObra from "./MenuOpcoesObra";
import ModalConfirmarExclusaoObra from "./ModalConfirmarExclusaoObra";
import ModalConfirmarArquivamentoObra from "./ModalConfirmarArquivamentoObra";
import ModalAvisoEncerrarCiclo from "./ModalAvisoEncerrarCiclo";
import ModalEncerrarCiclo from "./ModalEncerrarCiclo";
import ModalGerarPlanilha from "./ModalGerarPlanilha";
import api, { deletarObra, arquivarObra, encerrarObra } from "../services/api";
import { encerrarCiclo } from "../services/cicloService";
import planilhaFinalService from "../services/planilhaFinalService";
import theme, { moderateScale } from "../styles/theme";

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

  const [modalEncerrarObraAberto, setModalEncerrarObraAberto] = useState(false);
  const [processandoEncerramentoObra, setProcessandoEncerramentoObra] = useState(false);

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

      case "encerrarObra":
        setModalEncerrarObraAberto(true);
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

  const handleConfirmarEncerramentoObra = async () => {
    if (!obraId) {
      Alert.alert("Erro", "ID da obra não encontrado para encerramento.");
      return;
    }

    try {
      setProcessandoEncerramentoObra(true);
      await (encerrarObra ? encerrarObra(obraId) : api.encerrarObra(obraId));
      setModalEncerrarObraAberto(false);
      navigation?.navigate?.("Home");
    } catch (error) {
      console.error("Erro ao encerrar obra:", error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível encerrar a obra. Tente novamente.",
      );
    } finally {
      setProcessandoEncerramentoObra(false);
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

      <Modal
        visible={modalEncerrarObraAberto}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processandoEncerramentoObra) setModalEncerrarObraAberto(false);
        }}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcone}>
              <AlertTriangleGradient size={moderateScale(50)} strokeWidth={2.4} />
            </View>
            <Text style={styles.modalTitulo}>Encerrar obra</Text>
            <Text style={styles.modalMensagem}>
              Tem certeza que deseja encerrar esta obra?{"\n"}
              Esta ação não poderá ser desfeita.
            </Text>

            <TouchableOpacity
              style={styles.modalBotaoConfirmar}
              onPress={handleConfirmarEncerramentoObra}
              disabled={processandoEncerramentoObra}
              activeOpacity={0.85}
            >
              {processandoEncerramentoObra ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalTextoBotaoConfirmar}>Encerrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalBotaoCancelar}
              onPress={() => setModalEncerrarObraAberto(false)}
              disabled={processandoEncerramentoObra}
              activeOpacity={0.85}
            >
              <Text style={styles.modalTextoBotaoCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(28),
    paddingHorizontal: moderateScale(22),
    alignItems: "center",
    ...theme.shadows.padrao,
  },
  modalIcone: {
    marginBottom: moderateScale(12),
  },
  modalTitulo: {
    fontSize: moderateScale(22),
    fontFamily: theme.fontes.negrito,
    color: theme.cores.titulo,
    marginBottom: moderateScale(10),
  },
  modalMensagem: {
    fontSize: moderateScale(13),
    fontFamily: theme.fontes.regular,
    color: theme.cores.textoSecundario,
    textAlign: "center",
    lineHeight: moderateScale(18),
    marginBottom: moderateScale(22),
  },
  modalBotaoConfirmar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: theme.cores.azulPetroleo,
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: moderateScale(10),
  },
  modalTextoBotaoConfirmar: {
    fontSize: moderateScale(15),
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
  },
  modalBotaoCancelar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: theme.cores.titulo,
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  modalTextoBotaoCancelar: {
    fontSize: moderateScale(15),
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
  },
});
