import type {
  GraphicsCapabilitiesProfile,
  GraphicsPreset,
  GraphicsSettingMode,
  ResolvedGraphicsConfig,
} from './types';

export function detectAutoQualityPreset(
  profile: GraphicsCapabilitiesProfile
): GraphicsPreset {
  if (profile.isSoftwareGl) {
    return 'LOW';
  }

  if (profile.isMobile) {
    if (profile.deviceMemoryGb >= 6 && profile.hardwareConcurrency >= 6) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  if (
    profile.deviceMemoryGb >= 8 &&
    profile.hardwareConcurrency >= 8 &&
    profile.maxTextureSize >= 8192
  ) {
    return 'ULTRA';
  }

  if (profile.deviceMemoryGb >= 4 && profile.hardwareConcurrency >= 4) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

export function resolveGraphicsConfig(
  mode: GraphicsSettingMode,
  profile: GraphicsCapabilitiesProfile,
  options: { motionBlur: boolean; depthOfField: boolean }
): ResolvedGraphicsConfig {
  const preset: GraphicsPreset =
    mode === 'AUTO' ? detectAutoQualityPreset(profile) : mode;

  const dpr = Math.max(1, profile.devicePixelRatio || 1);

  switch (preset) {
    case 'LOW':
      return {
        preset,
        pixelRatio: profile.isSoftwareGl ? 1 : Math.min(dpr, 1.0),
        textureSize: 512,
        anisotropy: 1,
        shadowsEnabled: false,
        shadowMapSize: 512,
        envMapEnabled: true,
        advancedMaterials: false,
        bloomEnabled: false,
        bloomStrength: 0,
        ssaoEnabled: false,
        antiAliasing: 'none',
        motionBlurEnabled: false,
        depthOfFieldEnabled: false,
        particleBudget: 160,
        crowdInstanceCount: 400,
        adaptiveResolution: true,
      };
    case 'MEDIUM':
      return {
        preset,
        pixelRatio: profile.isSoftwareGl ? 1 : Math.min(dpr, 1.25),
        textureSize: 1024,
        anisotropy: 4,
        shadowsEnabled: !profile.isSoftwareGl,
        shadowMapSize: 1024,
        envMapEnabled: true,
        advancedMaterials: true,
        bloomEnabled: false,
        bloomStrength: 0,
        ssaoEnabled: false,
        antiAliasing: profile.isSoftwareGl ? 'none' : 'fxaa',
        motionBlurEnabled: false,
        depthOfFieldEnabled: false,
        particleBudget: 320,
        crowdInstanceCount: 900,
        adaptiveResolution: true,
      };
    case 'HIGH':
      return {
        preset,
        pixelRatio: profile.isSoftwareGl ? 1 : Math.min(dpr, 1.75),
        textureSize: 1024,
        anisotropy: 8,
        shadowsEnabled: !profile.isSoftwareGl,
        shadowMapSize: 2048,
        envMapEnabled: true,
        advancedMaterials: true,
        bloomEnabled: !profile.isSoftwareGl,
        bloomStrength: 0.12,
        ssaoEnabled: false,
        antiAliasing: profile.isSoftwareGl ? 'none' : 'fxaa',
        motionBlurEnabled: !profile.isSoftwareGl && options.motionBlur,
        depthOfFieldEnabled: false,
        particleBudget: 560,
        crowdInstanceCount: 1600,
        adaptiveResolution: true,
      };
    case 'ULTRA':
      return {
        preset,
        pixelRatio: profile.isSoftwareGl ? 1 : Math.min(dpr, 2.0),
        textureSize: 2048,
        anisotropy: 16,
        shadowsEnabled: !profile.isSoftwareGl,
        shadowMapSize: 2048,
        envMapEnabled: true,
        advancedMaterials: true,
        bloomEnabled: !profile.isSoftwareGl,
        bloomStrength: 0.16,
        ssaoEnabled: !profile.isSoftwareGl,
        antiAliasing: profile.isSoftwareGl ? 'none' : 'smaa',
        motionBlurEnabled: !profile.isSoftwareGl && options.motionBlur,
        depthOfFieldEnabled: !profile.isSoftwareGl && options.depthOfField,
        particleBudget: 850,
        crowdInstanceCount: 2400,
        adaptiveResolution: !profile.isMobile,
      };
  }
}

export function probeCapabilities(): GraphicsCapabilitiesProfile {
  let isSoftwareGl = false;
  let maxTextureSize = 4096;

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      isSoftwareGl = true;
    } else {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
        gpu
      );
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  const ua = nav?.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  return {
    isSoftwareGl,
    isMobile,
    deviceMemoryGb: nav?.deviceMemory ?? 8,
    hardwareConcurrency: nav?.hardwareConcurrency ?? 4,
    maxTextureSize,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  };
}
