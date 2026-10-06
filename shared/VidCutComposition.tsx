import React from 'react';
import { AbsoluteFill, Audio, Freeze, Img, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Clip, ClipColor, CompositionProps, MediaItem, Track } from './types';
import { clipSpeed, mediaUrl, sourceFrames } from './types';
import { fadeFactor } from './motion';
import { activeTransitions, transitionStyle, transitionVolume, type ActiveTransitions } from './transitions';
import { animState, blockStyle } from './anim';
import { TextLayer } from './TextLayer';
import { baseSize, getTransform, mediaStyle } from './transform';


const clampFrame = (f: number, duration: number) => Math.min(duration - 1, Math.max(0, f));

/** Opacidade, transformações e volume de um clip de vídeo num frame global */
function clipLook(clip: Clip, act: ActiveTransitions, g: number) {
  let opacity = fadeFactor(clampFrame(g - clip.start, clip.duration), clip.duration, clip.fadeIn, clip.fadeOut);
  let volume = opacity;
  const transforms: string[] = [];
  let clipPath: string | undefined;
  const apply = (role: 'in' | 'out', type: NonNullable<ActiveTransitions['inT']>['type'], t: number) => {
    const r = transitionStyle(type, role, t);
    opacity *= r.opacity;
    volume *= transitionVolume(role, t);
    if (r.style.transform) transforms.push(String(r.style.transform));
    if (r.style.clipPath) clipPath = String(r.style.clipPath);
  };
  if (act.inT) {
    const w0 = clip.start - act.inT.pre;
    const len = act.inT.pre + act.inT.post;
    if (g < w0 + len) apply('in', act.inT.type, (g - w0) / len);
  }
  // animação de entrada/saída (mesmos presets do texto, aplicados ao clip inteiro)
  const st = animState(clip.animIn, clip.animOut, g - clip.start, clip.duration);
  if (st.phase !== 'idle' && st.anim && g >= clip.start && g < clip.start + clip.duration) {
    const r = blockStyle(st.anim.preset, st.p, 120);
    opacity *= r.opacity;
    if (r.style.transform) transforms.push(String(r.style.transform));
    if (r.style.clipPath) clipPath = String(r.style.clipPath);
  }
  if (act.outT) {
    const end = clip.start + clip.duration;
    const w0 = end - act.outT.pre;
    const len = act.outT.pre + act.outT.post;
    if (g >= w0) apply('out', act.outT.type, (g - w0) / len);
  }
  return { opacity, volume, style: { transform: transforms.join(' ') || undefined, clipPath } as React.CSSProperties };
}

/** Filtro CSS para os ajustes de cor (brilho, contraste, saturação, sépia, desfocar) */
function colorFilter(c: ClipColor | undefined, H: number): string | undefined {
  if (!c) return undefined;
  const parts: string[] = [];
  if (c.brightness) parts.push(`brightness(${1 + c.brightness / 100})`);
  if (c.contrast) parts.push(`contrast(${1 + c.contrast / 100})`);
  if (c.saturation) parts.push(`saturate(${Math.max(0, 1 + c.saturation / 100)})`);
  if (c.sepia) parts.push(`sepia(${c.sepia / 100})`);
  if (c.blur) parts.push(`blur(${(c.blur * H) / 1080}px)`);
  return parts.length ? parts.join(' ') : undefined;
}

