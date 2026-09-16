import { RealityConfig } from '../types';
import { testSurface } from './surface';

const day = 86400000;
const now = Date.now();
const TAU = Math.PI * 2;

export const testReality: RealityConfig = {
  id: 'test',
  name: "test",
  codeName: "test 1",
  spectral: "Class B Tachyon Radiance",
  description: "A newly synthesized custom universe branch within the sovereign multiverse.",
  bubblePos: [0, 0, 0],
  bubbleSize: 7500,
  colorA: '#38bdf8',
  colorB: '#ec4899',
  starColor: '#ffeedd',
  bodies: [
  {
    "id": "test-core",
    "name": "test Core Star",
    "kind": "star",
    "meaning": null,
    "note": "The stellar anchor of test.",
    "createdAt": 1789569705448,
    "radius": 6.5,
    "palette": {
      "deep": "#1c0e35",
      "base": "#38bdf8",
      "high": "#ffffff",
      "atmo": "#ec4899",
      "ice": "#ffffff"
    },
    "orbit": {
      "a": 0,
      "speed": 0,
      "phase": 0,
      "incl": 0
    }
  },
  {
    "id": "test-prime",
    "name": "test Prime",
    "kind": "planet",
    "meaning": "moment",
    "note": "The primordial terrestrial world of test.",
    "createdAt": 1789569705448,
    "radius": 2.2,
    "clouds": true,
    "nightside": true,
    "palette": {
      "deep": "#0c1b33",
      "base": "#10b981",
      "high": "#6ee7b7",
      "atmo": "#38bdf8",
      "ice": "#e0f2fe"
    },
    "orbit": {
      "a": 45,
      "speed": 0.01721420632103996,
      "phase": 1.2,
      "incl": 0.04
    }
  }
],
  entries: [],
};

export * from './surface';
