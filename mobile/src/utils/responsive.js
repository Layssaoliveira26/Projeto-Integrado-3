import { useState, useEffect } from "react";
import { Dimensions, PixelRatio, useWindowDimensions, Keyboard, Platform } from "react-native";

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const isTabletDevice = (width = Dimensions.get("window").width, height = Dimensions.get("window").height) => {
  const menorDimensao = Math.min(width, height);
  return menorDimensao >= 600;
};

export const isSmallPhone = (width = Dimensions.get("window").width) => {
  return width <= 360;
};

export const getEffectiveWidth = () => {
  const currentWidth = Dimensions.get("window").width || BASE_WIDTH;
  // Em tablets, permitimos uma escala moderadamente maior para harmonizar com a tela
  if (isTabletDevice(currentWidth)) {
    return Math.min(currentWidth * 0.65, 560);
  }
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

export const useResponsiveLayout = () => {
  const { width, height } = useWindowDimensions();
  const isTablet = isTabletDevice(width, height);
  const isSmall = isSmallPhone(width);
  const isLandscape = width > height;

  return {
    width,
    height,
    isTablet,
    isSmallDevice: isSmall,
    isLandscape,
    contentMaxWidth: isTablet ? 680 : "100%",
    cardAuthMaxWidth: isTablet ? 480 : 400,
  };
};

export const useKeyboardPadding = (basePadding = 36, extraOffset = 24) => {
  const [padding, setPadding] = useState(basePadding);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e) => {
      const keyboardHeight = e?.endCoordinates?.height || 280;
      setPadding(basePadding + keyboardHeight + extraOffset);
    };

    const onHide = () => {
      setPadding(basePadding);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow?.remove?.();
      subHide?.remove?.();
    };
  }, [basePadding, extraOffset]);

  return padding;
};

export default {
  scale,
  verticalScale,
  moderateScale,
  rem,
  getEffectiveWidth,
  getEffectiveHeight,
  isTabletDevice,
  isSmallPhone,
  useResponsiveLayout,
  useKeyboardPadding,
};

