import { useRef, useState } from 'react';
import { ArrowLeft, Play, Upload } from 'lucide-react';
import {
  CAR_ARCHETYPES,
  CAR_FINISHES,
  CarArchetypeId,
  CarFinishOption,
} from '../game/types';

interface GarageOverlayProps {
  selectedArchetype: CarArchetypeId;
  selectedFinish: CarFinishOption;
  onSelectVehicle: (archetype: CarArchetypeId, finish: CarFinishOption) => void;
  onImportGlb: (file: File) => Promise<void>;
  onPlayNow: () => void;
  onBack: () => void;
}

export function GarageOverlay({
  selectedArchetype,
  selectedFinish,
  onSelectVehicle,
  onImportGlb,
  onPlayNow,
  onBack,
}: GarageOverlayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const spec = CAR_ARCHETYPES[selectedArchetype];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadStatus('Loading model...');
      await onImportGlb(file);
      setUploadStatus(`Loaded ${file.name}`);
    } catch {
      setUploadStatus('Invalid GLTF/GLB model');
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4 md:p-6">
      {/* Top minimal bar keeping 3D turntable 100% open */}
      <div className="pointer-events-auto flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[40px] items-center gap-2 rounded-lg border border-white/15 bg-[#090d16]/90 px-3.5 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Menu</span>
        </button>

        <div className="rounded-lg border border-white/10 bg-[#090d16]/90 px-3.5 py-1.5 text-right">
          <div className="font-display text-sm font-bold text-white sm:text-base">
            {spec.name}
          </div>
          <div className="hidden text-xs text-slate-400 sm:block">
            {spec.subtitle} · Drag to Orbit · Scroll to Zoom
          </div>
        </div>
      </div>

      {/* Unified bottom control dock (zero side-panel occlusion) */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-xl border border-white/12 bg-[#090d16]/92 p-3 shadow-2xl sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Chassis Archetypes */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Chassis
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CAR_ARCHETYPES) as CarArchetypeId[]).map((id) => {
                const car = CAR_ARCHETYPES[id];
                const active = selectedArchetype === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectVehicle(id, selectedFinish)}
                    className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-sky-500 text-slate-950'
                        : 'border border-white/10 bg-slate-900/90 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {car.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Metallic Clear-Coat Finishes */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Paint Finish · {selectedFinish.name}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CAR_FINISHES.map((fin) => {
                const active = selectedFinish.id === fin.id;
                return (
                  <button
                    key={fin.id}
                    type="button"
                    aria-label={`Select ${fin.name} paint`}
                    onClick={() => onSelectVehicle(selectedArchetype, fin)}
                    className={`h-9 w-9 rounded-lg border-2 transition-transform ${
                      active
                        ? 'scale-110 border-white'
                        : 'border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: fin.primaryColor }}
                  />
                );
              })}
            </div>
          </div>

          {/* Custom GLB Loader + Play CTA */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{uploadStatus || 'Load GLB'}</span>
            </button>

            <button
              type="button"
              data-start="true"
              onClick={onPlayNow}
              className="flex min-h-[42px] items-center gap-2 rounded-lg bg-sky-500 px-5 py-2 font-display text-sm font-bold text-slate-950 hover:bg-sky-400 whitespace-nowrap"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              <span>Play Match</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
