import { Dimensions, PixelRatio } from "react-native";

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const getEffectiveWidth = () => {
  const currentWidth = Dimensions.get("window").width || BASE_WIDTH;
  return Math.min(Math.max(currentWidth, 320), 480);
};

export const getEffectiveHeight = () => {
  const currentHeight = Dimensions.get("window").height || BASE_HEIGHT;
  return Math.min(Math.max(currentHeight, 568), 920);
};

export const scale = (size) => {
  return (getEffectiveWidth() / BASE_WIDTH) * size;
};

export const verticalScale = (size) => {
  return (getEffectiveHeight() / BASE_HEIGHT) * size;
};

export const moderateScale = (size, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

export const rem = (multiplier = 1) => {
  const scaled = moderateScale(multiplier * 16, 0.4);
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
};

export default {
  scale,
  verticalScale,
  moderateScale,
  rem,
  getEffectiveWidth,
  getEffectiveHeight,
};
