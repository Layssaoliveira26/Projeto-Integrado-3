let memoryToken = null;

export const authStorage = {
  getToken: () => {
    if (memoryToken) {
      return typeof memoryToken === "string" ? memoryToken.trim() : memoryToken;
    }
    return null;
  },

  setToken: (token) => {
    memoryToken = token;
  },

  clearToken: () => {
    memoryToken = null;
  },

  hasToken: () => {
    return Boolean(memoryToken);
  },
};

export default authStorage;