/** Camadas por cima da imagem: temperatura (tom quente/frio) e vinheta */
const ColorOverlays: React.FC<{ color?: ClipColor }> = ({ color }) => {
  if (!color) return null;
  const t = color.temperature;
  return (
    <>
      {t !== 0 && (
        <div style={{
          position: 'absolute', inset: 0, mixBlendMode: 'soft-light',
          background: t > 0 ? `rgba(255, 138, 20, ${(t / 100) * 0.75})` : `rgba(20, 120, 255, ${(-t / 100) * 0.75})`,
        }} />
      )}
      {color.vignette > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${(color.vignette / 100) * 0.85}) 100%)`,
        }} />
      )}
    </>
  );
};

const VisualClip: React.FC<{
  clip: Clip; media: MediaItem; track: Track; base: string; fps: number; act: ActiveTransitions; from: number; pre: number; post: number;
}> = ({ clip, media, track, base, fps, act, from, pre, post }) => {
  const local = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const look = clipLook(clip, act, from + local);
  const src = mediaUrl(base, media.path);
  const tf = getTransform(clip);
  look.opacity *= tf.opacity;
  const vol = track.muted || clip.audioDetached ? 0 : clip.volume;
  const sp = clipSpeed(clip);
  const fill: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' };
  // caixa posicionada/transformada com filtros de cor; a media enche a caixa
  const frameBox = (children: React.ReactNode) => (
    <div style={{ ...mediaStyle(tf, baseSize(media, W, H, tf.fit)), filter: colorFilter(clip.color, H) }}>
      {children}
      <ColorOverlays color={clip.color} />
    </div>
  );

  if (media.kind === 'image') {
    return (
      <AbsoluteFill style={{ opacity: look.opacity, ...look.style }}>
        {frameBox(<Img src={src} style={fill} />)}
      </AbsoluteFill>
    );
  }

  // Frames extra da fonte antes/depois do clip (para a transição); se não houver, congela.
  // trimStart está em frames da fonte; na timeline cada frame consome `sp` frames da fonte.
  const srcLen = sourceFrames(media, fps);
  const preReal = clip.trimStart >= pre * sp;
  const postReal = clip.trimStart + (clip.duration + post) * sp <= srcLen;
  const mainFrom = preReal ? 0 : pre;
  const mainDur = clip.duration + (preReal ? pre : 0) + (postReal ? post : 0);
  const mainTrim = Math.round(clip.trimStart - (preReal ? pre * sp : 0));
  const lastSrc = Math.max(0, Math.floor(clip.trimStart + clip.duration * sp) - 1);

  return (
    <AbsoluteFill style={{ opacity: look.opacity, ...look.style }}>
      {frameBox(<>
      {pre > 0 && !preReal && (
        <Sequence from={0} durationInFrames={pre} layout="none">
          <Freeze frame={0}>
            <OffthreadVideo src={src} trimBefore={clip.trimStart > 0 ? clip.trimStart : undefined} muted style={fill} />
          </Freeze>
        </Sequence>
      )}
      <Sequence from={mainFrom} durationInFrames={mainDur} layout="none">
        <OffthreadVideo
          src={src}
          trimBefore={mainTrim > 0 ? mainTrim : undefined}
          muted={vol === 0}
          playbackRate={sp}
          volume={(f) => vol * clipLook(clip, act, from + mainFrom + f).volume}
          style={fill}
        />
      </Sequence>
      {post > 0 && !postReal && (
        <Sequence from={pre + clip.duration} durationInFrames={post} layout="none">
          <Freeze frame={0}>
            <OffthreadVideo src={src} trimBefore={lastSrc > 0 ? lastSrc : undefined} muted style={fill} />
          </Freeze>
        </Sequence>
      )}
      </>)}
    </AbsoluteFill>
  );
};

const AudioClip: React.FC<{ clip: Clip; media: MediaItem; track: Track; base: string }> = ({ clip, media, track, base }) => {
  if (track.muted) return null;
  return (
    <Audio
      src={mediaUrl(base, media.path)}
      trimBefore={clip.trimStart > 0 ? clip.trimStart : undefined}
      playbackRate={clipSpeed(clip)}
      volume={(f) => clip.volume * fadeFactor(f, clip.duration, clip.fadeIn, clip.fadeOut)}
    />
  );
};

export const VidCutComposition: React.FC<CompositionProps> = ({ project, mediaBase }) => {
  const mediaById = new Map(project.media.map((m) => [m.id, m]));
  // Pista 0 fica por cima → desenhar de baixo para cima
  const ordered = [...project.tracks].reverse();

  return (
    <AbsoluteFill style={{ backgroundColor: project.background }}>
      {ordered.map((track) =>
        [...track.clips].sort((a, b) => a.start - b.start).map((clip) => {
          const media = mediaById.get(clip.mediaId);
          if (clip.duration <= 0) return null;
          if (!media && !(clip.text && track.kind !== 'audio')) return null;
          if (track.kind === 'audio' && media) {
            return (
              <Sequence key={clip.id} from={clip.start} durationInFrames={clip.duration} name={media.name}>
                <AudioClip clip={clip} media={media} track={track} base={mediaBase} />
              </Sequence>
            );
          }
          if (track.hidden) return null;
          if (clip.text || !media) {
            return (
              <Sequence key={clip.id} from={clip.start} durationInFrames={clip.duration} name="Texto">
                {clip.text && <TextLayer clip={clip} text={clip.text} />}
              </Sequence>
            );
          }
          const act = activeTransitions(track, clip);
          const pre = act.inT?.pre ?? 0;
          const post = act.outT?.post ?? 0;
          const from = clip.start - pre;
          return (
            <Sequence key={clip.id} from={from} durationInFrames={clip.duration + pre + post} name={media.name}>
              <VisualClip clip={clip} media={media} track={track} base={mediaBase} fps={project.fps} act={act} from={from} pre={pre} post={post} />
            </Sequence>
          );
        }),
      )}
    </AbsoluteFill>
  );
};
