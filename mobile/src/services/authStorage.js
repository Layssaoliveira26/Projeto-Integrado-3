let memoryToken = null;

export const authStorage = {
  getToken: () => {
    if (memoryToken) {
      return typeof memoryToken === "string" ? memoryToken.trim() : memoryToken;
    }
    const devToken = process.env.EXPO_PUBLIC_DEV_TOKEN;
    return devToken && typeof devToken === "string" ? devToken.trim() : null;
  },

  setToken: (token) => {
    memoryToken = token;
  },

  clearToken: () => {
    memoryToken = null;
  },

  hasToken: () => {
    return Boolean(memoryToken || process.env.EXPO_PUBLIC_DEV_TOKEN);
  },
};

export default authStorage;
