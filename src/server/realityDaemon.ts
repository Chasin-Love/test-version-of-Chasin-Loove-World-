import fs from 'fs';
import path from 'path';
import { sanitizeFolderName, isInside } from './paths';

export interface DaemonStatus {
  active: boolean;
  lastScanTime: number;
  scanCount: number;
  activeFolders: string[];
  binFolders: string[];
  operationsLog: { timestamp: number; type: string; details: string }[];
}

const MAX_LOGS = 50;

class RealitySyncDaemon {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scanCount: number = 0;
  private lastScanTime: number = 0;
  private operationsLog: { timestamp: number; type: string; details: string }[] = [];

  private realitiesDir: string = path.join(process.cwd(), 'src', 'realities');
  private binDir: string = path.join(process.cwd(), 'src', 'realities', 'bin');

  constructor() {
    this.ensureDirectories();
  }

  public log(type: string, details: string) {
    const entry = { timestamp: Date.now(), type, details };
    this.operationsLog.unshift(entry);
    if (this.operationsLog.length > MAX_LOGS) {
      this.operationsLog.pop();
    }
    console.log(`[REALITY-DAEMON] [${type}] ${details}`);
  }

  public ensureDirectories() {
    if (!fs.existsSync(this.realitiesDir)) {
      fs.mkdirSync(this.realitiesDir, { recursive: true });
    }
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
  }

  public start(intervalMs: number = 3000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.ensureDirectories();
    this.log('DAEMON_START', `Continuously scanning realities every ${intervalMs}ms`);

    // Run initial scan
    this.scanAndSync();

    this.intervalId = setInterval(() => {
      this.scanAndSync();
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.log('DAEMON_STOP', 'Daemon paused');
  }

  public scanAndSync() {
    this.scanCount++;
    this.lastScanTime = Date.now();
    this.ensureDirectories();

    try {
      const items = fs.readdirSync(this.realitiesDir, { withFileTypes: true });

      for (const dirent of items) {
        if (!dirent.isDirectory()) continue;
        if (dirent.name === 'bin' || dirent.name === '.bin') continue;

        const folderPath = path.join(this.realitiesDir, dirent.name);
        const indexPath = path.join(folderPath, 'index.ts');
        const surfacePath = path.join(folderPath, 'surface.ts');
        const varName = `${dirent.name.replace(/[^a-zA-Z0-9]/g, '')}Reality`;
        const id = dirent.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const title = dirent.name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

        // Check if index.ts exists; if missing, repair
        if (!fs.existsSync(indexPath)) {
          const indexCode = `import { RealityConfig } from '../types';\n\nexport const ${varName}: RealityConfig = {\n  id: '${id}',\n  name: '${title}',\n  codeName: '${id.toUpperCase()}',\n  spectral: 'Class A Luminary Continuum',\n  colorA: '#00f5d4',\n  colorB: '#8b5cf6',\n  description: 'Synthesized parallel reality synchronized by Reality Daemon.',\n  bodies: [\n    {\n      id: 'anchor',\n      name: '${title} Anchor Star',\n      kind: 'star',\n      createdAt: Date.now(),\n      radius: 7.5,\n      palette: { deep: '#0f172a', base: '#00f5d4', high: '#ffffff', atmo: '#8b5cf6', ice: '#c084fc' },\n      orbit: { a: 0, speed: 0, phase: 0, incl: 0 },\n    }\n  ],\n};\n\nexport * from './surface';\n`;

          fs.writeFileSync(indexPath, indexCode, 'utf-8');
          this.log('AUTOREPAIR_INDEX', `Generated missing index.ts for src/realities/${dirent.name}`);
        }

        // Check if surface.ts exists; if missing, repair
        if (!fs.existsSync(surfacePath)) {
          // Must match the real UniverseSurfaceConfig schema (same as the
          // server's create-folder generator) so daemon-repaired realities
          // register a proper surface preset instead of a foreign interface.
          const surfaceVarName = `${varName}Surface`;
          const surfaceCode = `import { UniverseSurfaceConfig } from '../../engine/surface/types';\n\nexport const ${surfaceVarName}: UniverseSurfaceConfig = {\n  realityId: '${id}',\n  name: '${title}',\n  colorA: '#00f5d4',\n  colorB: '#8b5cf6',\n  deepColor: '#030108',\n  starColor: '#ffeedd',\n  webFilaments: '#00f5d4',\n  nebulaIntensity: 1.0,\n  dustLaneIntensity: 0.8,\n  starDensity: 0.85,\n};\n`;
          fs.writeFileSync(surfacePath, surfaceCode, 'utf-8');
          this.log('AUTOREPAIR_SURFACE', `Generated missing surface.ts for src/realities/${dirent.name}`);
        }
      }
    } catch (err: any) {
      console.error('[REALITY-DAEMON] Error during scan:', err);
    }
  }

  public moveToBin(realityId: string, folderName?: string): { success: boolean; folderMoved?: string; error?: string } {
    this.ensureDirectories();

    if (realityId === 'sol-prime' || folderName === 'solPrime' || folderName === 'sol-prime') {
      return { success: false, error: 'Sol Prime is the primordial anchor and cannot be moved to Bin.' };
    }

    try {
      const items = fs.readdirSync(this.realitiesDir, { withFileTypes: true });
      let targetFolder = '';

      for (const dirent of items) {
        if (!dirent.isDirectory()) continue;
        if (dirent.name === 'bin' || dirent.name === '.bin' || dirent.name === 'solPrime') continue;

        if (folderName && (dirent.name.toLowerCase() === folderName.toLowerCase() || dirent.name === folderName)) {
          targetFolder = dirent.name;
          break;
        }

        if (realityId) {
          const cleanRid = realityId.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanDirName = dirent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanDirName === cleanRid || dirent.name === realityId) {
            targetFolder = dirent.name;
            break;
          }
        }
      }

      if (!targetFolder && folderName) {
        // folderName may arrive straight from a request body: sanitize before
        // it is used to build filesystem paths (path traversal guard).
        targetFolder = sanitizeFolderName(folderName);
      }

      if (!targetFolder) {
        return { success: false, error: `No active folder found matching ${realityId || folderName}` };
      }

      if (targetFolder === 'bin' || targetFolder === '.bin') {
        return { success: false, error: 'Refusing to move the bin directory into itself.' };
      }

      const srcPath = path.join(this.realitiesDir, targetFolder);
      const destPath = path.join(this.binDir, targetFolder);
      if (!isInside(this.realitiesDir, srcPath) || !isInside(this.binDir, destPath)) {
        return { success: false, error: 'Resolved path escaped the realities tree; refused.' };
      }
      if (!fs.existsSync(srcPath)) {
        return { success: false, error: `Directory ${srcPath} does not exist.` };
      }

      // If destination exists, clean it first
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }

      fs.renameSync(srcPath, destPath);
      this.log('MOVE_TO_BIN', `Moved ${targetFolder} to src/realities/bin/${targetFolder}`);
      return { success: true, folderMoved: targetFolder };
    } catch (err: any) {
      this.log('MOVE_TO_BIN_ERROR', err.message);
      return { success: false, error: err.message };
    }
  }

