import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { realityDaemon } from './src/server/realityDaemon';
import { sanitizeFolderName, isInside } from './src/server/paths';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Start continuous background reality synchronization daemon
  realityDaemon.start(3000);

  // API: Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // API: Reality Daemon continuous scan status & telemetry
  app.get('/api/realities/daemon-status', (_req, res) => {
    res.json(realityDaemon.getStatus());
  });

  // API: List reality folders on disk
  app.get('/api/realities/folders', (_req, res) => {
    try {
      const realitiesDir = path.join(process.cwd(), 'src', 'realities');
      if (!fs.existsSync(realitiesDir)) {
        return res.json({ success: true, folders: [] });
      }
      const items = fs.readdirSync(realitiesDir, { withFileTypes: true });
      const folders = items
        .filter((dirent) => dirent.isDirectory() && dirent.name !== 'bin' && dirent.name !== '.bin')
        .map((dirent) => {
          const folderPath = path.join(realitiesDir, dirent.name);
          const hasIndex = fs.existsSync(path.join(folderPath, 'index.ts'));
          const hasSurface = fs.existsSync(path.join(folderPath, 'surface.ts'));
          return {
            name: dirent.name,
            path: `src/realities/${dirent.name}`,
            hasIndex,
            hasSurface,
          };
        });
      res.json({ success: true, folders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: List realities in the recycle bin
  app.get('/api/realities/bin', (_req, res) => {
    try {
      const binDir = path.join(process.cwd(), 'src', 'realities', 'bin');
      if (!fs.existsSync(binDir)) {
        return res.json({ success: true, bin: [] });
      }
      const items = fs.readdirSync(binDir, { withFileTypes: true });
      const bin = items
        .filter((d) => d.isDirectory())
        .map((d) => {
          const folderPath = path.join(binDir, d.name);
          const stats = fs.statSync(folderPath);
          return {
            folderName: d.name,
            path: `src/realities/bin/${d.name}`,
            trashedAt: stats.mtimeMs,
          };
        });
      res.json({ success: true, bin });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Move reality to bin
  app.post('/api/realities/bin/move-to-bin', (req, res) => {
    const { realityId, folderName } = req.body;
    const result = realityDaemon.moveToBin(realityId, folderName);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // API: Restore reality from bin
  app.post('/api/realities/bin/restore', (req, res) => {
    const { realityId, folderName } = req.body;
    const result = realityDaemon.restoreFromBin(realityId, folderName);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // API: Purge reality permanently from bin
  app.post('/api/realities/bin/purge', (req, res) => {
    const { realityId, folderName } = req.body;
    const result = realityDaemon.purgeFromBin(realityId, folderName);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // API: Empty entire bin
  app.post('/api/realities/bin/empty', (_req, res) => {
    const result = realityDaemon.emptyBin();
    res.json(result);
  });

  // API: Rename reality folder
  app.post('/api/realities/rename-folder', (req, res) => {
    const { realityId, newName } = req.body;
    if (!realityId || !newName) {
      return res.status(400).json({ success: false, error: 'realityId and newName are required' });
    }
    const result = realityDaemon.renameRealityFolder(realityId, newName);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // API: Create a new reality folder and backend files on disk
  app.post('/api/realities/create-folder', (req, res) => {
    try {
      const {
        id,
        name,
        codeName,
        spectral,
        description,
        colorA = '#00f5d4',
        colorB = '#8b5cf6',
        starColor = '#ffeedd',
        bodies = [],
        entries = [],
        folderName: customFolderName,
      } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, error: 'Reality name is required' });
      }

      // Generate clean folder name (e.g., "test" -> "test", "Chronos Paradox" -> "chronosParadox", "X" -> "x")
      // customFolderName arrives from the request body: sanitize it like any
      // other user path component before it reaches path.join.
      let folderName = sanitizeFolderName(customFolderName);
      if (!folderName) {
        const rawSanitized = name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
        const words = rawSanitized.split(/[\s-_]+/);
        folderName = words
          .map((w, idx) => (idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
          .join('');
      }

      if (!folderName) {
        folderName = `reality_${Date.now()}`;
      }

      const realitiesDir = path.join(process.cwd(), 'src', 'realities');
      const targetDir = path.join(realitiesDir, folderName);
      if (!isInside(realitiesDir, targetDir)) {
        return res.status(400).json({ success: false, error: 'Invalid folder name' });
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const cleanId = id || folderName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const varName = `${folderName}Reality`;
      const surfaceVarName = `${folderName}Surface`;

      // 1. Create surface.ts
      const surfaceContent = `import { UniverseSurfaceConfig } from '../../engine/surface/types';

export const ${surfaceVarName}: UniverseSurfaceConfig = {
  realityId: '${cleanId}',
  name: ${JSON.stringify(name)},
  colorA: '${colorA}',
  colorB: '${colorB}',
  deepColor: '#030108',
  starColor: '${starColor}',
  webFilaments: '${colorA}',
  nebulaIntensity: 1.0,
  dustLaneIntensity: 0.8,
  starDensity: 0.85,
};
`;
      fs.writeFileSync(path.join(targetDir, 'surface.ts'), surfaceContent, 'utf-8');

      // 2. Create index.ts
      const indexContent = `import { RealityConfig } from '../types';
import { ${surfaceVarName} } from './surface';

const day = 86400000;
const now = Date.now();
const TAU = Math.PI * 2;

export const ${varName}: RealityConfig = {
  id: '${cleanId}',
  name: ${JSON.stringify(name)},
  codeName: ${JSON.stringify(codeName || `REALITY-${folderName.toUpperCase()}`)},
  spectral: ${JSON.stringify(spectral || 'Quantum Singularity')},
  description: ${JSON.stringify(description || `The ${name} continuum realm.`)},
  bubblePos: [0, 0, 0],
  bubbleSize: 7500,
  colorA: '${colorA}',
  colorB: '${colorB}',
  starColor: '${starColor}',
  bodies: ${JSON.stringify(bodies.length > 0 ? bodies : [
    {
      id: `${cleanId}-core`,
      name: `${name} Core Star`,
      kind: 'star',
      meaning: null,
      note: `The stellar anchor of ${name}.`,
      createdAt: Date.now(),
      radius: 6.5,
      palette: { deep: '#1c0e35', base: colorA, high: '#ffffff', atmo: colorB, ice: '#ffffff' },
      orbit: { a: 0, speed: 0, phase: 0, incl: 0 },
    },
    {
      id: `${cleanId}-prime`,
      name: `${name} Prime`,
      kind: 'planet',
      meaning: 'moment',
      note: `The primordial terrestrial world of ${name}.`,
      createdAt: Date.now(),
      radius: 2.2,
      clouds: true,
      nightside: true,
      palette: { deep: '#0c1b33', base: '#10b981', high: '#6ee7b7', atmo: colorA, ice: '#e0f2fe' },
      orbit: { a: 45, speed: Math.PI * 2 / 365, phase: 1.2, incl: 0.04 },
    }
  ], null, 2)},
  entries: ${JSON.stringify(entries, null, 2)},
};

export * from './surface';
`;
      fs.writeFileSync(path.join(targetDir, 'index.ts'), indexContent, 'utf-8');

      console.log(`[API] Created reality folder on disk: src/realities/${folderName}`);

      res.json({
        success: true,
        message: `Reality folder created successfully at src/realities/${folderName}`,
        folderName,
        folderPath: `src/realities/${folderName}`,
        files: ['index.ts', 'surface.ts'],
        realityId: cleanId,
      });
    } catch (err: any) {
      console.error('Error creating reality folder:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Delete a reality folder on disk (transfers to src/realities/bin/)
  app.post('/api/realities/delete-folder', (req, res) => {
    try {
      const { realityId, folderName } = req.body;
      if (!realityId && !folderName) {
        return res.status(400).json({ success: false, error: 'realityId or folderName is required' });
      }

      // Protect Sol Prime anchor
      if (realityId === 'sol-prime' || folderName === 'solPrime' || folderName === 'sol-prime') {
        return res.status(400).json({ success: false, error: 'Sol Prime is protected from deletion.' });
      }

      // Transfer into bin directory via realityDaemon
      const binResult = realityDaemon.moveToBin(realityId, folderName);
      if (binResult.success) {
        return res.json({
          success: true,
          movedToBin: binResult.folderMoved,
          message: `Reality ${binResult.folderMoved} transferred to Quantum Bin on disk (src/realities/bin/${binResult.folderMoved})`,
        });
      }

      // Fallback: if moveToBin couldn't find directory, check and clean
      res.json({
        success: true,
        message: 'Reality purged from active state roster.',
      });
    } catch (err: any) {
      console.error('Error in delete-folder:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // RESTful DELETE alias
  app.delete('/api/realities/:id', (req, res) => {
    const realityId = req.params.id;
    if (realityId === 'sol-prime' || realityId === 'solPrime') {
      return res.status(400).json({ success: false, error: 'Sol Prime cannot be deleted.' });
    }
    const realitiesDir = path.join(process.cwd(), 'src', 'realities');
    try {
      const items = fs.readdirSync(realitiesDir, { withFileTypes: true });
      for (const d of items) {
        if (!d.isDirectory() || d.name === 'solPrime') continue;
        const cleanRid = realityId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanDir = d.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanDir === cleanRid) {
          const target = path.join(realitiesDir, d.name);
          // d.name comes from readdir so it is already a direct child, but
          // assert containment before the recursive delete regardless.
          if (!isInside(realitiesDir, target)) continue;
          fs.rmSync(target, { recursive: true, force: true });
          return res.json({ success: true, deleted: d.name });
        }
      }
      res.json({ success: true, message: 'Cleaned up' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌌 Multiverse Server running on http://localhost:${PORT}`);
  });
}

startServer();
