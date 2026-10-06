import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';
import type { Clip, CompositionProps, MediaItem, Track } from './types';
import { mediaUrl } from './types';
import { fadeFactor } from './motion';

const fill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' };

const VisualClip: React.FC<{ clip: Clip; media: MediaItem; track: Track; base: string }> = ({ clip, media, track, base }) => {
  const frame = useCurrentFrame(); // relativo ao início da Sequence
  const opacity = fadeFactor(frame, clip.duration, clip.fadeIn, clip.fadeOut);
  const src = mediaUrl(base, media.path);
  const vol = track.muted ? 0 : clip.volume;

  return (
    <AbsoluteFill style={{ opacity }}>
      {media.kind === 'image' ? (
        <Img src={src} style={fill} />
      ) : (
        <OffthreadVideo
          src={src}
          trimBefore={clip.trimStart > 0 ? clip.trimStart : undefined}
          muted={vol === 0}
          volume={(f) => vol * fadeFactor(f, clip.duration, clip.fadeIn, clip.fadeOut)}
          style={fill}
        />
      )}
    </AbsoluteFill>
  );
};

const AudioClip: React.FC<{ clip: Clip; media: MediaItem; track: Track; base: string }> = ({ clip, media, track, base }) => {
  if (track.muted) return null;
  return (
    <Audio
      src={mediaUrl(base, media.path)}
      trimBefore={clip.trimStart > 0 ? clip.trimStart : undefined}
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
        track.clips.map((clip) => {
          const media = mediaById.get(clip.mediaId);
          if (!media || clip.duration <= 0) return null;
          if (track.kind === 'video' && track.hidden) return null;
          return (
            <Sequence key={clip.id} from={clip.start} durationInFrames={clip.duration} name={media.name}>
              {track.kind === 'video' ? (
                <VisualClip clip={clip} media={media} track={track} base={mediaBase} />
              ) : (
                <AudioClip clip={clip} media={media} track={track} base={mediaBase} />
              )}
            </Sequence>
          );
        }),
      )}
    </AbsoluteFill>
  );
};