  public restoreFromBin(realityId: string, folderName?: string): { success: boolean; folderRestored?: string; error?: string } {
    this.ensureDirectories();

    try {
      const items = fs.readdirSync(this.binDir, { withFileTypes: true });
      let targetFolder = '';

      for (const dirent of items) {
        if (!dirent.isDirectory()) continue;

        if (folderName && (dirent.name.toLowerCase() === folderName.toLowerCase() || dirent.name === folderName)) {
          targetFolder = dirent.name;
          break;
        }

        if (realityId) {
          const cleanRid = realityId.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanDirName = dirent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanDirName === cleanRid || dirent.name === realityId) {
            targetFolder = dirent.name;
            break;
          }
        }
      }

      if (!targetFolder) {
        return { success: false, error: `No trashed folder found for ${realityId || folderName}` };
      }

      const srcPath = path.join(this.binDir, targetFolder);
      const destPath = path.join(this.realitiesDir, targetFolder);
      if (!isInside(this.binDir, srcPath) || !isInside(this.realitiesDir, destPath)) {
        return { success: false, error: 'Resolved path escaped the realities tree; refused.' };
      }

      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }

      fs.renameSync(srcPath, destPath);
      this.log('RESTORE_FROM_BIN', `Restored ${targetFolder} from bin back to src/realities/${targetFolder}`);
      return { success: true, folderRestored: targetFolder };
    } catch (err: any) {
      this.log('RESTORE_ERROR', err.message);
      return { success: false, error: err.message };
    }
  }

  public purgeFromBin(realityId: string, folderName?: string): { success: boolean; error?: string } {
    this.ensureDirectories();

    try {
      const items = fs.readdirSync(this.binDir, { withFileTypes: true });
      let targetFolder = '';

      for (const dirent of items) {
        if (!dirent.isDirectory()) continue;

        if (folderName && (dirent.name.toLowerCase() === folderName.toLowerCase() || dirent.name === folderName)) {
          targetFolder = dirent.name;
          break;
        }

        if (realityId) {
          const cleanRid = realityId.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanDirName = dirent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanDirName === cleanRid || dirent.name === realityId) {
            targetFolder = dirent.name;
            break;
          }
        }
      }

      if (!targetFolder) {
        return { success: false, error: `Folder not found in bin` };
      }

      const targetPath = path.join(this.binDir, targetFolder);
      if (!isInside(this.binDir, targetPath)) {
        return { success: false, error: 'Resolved path escaped the bin tree; refused.' };
      }
      fs.rmSync(targetPath, { recursive: true, force: true });
      this.log('PURGE_BIN', `Permanently erased src/realities/bin/${targetFolder}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public emptyBin(): { success: boolean; count: number; error?: string } {
    this.ensureDirectories();

    try {
      const items = fs.readdirSync(this.binDir, { withFileTypes: true });
      let count = 0;

      for (const dirent of items) {
        if (dirent.isDirectory()) {
          const target = path.join(this.binDir, dirent.name);
          if (!isInside(this.binDir, target)) continue;
          fs.rmSync(target, { recursive: true, force: true });
          count++;
        }
      }

      this.log('EMPTY_BIN', `Purged ${count} realities from bin`);
      return { success: true, count };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  }

  public renameRealityFolder(realityId: string, newName: string): { success: boolean; newFolderName?: string; error?: string } {
    this.ensureDirectories();

    if (realityId === 'sol-prime') {
      return { success: false, error: 'Sol Prime cannot be renamed on disk' };
    }

    try {
      const cleanNew = newName.trim().replace(/[^a-zA-Z0-9]/g, '');
      // An empty result must be rejected outright: otherwise newPath would
      // resolve to the realities directory itself and the existsSync cleanup
      // below would recursively delete the entire realities tree.
      if (!cleanNew) {
        return { success: false, error: 'New name contains no valid characters.' };
      }
      const newFolderName = cleanNew.charAt(0).toLowerCase() + cleanNew.slice(1);

      const items = fs.readdirSync(this.realitiesDir, { withFileTypes: true });
      let oldFolderName = '';

      for (const dirent of items) {
        if (!dirent.isDirectory()) continue;
        if (dirent.name === 'bin' || dirent.name === 'solPrime') continue;

        const cleanRid = realityId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanDirName = dirent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanDirName === cleanRid || dirent.name === realityId) {
          oldFolderName = dirent.name;
          break;
        }
      }

      if (!oldFolderName) {
        return { success: false, error: `Could not find reality folder for ${realityId}` };
      }

      if (oldFolderName === newFolderName) {
        return { success: true, newFolderName };
      }

      const oldPath = path.join(this.realitiesDir, oldFolderName);
      const newPath = path.join(this.realitiesDir, newFolderName);
      if (!isInside(this.realitiesDir, oldPath) || !isInside(this.realitiesDir, newPath)) {
        return { success: false, error: 'Resolved path escaped the realities tree; refused.' };
      }

      if (fs.existsSync(newPath)) {
        fs.rmSync(newPath, { recursive: true, force: true });
      }

      fs.renameSync(oldPath, newPath);

      // Update index.ts inside new folder
      const indexPath = path.join(newPath, 'index.ts');
      if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, 'utf-8');
        content = content.replace(/name:\s*['"][^'"]*['"]/, `name: '${newName.replace(/'/g, "\\'")}'`);
        fs.writeFileSync(indexPath, content, 'utf-8');
      }

      this.log('RENAME_FOLDER', `Renamed src/realities/${oldFolderName} -> src/realities/${newFolderName}`);
      return { success: true, newFolderName };
    } catch (err: any) {
      this.log('RENAME_ERROR', err.message);
      return { success: false, error: err.message };
    }
  }

  public getStatus(): DaemonStatus {
    this.ensureDirectories();

    const activeFolders: string[] = [];
    const binFolders: string[] = [];

    try {
      const active = fs.readdirSync(this.realitiesDir, { withFileTypes: true });
      for (const a of active) {
        if (a.isDirectory() && a.name !== 'bin' && a.name !== '.bin') {
          activeFolders.push(a.name);
        }
      }

      const bin = fs.readdirSync(this.binDir, { withFileTypes: true });
      for (const b of bin) {
        if (b.isDirectory()) {
          binFolders.push(b.name);
        }
      }
    } catch (e) {
      console.error(e);
    }

    return {
      active: this.isRunning,
      lastScanTime: this.lastScanTime,
      scanCount: this.scanCount,
      activeFolders,
      binFolders,
      operationsLog: [...this.operationsLog],
    };
  }
}

export const realityDaemon = new RealitySyncDaemon();
