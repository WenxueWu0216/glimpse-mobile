export interface Theme {
  dark: boolean;
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  skeleton: string;
  chip: string;
  danger: string;
  banner: string;
  onBanner: string;
}

export const lightTheme: Theme = {
  dark: false,
  background: '#F5F5F2',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textMuted: '#6E6E76',
  border: '#E4E4E0',
  primary: '#F0456A',
  onPrimary: '#FFFFFF',
  skeleton: '#E6E6E2',
  chip: '#EFEFEC',
  danger: '#C62828',
  banner: '#3A3A3F',
  onBanner: '#FFFFFF',
};

export const darkTheme: Theme = {
  dark: true,
  background: '#0F0F11',
  card: '#1B1B1F',
  text: '#F2F2F3',
  textMuted: '#9A9AA3',
  border: '#2B2B31',
  primary: '#FF6B8A',
  onPrimary: '#1B1B1F',
  skeleton: '#26262B',
  chip: '#26262B',
  danger: '#FF8A80',
  banner: '#E8E8EA',
  onBanner: '#1C1C1E',
};
