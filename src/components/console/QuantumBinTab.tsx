import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, RotateCcw, AlertTriangle, ShieldCheck, Activity, Folder, Sparkles, CheckCircle2, Clock, Globe } from 'lucide-react';
import { actions, useUniverse } from '../../state';
import { realityApi } from '../../desktop/adapter';
import { toast } from '../../ui/toast';
import { TrashedReality } from '../../types';

interface DaemonStatus {
  active: boolean;
  lastScanTime: number;
  scanCount: number;
  activeFolders: string[];
  binFolders: string[];
  operationsLog: { timestamp: number; type: string; details: string }[];
}

export const QuantumBinTab: React.FC = () => {
  const state = useUniverse();
  const binRealities: TrashedReality[] = state.binRealities || [];
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
  const [diskBin, setDiskBin] = useState<{ folderName: string; path: string; trashedAt: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const [daemonRes, binRes] = await Promise.all([
        realityApi<DaemonStatus>('/api/realities/daemon-status', undefined, 'GET'),
        realityApi<{ bin: { folderName: string; path: string; trashedAt: number }[] }>('/api/realities/bin', undefined, 'GET'),
      ]);
      if (daemonRes) setDaemonStatus(daemonRes);
      if (binRes && binRes.bin) setDiskBin(binRes.bin);
    } catch (e) {
      console.warn('Could not fetch daemon status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleRestore = (realityId: string, name: string) => {
    actions.restoreReality(realityId);
    toast(`✦ Reality ${name} restored from Quantum Bin to active continuum!`);
    fetchStatus();
  };

  const handlePurge = (realityId: string, name: string) => {
    actions.purgeRealityFromBin(realityId);
    toast(`Reality ${name} permanently purged from disk.`);
    fetchStatus();
  };

  const handleEmptyBin = () => {
    actions.emptyRealityBin();
    setConfirmEmpty(false);
    toast('Quantum Bin completely emptied.');
    fetchStatus();
  };

  return (
    <div className="flex flex-col gap-5 text-slate-100">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-rose-500/25 backdrop-blur-xl flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-base font-bold text-white tracking-wide">
                QUANTUM RECYCLE BIN (DUSTBIN)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                {binRealities.length} in stasis
              </span>
            </div>
            <p className="font-mono text-[10px] text-slate-400">
              Deleted realities are safely transferred to <code className="text-cyan-300">src/realities/bin/</code> and can be restored at any time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Disk</span>
          </button>

          {binRealities.length > 0 && (
            confirmEmpty ? (
              <div className="flex items-center gap-1.5 animate-in fade-in">
                <button
                  onClick={handleEmptyBin}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(225,29,72,0.5)]"
                >
                  Confirm Empty All
                </button>
                <button
                  onClick={() => setConfirmEmpty(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-mono"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEmpty(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-mono tracking-wider transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empty Bin</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* CONTINUOUS REALITY DAEMON STATUS CARD */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-cyan-500/20 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>Continuously Scanning Reality Daemon (Node.js/TypeScript)</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            Live Daemon Scan Loop Active · 3000ms
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs mb-3">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 block">Total Scans Executed</span>
            <span className="text-sm font-bold text-white">{daemonStatus?.scanCount ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 block">Active Disk Folders</span>
            <span className="text-sm font-bold text-cyan-300">{daemonStatus?.activeFolders?.length ?? 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 block">Quantum Bin Folders</span>
            <span className="text-sm font-bold text-rose-300">{daemonStatus?.binFolders?.length ?? diskBin.length}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 block">Daemon Health</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Nominal
            </span>
          </div>
        </div>

        {/* Operations Activity Log */}
        {daemonStatus?.operationsLog && daemonStatus.operationsLog.length > 0 && (
          <div className="mt-2 p-2.5 rounded-xl bg-slate-950/60 border border-white/5 font-mono text-[10px] text-slate-400 max-h-24 overflow-y-auto custom-scroll">
            <div className="text-[9px] uppercase tracking-wider text-cyan-400/80 mb-1">Daemon Audit Stream:</div>
            {daemonStatus.operationsLog.slice(0, 5).map((log, idx) => (
              <div key={idx} className="flex items-center gap-2 truncate py-0.5">
                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="text-cyan-300 font-bold">{log.type}:</span>
                <span className="text-slate-300 truncate">{log.details}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REALITIES IN STASIS (THE BIN) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-rose-400" />
            Stored Realities in Quantum Bin ({binRealities.length})
          </span>
        </div>

        {binRealities.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/2 border border-white/5 font-mono text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
            <p className="text-slate-300 font-semibold">Quantum Bin is Empty</p>
            <p className="text-[11px] text-slate-500 max-w-md">
              No realities currently in trash. When you delete any reality, its folder is transferred to <code className="text-cyan-400">src/realities/bin/</code> and preserved here for one-click restoration.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {binRealities.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900/70 border border-rose-500/25 hover:border-rose-400/45 backdrop-blur-xl shadow-lg flex flex-col justify-between gap-3 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full inline-block shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${item.colorA || '#f43f5e'}, ${item.colorB || '#8b5cf6'})` }}
                        />
                        {item.name}
                      </h4>
                      <p className="font-mono text-[9px] text-cyan-300/80 mt-0.5">
                        {item.spectral || 'Class Luminary Continuum'} · {item.codeName || item.id}
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/30 text-[9px] font-mono text-rose-300">
                      In Bin
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 mb-2">
                    {item.description || 'Parallel universe archived in stasis.'}
                  </p>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 font-mono text-[9.5px] text-slate-400 flex items-center justify-between">
                    <span className="truncate">📁 src/realities/bin/{item.name.replace(/[^a-zA-Z0-9]/g, '')}/</span>
                    <span className="text-slate-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(item.deletedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    onClick={() => handlePurge(item.id, item.name)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 text-xs font-mono transition-all cursor-pointer"
                  >
                    Purge Permanently
                  </button>

                  <button
                    onClick={() => handleRestore(item.id, item.name)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs font-mono shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>✦ Restore Reality</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
