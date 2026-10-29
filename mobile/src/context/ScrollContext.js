import { createContext } from "react";

export const ScrollContext = createContext({
  scrollTo: () => {},
  scrollToEnd: () => {},
});

export default ScrollContext;
