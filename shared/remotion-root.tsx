// Entrada do bundle Remotion usado no export (renderMedia).
import React from 'react';
import { Composition, continueRender, delayRender, registerRoot } from 'remotion';
import { loadAllFonts } from './fonts';
import { VidCutComposition } from './VidCutComposition';
import type { CompositionProps } from './types';
import { newProject, projectDuration } from './types';

const Root: React.FC = () => (
  <Composition
    id="VidCut"
    component={VidCutComposition}
    durationInFrames={1}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ project: newProject(), mediaBase: '' } as CompositionProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: projectDuration(props.project),
      fps: props.project.fps,
      width: props.project.width,
      height: props.project.height,
    })}
  />
);

// esperar pelas fontes antes de renderizar qualquer frame
const fontsHandle = delayRender('A carregar fontes');
loadAllFonts().then(() => continueRender(fontsHandle));

registerRoot(Root);
