import { createTheme } from '@vanilla-extract/css';
import { color } from 'folds';

export const silverTheme = createTheme(color, {
  Background: {
    Container: '#DEDEDE',
    ContainerHover: '#D3D3D3',
    ContainerActive: '#C7C7C7',
    ContainerLine: '#BBBBBB',
    OnContainer: '#000000',
  },

  Surface: {
    Container: '#EAEAEA',
    ContainerHover: '#DEDEDE',
    ContainerActive: '#D3D3D3',
    ContainerLine: '#C7C7C7',
    OnContainer: '#000000',
  },

  SurfaceVariant: {
    Container: '#DEDEDE',
    ContainerHover: '#D3D3D3',
    ContainerActive: '#C7C7C7',
    ContainerLine: '#BBBBBB',
    OnContainer: '#000000',
  },

  Primary: {
    Main: '#1245A8',
    MainHover: '#103E97',
    MainActive: '#0F3B8F',
    MainLine: '#0E3786',
    OnMain: '#FFFFFF',
    Container: '#C4D0E9',
    ContainerHover: '#B8C7E5',
    ContainerActive: '#ACBEE1',
    ContainerLine: '#A0B5DC',
    OnContainer: '#0D3076',
  },

  Secondary: {
    Main: '#000000',
    MainHover: '#171717',
    MainActive: '#232323',
    MainLine: '#2F2F2F',
    OnMain: '#EAEAEA',
    Container: '#C7C7C7',
    ContainerHover: '#BBBBBB',
    ContainerActive: '#AFAFAF',
    ContainerLine: '#A4A4A4',
    OnContainer: '#0C0C0C',
  },

  Success: {
    Main: '#017343',
    MainHover: '#01683C',
    MainActive: '#016239',
    MainLine: '#015C36',
    OnMain: '#FFFFFF',
    Container: '#BFDCD0',
    ContainerHover: '#B3D5C7',
    ContainerActive: '#A6CEBD',
    ContainerLine: '#99C7B4',
    OnContainer: '#01512F',
  },

  Warning: {
    Main: '#864300',
    MainHover: '#793C00',
    MainActive: '#723900',
    MainLine: '#6B3600',
    OnMain: '#FFFFFF',
    Container: '#E1D0BF',
    ContainerHover: '#DBC7B2',
    ContainerActive: '#D5BDA6',
    ContainerLine: '#CFB499',
    OnContainer: '#5E2F00',
  },

  Critical: {
    Main: '#9D0F0F',
    MainHover: '#8D0E0E',
    MainActive: '#850D0D',
    MainLine: '#7E0C0C',
    OnMain: '#FFFFFF',
    Container: '#E7C3C3',
    ContainerHover: '#E2B7B7',
    ContainerActive: '#DDABAB',
    ContainerLine: '#D89F9F',
    OnContainer: '#6E0B0B',
  },

  Other: {
    FocusRing: 'rgba(0 0 0 / 50%)',
    Shadow: 'rgba(0 0 0 / 20%)',
    Overlay: 'rgba(0 0 0 / 50%)',
  },
});

// mesh color palette for dark theme
const darkThemeData = {
  Background: {
    Container: '#121317',         // sidebar + modals (hsl(220,13%,8%))
    ContainerHover: '#161820',
    ContainerActive: '#1a1c26',
    ContainerLine: '#0d0f11',     // darkest dividers (hsl(220,13%,6%))
    OnContainer: '#e8eaf0',       // near-white text
  },

  Surface: {
    Container: '#14161a',         // chat area (hsl(220,13%,9.5%))
    ContainerHover: '#181b20',
    ContainerActive: '#1c1f26',
    ContainerLine: '#121317',
    OnContainer: '#e8eaf0',
  },

  SurfaceVariant: {
    Container: '#0d0f11',         // deepest bg / guild list (hsl(220,13%,6%))
    ContainerHover: '#111317',
    ContainerActive: '#161820',
    ContainerLine: '#090a0e',
    OnContainer: '#9da4b5',       // muted text on dark
  },

  Primary: {
    Main: '#5865d5',              // mesh brand (hsl(242, 70%, 55%))
    MainHover: '#4a56c2',
    MainActive: '#3c45a5',
    MainLine: '#3440a0',
    OnMain: '#FFFFFF',
    Container: '#3c3f8a',
    ContainerHover: '#444899',
    ContainerActive: '#4c51a8',
    ContainerLine: '#5459b8',
    OnContainer: '#c9ceff',
  },

  Secondary: {
    Main: '#e8eaf0',
    MainHover: '#d0d4de',
    MainActive: '#c0c5d0',
    MainLine: '#b0b6c5',
    OnMain: '#0d0f14',
    Container: '#1a1c26',
    ContainerHover: '#1e202e',
    ContainerActive: '#222636',
    ContainerLine: '#2a2e3c',
    OnContainer: '#e8eaf0',
  },

  Success: {
    Main: '#2ea84d',              // mesh: primary button = GREEN (hsl(139, 55%, 44%))
    MainHover: '#279443',
    MainActive: '#22863c',
    MainLine: '#1e7535',
    OnMain: '#FFFFFF',
    Container: '#1a3828',
    ContainerHover: '#1e4030',
    ContainerActive: '#224838',
    ContainerLine: '#265040',
    OnContainer: '#a0dcb8',
  },

  Warning: {
    Main: '#F0B232',
    MainHover: '#D99E2B',
    MainActive: '#CC9529',
    MainLine: '#BF8C26',
    OnMain: '#000000',
    Container: '#4A3A15',
    ContainerHover: '#54411A',
    ContainerActive: '#5e491e',
    ContainerLine: '#685122',
    OnContainer: '#F5D390',
  },

  Critical: {
    Main: '#e03a3a',              // mesh status-danger (hsl(1, 77%, 55%))
    MainHover: '#cb3434',
    MainActive: '#c02e2e',
    MainLine: '#b42b2b',
    OnMain: '#FFFFFF',
    Container: '#4a1a1a',
    ContainerHover: '#551e1e',
    ContainerActive: '#622222',
    ContainerLine: '#702626',
    OnContainer: '#f5a0a0',
  },

  Other: {
    FocusRing: 'rgba(255, 255, 255, 0.5)',
    Shadow: 'rgba(0, 0, 0, 0.85)',
    Overlay: 'rgba(0, 0, 0, 0.85)',
  },
};

export const darkTheme = createTheme(color, darkThemeData);

export const butterTheme = createTheme(color, {
  ...darkThemeData,
  Background: {
    Container: '#1A1916',
    ContainerHover: '#262621',
    ContainerActive: '#33322C',
    ContainerLine: '#403F38',
    OnContainer: '#FFFBDE',
  },

  Surface: {
    Container: '#262621',
    ContainerHover: '#33322C',
    ContainerActive: '#403F38',
    ContainerLine: '#4D4B43',
    OnContainer: '#FFFBDE',
  },

  SurfaceVariant: {
    Container: '#33322C',
    ContainerHover: '#403F38',
    ContainerActive: '#4D4B43',
    ContainerLine: '#59584E',
    OnContainer: '#FFFBDE',
  },

  Secondary: {
    Main: '#FFFBDE',
    MainHover: '#E5E2C8',
    MainActive: '#D9D5BD',
    MainLine: '#CCC9B2',
    OnMain: '#1A1916',
    Container: '#403F38',
    ContainerHover: '#4D4B43',
    ContainerActive: '#59584E',
    ContainerLine: '#666459',
    OnContainer: '#F2EED3',
  },
});
