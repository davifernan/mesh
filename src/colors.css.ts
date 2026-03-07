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

// BetterCord: Discord color palette for dark theme
const darkThemeData = {
  Background: {
    Container: '#2B2D31',         // Discord: sidebar/channel list bg
    ContainerHover: '#35373C',   // Discord: hover state
    ContainerActive: '#404249',  // Discord: active/selected
    ContainerLine: '#1E1F22',    // Discord: dividers
    OnContainer: '#DBDEE1',      // Discord: primary text
  },

  Surface: {
    Container: '#313338',         // Discord: main chat bg
    ContainerHover: '#3A3C41',
    ContainerActive: '#404249',
    ContainerLine: '#232428',
    OnContainer: '#DBDEE1',
  },

  SurfaceVariant: {
    Container: '#1E1F22',         // Discord: tertiary bg (guild list)
    ContainerHover: '#25272B',
    ContainerActive: '#2B2D31',
    ContainerLine: '#17181A',
    OnContainer: '#B5BAC1',
  },

  Primary: {
    Main: '#5865F2',              // Discord brand blue/purple
    MainHover: '#4752C4',
    MainActive: '#3C45A5',
    MainLine: '#3440A0',
    OnMain: '#FFFFFF',
    Container: '#3C3F8A',
    ContainerHover: '#444899',
    ContainerActive: '#4C51A8',
    ContainerLine: '#5459B8',
    OnContainer: '#C9CEFF',
  },

  Secondary: {
    Main: '#DBDEE1',              // Discord: primary text
    MainHover: '#C4C9CE',
    MainActive: '#B5BAC1',
    MainLine: '#A1A6AF',
    OnMain: '#1E1F22',
    Container: '#35373C',
    ContainerHover: '#3A3C41',
    ContainerActive: '#404249',
    ContainerLine: '#4E5058',
    OnContainer: '#DBDEE1',
  },

  Success: {
    Main: '#23A55A',              // Discord: online green
    MainHover: '#1F9350',
    MainActive: '#1C8A4A',
    MainLine: '#198145',
    OnMain: '#FFFFFF',
    Container: '#1A4731',
    ContainerHover: '#1E5138',
    ContainerActive: '#225B3E',
    ContainerLine: '#266645',
    OnContainer: '#A0DCBB',
  },

  Warning: {
    Main: '#F0B232',              // Discord: idle yellow
    MainHover: '#D99E2B',
    MainActive: '#CC9529',
    MainLine: '#BF8C26',
    OnMain: '#000000',
    Container: '#4A3A15',
    ContainerHover: '#54411A',
    ContainerActive: '#5E491E',
    ContainerLine: '#685122',
    OnContainer: '#F5D390',
  },

  Critical: {
    Main: '#F23F43',              // Discord: danger red / DND
    MainHover: '#DA383C',
    MainActive: '#CE3438',
    MainLine: '#C13033',
    OnMain: '#FFFFFF',
    Container: '#5C1F21',
    ContainerHover: '#672326',
    ContainerActive: '#72272A',
    ContainerLine: '#7D2B2E',
    OnContainer: '#F9A8AA',
  },

  Other: {
    FocusRing: 'rgba(255, 255, 255, 0.5)',
    Shadow: 'rgba(0, 0, 0, 0.85)',
    Overlay: 'rgba(0, 0, 0, 0.7)',
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
