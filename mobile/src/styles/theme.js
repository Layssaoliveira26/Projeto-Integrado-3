// Padrões de Design - Metria

export const cores = {
  // Paleta
  azulEscuro: "#223B59",
  azulPetroleo: "#0D6579",
  azulEsverdeado: "#16929C",
  ciano: "#09D1C7",
  verdeAgua: "#46DFB3",
  verdeClaro: "#81EF99",

  // Estrutura
  fundoCard: "#F6F4F0",
  fundoInput: "#E6E6E6",

  // Aplicação nos textos e botões
  principal: "#0D6579",
  titulo: "#223B59",
  rotulo: "#0D6579",
  textoEscuro: "#223B59",
  textoSecundario: "#79A5AF",
  erro: "#16929C",
};

// Gradiente
export const gradienteCores = [
  cores.azulEscuro, // #223B59
  cores.azulPetroleo, // #0D6579
  cores.azulEsverdeado, // #16929C
  cores.ciano, // #09D1C7
  cores.verdeAgua, // #46DFB3
  cores.verdeClaro, // #81EF99
];

// Distribuição de Cores
export const gradienteDistribuicaoCompleta = [0, 0.2, 0.4, 0.6, 0.8, 1]; // Todas as cores
export const gardianteDistribuicaoHeader = [0.4, 1]; // Header
export const gradianteDistribuicaoDownload = [0, 0.5, 1]; //Botão download

// Gradiente invertido
export const gradienteCoresInvertido = [...gradienteCores].reverse();

// Regras de componentes
export const bordas = {
  cardAutenticacao: 40, // CARD AUTENTICAÇÃO / CADASTRO
  cardObras: 25, // CARD DE OBRAS
  header: 35,
  input: 15, // INPUT TEXTO
};

export const dimensoes = {
  alturaInput: 50, // INPUT TEXTO
};

export const shadows = {
  padrao: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
};

// Tipografia Poppins
export const fontes = {
  regular: "Poppins_400Regular",
  media: "Poppins_500Medium",
  semiNegrito: "Poppins_600SemiBold",
  negrito: "Poppins_700Bold",
};

export default {
  cores,
  gradienteCores,
  gradienteCoresInvertido,
  gradienteDistribuicaoCompleta,
  gardianteDistribuicaoHeader,
  gradianteDistribuicaoDownload,
  bordas,
  dimensoes,
  shadows,
  fontes,
};
